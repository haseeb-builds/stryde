// Live proof of the evidence-acquisition surfaces (file ingestion, URL
// ingestion, research search, materialization with citation) against the real
// dev server and live Supabase. The adaptation step is model-dependent and
// degrades honestly with a warning when no provider is available — the
// harness accepts either outcome and reports which happened. No secrets are
// printed.
//
// Usage: npm run e2e:evidence-loop   (requires the dev server on NEXT_PUBLIC_SITE_URL)
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

const env = Object.fromEntries(
  (await import("node:fs")).readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SECRET_KEY;
const EMAIL = env.STRYDE_TEST_USER_EMAIL;
const PASSWORD = env.STRYDE_TEST_USER_PASSWORD;
for (const [name, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SECRET_KEY: SERVICE_KEY, STRYDE_TEST_USER_EMAIL: EMAIL, STRYDE_TEST_USER_PASSWORD: PASSWORD })) {
  if (!value) throw new Error(`Missing required env: ${name}`);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = createClient(supabaseUrl, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(supabaseUrl, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let passed = 0;
function ok(name: string) { passed += 1; console.log(`  ✔ ${name}`); }

const health = await fetch(`${BASE_URL}/api/health/model`).then((r) => r.status).catch(() => 0);
if (!health) { console.error(`Dev server not reachable at ${BASE_URL}. Start it with: npm run dev`); process.exit(1); }
console.log(`Dev server up (${BASE_URL})`);

const { data: authData, error: authError } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
assert.ok(!authError, `sign-in failed: ${authError?.message}`);
const bearer = authData!.session!.access_token;
const userId = authData!.user!.id;
void userId; // kept for symmetry with the other harnesses; assertions use service reads

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const created = await fetch(`${BASE_URL}/api/v1/pursuits`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
  body: JSON.stringify({ title: `E2E EVIDENCE loop ${stamp}` }),
});
assert.equal(created.status, 201, "pursuit creation failed");
const pursuitId = ((await created.json()) as Json).pursuit as Json | undefined;
const pursuitUuid = (pursuitId?.id as string) ?? undefined;
assert.ok(pursuitId, "pursuit id missing");
const sourcesPath = `${BASE_URL}/api/v1/pursuits/${pursuitUuid}/sources`;

// --- 1. Unauthenticated writes are refused (the boundary behind ingestion).
const unauth = await fetch(sourcesPath, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content: "no token" }),
});
assert.equal(unauth.status, 401, "unauthenticated source ingestion must be refused");
ok("unauthenticated ingestion refused (401)");

// --- 2. FILE ingestion: a real multipart upload with a distinctive document.
const marker = "STRYDE-EVIDENCE-MARKER-9f31: closures are functions that remember their lexical scope.";
const documentText = [
  "Study notes (week one)\n\n",
  "Lesson summary.\n",
  marker, "\n",
  "The rest of the document exists so the extractor has realistic volume to\n",
  "chew through, including multiple lines and punctuation, and enough total\n",
  "length that a locator against it is meaningful for the citation step.\n",
].join("");
const form = new FormData();
form.append("file", new Blob([documentText], { type: "text/plain" }));
form.append("title", "Week one study notes");
const fileRes = await fetch(sourcesPath, { method: "POST", headers: { Authorization: `Bearer ${bearer}` }, body: form });
const fileJson = await fileRes.json() as Json;
assert.equal(fileRes.status, 201, `file upload failed: ${JSON.stringify(fileJson).slice(0, 200)}`);
const fileSource = fileJson.source as Json;
assert.ok(fileSource, "file upload returned no source");
const fileMeta = fileSource.source_metadata as Json;
assert.equal(fileMeta.ingestion, "FILE", "file provenance must be recorded");
const { data: storedFileSource } = await service.from("pursuit_source").select("content_text, content_sha256, fetch_status").eq("id", (fileSource.id as string)).maybeSingle();
assert.ok(storedFileSource, "file source not persisted");
assert.ok((storedFileSource!.content_text as string).includes("STRYDE-EVIDENCE-MARKER-9f31"), "extracted text must carry the document's content");
assert.equal(storedFileSource!.fetch_status, "FETCHED");
ok("file upload extracted and stored the document text with file provenance");

