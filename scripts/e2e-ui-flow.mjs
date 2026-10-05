// Real-browser verification of the core user flow against the PRODUCTION build.
//
// Everything else in this repository is verified at the API or database layer.
// This suite exists because the user-facing surface had never been exercised in
// a browser: a build can compile, pass every API test, deploy successfully, and
// still ship a page whose React never hydrates, leaving a form that silently does
// nothing.
//
// Asserts, on a real served build:
//   - the page hydrates (React attaches to the DOM);
//   - sign-in works through the actual form and yields a session;
//   - the signed-in surface lists real pursuits from the database;
//   - a pursuit page loads and is not stuck on a loader;
//   - no internal ontology (Research/Claim/Evidence/Observation) is exposed as
//     primary UI on either surface.
//
// Credentials are read from .env.local and are never printed or persisted.
import fs from "node:fs";
import path from "node:path";
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const cdp = (await import("./cdp-client.mjs")).default;
const env = Object.fromEntries(
  fs.readFileSync(path.join(repo, ".env.local"), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3155";

let passed = 0;
const ok = (n) => { passed += 1; console.log(`  \u2713 ${n}`); };
const fail = (m) => { console.error(`  \u2717 ${m}`); process.exit(1); };

await cdp.send("Runtime.enable");
// React controlled inputs ignore plain DOM assignment: assign through the
// prototype setter and fire the event React listens for, or the next render
// discards the value.
const FILL = (sel, val) => cdp.evaluate(
  "(() => { const el=document.querySelector(" + JSON.stringify(sel) + ");" +
  " if(!el) return -1;" +
  " const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;" +
  " Object.getOwnPropertyDescriptor(proto,'value').set.call(el, " + JSON.stringify(val) + ");" +
  " el.dispatchEvent(new Event('input',{bubbles:true}));" +
  " return el.value.length; })()"
);

await cdp.goto(BASE);
await new Promise((r) => setTimeout(r, 3500));

const hydrated = await cdp.evaluate(
  "(() => { const f=document.querySelector('form');" +
  " return f ? Object.keys(f).filter(k=>k.startsWith('__react')).length : -1; })()"
);
if (hydrated <= 0) fail("the page did not hydrate: React never attached to the DOM");
ok(`page hydrated on a real build (${hydrated} React fibers on the form)`);

const landing = await cdp.evaluate("document.body.innerText");
if (/Research|Claim|Evidence|Observation/.test(landing)) fail("internal ontology leaked onto the landing surface");
ok("landing surface exposes no internal ontology");

// Sign in unless a session already exists (the browser profile persists).
if (landing.includes("Sign in")) {
  const eLen = await FILL('input[type="email"]', env.STRYDE_TEST_USER_EMAIL);
  const pLen = await FILL('input[type="password"]', env.STRYDE_TEST_USER_PASSWORD);
  if (pLen !== env.STRYDE_TEST_USER_PASSWORD.length) fail("password field did not accept the value");
  if (eLen !== env.STRYDE_TEST_USER_EMAIL.length) fail("email field did not accept the value");
  const valid = await cdp.evaluate("document.querySelector('form').checkValidity()");
  if (!valid) fail("sign-in form is still invalid after filling credentials");
  await cdp.evaluate("document.querySelector('form').requestSubmit()");
  await new Promise((r) => setTimeout(r, 7000));
}
const signedIn = await cdp.evaluate("document.body.innerText");
if (signedIn.includes("Sign in")) fail("sign-in did not complete: the form is still shown");
ok("signed in through the real form");

const hasToken = await cdp.evaluate("!!localStorage.getItem('sb-pvijrnwdnolvnoibarrj-auth-token')");
if (!hasToken) fail("no Supabase session token after sign-in");
ok("Supabase session established in the browser");

const pursuitCount = await cdp.evaluate(
  "[...document.querySelectorAll('button')].filter(b=>/COMPLETED|ACTIVE|DISCOVERING|IN_PROGRESS/.test(b.innerText)).length"
);
const surface = signedIn.split("\n").filter(Boolean);
if (/Start pursuit/.test(signedIn)) ok("signed-in surface offers pursuit creation");
ok(`signed-in surface rendered real content (${surface.length} text nodes, ${pursuitCount} pursuit entries)`);

// Navigate through the app's own navigation to a real pursuit.
await cdp.evaluate(
  "(() => { const b=[...document.querySelectorAll('button')]" +
  ".find(x=>/COMPLETED|ACTIVE|DISCOVERING|IN_PROGRESS/.test(x.innerText));" +
  " if (b) b.click(); return !!b; })()"
);
await new Promise((r) => setTimeout(r, 4000));
const currentPath = await cdp.evaluate("location.pathname");
if (!currentPath || !currentPath.includes("/pursuits/")) fail("could not navigate to a pursuit from the signed-in surface");
ok(`navigated to a real pursuit (${currentPath.slice(0, 24)}...)`);

await cdp.waitFor("!document.body.innerText.includes('Loading\u2026') || document.body.innerText.length > 200", 30000, "pursuit render");
const pursuitText = await cdp.evaluate("document.body.innerText");
if (/Loading…/.test(pursuitText) && pursuitText.length < 120) fail("pursuit page is stuck on the loader");
// The UX law bans internal ontology as PRIMARY navigation — not as collapsed,
// contextual disclosure (docs/PRODUCT.md allows it when it makes an action
// easier). So the terms must not appear in headings or top-level buttons, but
// the contextual panels must exist inside <details> disclosure elements.
const primaryOntology = await cdp.evaluate(
  "(() => {" +
  "  const terms = /Research|Claim|Evidence|Decision|Worker|Observation/;" +
  "  const leak = [];" +
  "  for (const el of document.querySelectorAll('h1,h2,h3,button'))" +
  "    if (!el.closest('details') && terms.test(el.innerText)) leak.push(el.innerText.slice(0,40));" +
  "  return leak;" +
  "})()"
);
if (primaryOntology.length) fail("internal ontology leaked as primary UI: " + primaryOntology.join(" | "));
ok("pursuit page exposes no internal ontology as primary UI");
// The panels are sections with heading text and toggle buttons (not
// <details>), so reachability is checked against the rendered section
// headers on the pursuit surface.
// The panels mount after the client resolves its session; on a production
// edge that takes longer than a fixed snapshot, so poll until they appear.
let contextualPanels = null;
for (let i = 0; i < 15; i++) {
  contextualPanels = await cdp.evaluate(
    "(() => {" +
    "  const t = document.body.innerText;" +
    "  return {" +
    "    claims: /Evidence & claims/i.test(t)," +
    "    memory: /What Stryde remembers/i.test(t)," +
    "    sources: /Source material/i.test(t)," +
    "    autonomy: /What Stryde may do on its own/i.test(t)" +
    "  };" +
    "})()"
  );
  if (contextualPanels.claims && contextualPanels.memory && contextualPanels.sources && contextualPanels.autonomy) break;
  await new Promise((r) => setTimeout(r, 2000));
}
if (!contextualPanels.claims) fail("claims/evidence panel is not reachable in the browser");
ok("claims/evidence panel reachable as contextual disclosure");
if (!contextualPanels.memory) fail("memory panel is not reachable in the browser");
ok("memory inspectability panel reachable as contextual disclosure");
if (!contextualPanels.sources) fail("source material panel is not reachable in the browser");
ok("source material panel reachable as contextual disclosure");
if (!contextualPanels.autonomy) fail("autonomy policy control is not reachable in the browser");
ok("autonomy policy control reachable as contextual disclosure");

console.log(`\nUI FLOW PASSED: ${passed} boundaries verified in a real browser against a production build.`);
console.log(`Evidence: ${BASE}${currentPath}`);
process.exit(0);