// --- 3. URL ingestion: direct fetch of a stable public page.
const urlRes = await fetch(sourcesPath, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
  body: JSON.stringify({ url: "https://example.com/", title: "Reference page" }),
});
const urlJson = await urlRes.json() as Json;
assert.equal(urlRes.status, 201, `url ingestion failed: ${JSON.stringify(urlJson).slice(0, 200)}`);
const urlSource = urlJson.source as Json;
assert.equal(urlSource.fetch_status, "FETCHED");
const { data: storedUrlSource } = await service.from("pursuit_source").select("content_text").eq("id", (urlSource.id as string)).maybeSingle();
assert.ok((storedUrlSource!.content_text as string).toLowerCase().includes("example domain"), "URL content must carry the page text");
ok("URL ingestion fetched and stored a live public page");

// --- 4. Research search: live only when a search provider is configured.
// With no EXA_API_KEY / FIRECRAWL_API_KEY in the environment the route
// degrades with 502 "Missing research configuration" — an honest skip, not
// a failure; the materialization leg below is provider-independent.
const searchRes = await fetch(`${BASE_URL}/api/v1/pursuits/${pursuitUuid}/research`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
  body: JSON.stringify({ question: "what is the Domain Name System and why does it matter", max_results: 3 }),
});
const searchJson = await searchRes.json() as Json;
if (searchRes.status === 200) {
  const results = (searchJson.research as Json).results as Json[];
  assert.ok(results.length >= 1, "research search returned no results");
  assert.ok(results.every((r) => typeof r.url === "string" && r.url.startsWith("http")), "results must carry URLs");
  ok(`research search served ${results.length} live ranked results from a real provider`);
} else {
  assert.ok(/Missing research|provider|429|quota/i.test(String((searchJson as Json).error ?? "")), `research search failed unexpectedly: ${JSON.stringify(searchJson).slice(0, 140)}`);
  console.log("  ℹ search leg not live-provable here (no provider configured/quota) — degraded honestly");
}

// --- 5. Materialization: search result -> source + citation (adaptation
//       degrades honestly without a model provider).
const matRes = await fetch(`${BASE_URL}/api/v1/pursuits/${pursuitUuid}/research`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
  body: JSON.stringify({ action: "MATERIALIZE_RESULT", url: "https://www.rfc-editor.org/rfc/rfc2606.html", title: "RFC 2606: Reserved Top Level DNS Names", highlights: ["Example Domain"] }),
});
const matJson = await matRes.json() as Json;
assert.equal(matRes.status, 201, `materialize failed: ${JSON.stringify(matJson).slice(0, 200)}`);
const materializedSource = matJson.source as Json;
assert.ok(materializedSource, "materialize returned no source");
if (matJson.warning) console.log(`  ℹ adaptation degraded honestly: ${String(matJson.warning).slice(0, 110)}`);
else assert.ok(matJson.adaptation, "no warning and no adaptation is contradictory");

const { data: citation } = await service.from("pursuit_source_citation").select("source_content_sha256, locator, excerpt, basis").eq("source_id", materializedSource.id as string).maybeSingle();
assert.ok(citation, "no citation was written for the materialized source");
assert.equal(citation!.source_content_sha256, materializedSource.content_sha256, "citation must reference the stored source content hash");
const locator = citation!.locator as Json;
assert.equal(locator.type, "CHARACTER_RANGE");
assert.ok(typeof locator.start === "number" && typeof locator.end === "number" && locator.start < locator.end, "locator must be a valid character range");
assert.ok(typeof citation!.excerpt === "string" && citation!.excerpt.length > 0);
ok(`materialization produced a source-bound citation (locator ${locator.start}..${locator.end}, basis ${citation!.basis})`);

// --- 6. The sources list endpoint reflects everything for the UI.
const listRes = await fetch(sourcesPath, { headers: { Authorization: `Bearer ${bearer}` } });
const listJson = await listRes.json() as Json;
const listedSources = (listJson.sources as Json[]) ?? [];
const kinds = listedSources.map((s) => (s.source_metadata as Json | null)?.ingestion ?? (s.uri ? "URL" : "PASTED"));
assert.ok(kinds.includes("FILE"), "sources list must include the uploaded file");
assert.ok(listedSources.some((s) => s.id === urlSource.id), "sources list must include the ingested URL");
ok("sources listing reflects the file and URL material for the workspace UI");

console.log(`\ne2e:evidence-loop PASSED ${passed}/${passed} boundaries`);
