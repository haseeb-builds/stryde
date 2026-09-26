import { existsSync, readFileSync } from "node:fs";

function loadLocalEnv(path = ".env.local") {
  const values: Record<string, string> = { ...process.env } as Record<string, string>;
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || values[match[1]]) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = loadLocalEnv();
const required = [
  ["Next/Supabase URL", "NEXT_PUBLIC_SUPABASE_URL"],
  ["Next/Supabase anon key", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  ["Supabase secret key", "SUPABASE_SECRET_KEY"],
  ["Supabase legacy service-role key", "SUPABASE_SERVICE_ROLE_KEY"],
  ["Hermes CLI adapter command", "STRYDE_HERMES_COMMAND"],
  ["Authenticated smoke user email", "STRYDE_TEST_USER_EMAIL"],
  ["Authenticated smoke user password", "STRYDE_TEST_USER_PASSWORD"],
] as const;

const optional = [
  ["Dispatcher worker id (defaulted if missing)", "STRYDE_WORKER_ID"],
  ["Dispatcher poll interval (default 1000ms)", "STRYDE_WORKER_POLL_MS"],
  ["Dispatcher lease duration (default 600s)", "STRYDE_WORKER_LEASE_SECONDS"],
  ["Dispatcher max runtime (default 300000ms)", "STRYDE_WORKER_MAX_RUNTIME_MS"],
  ["Dispatcher one-shot mode (set to 1 for smoke)", "STRYDE_WORKER_ONCE"],
  ["Server model provider", "STRYDE_MODEL_PROVIDER"],
  ["Server model API key", "STRYDE_MODEL_API_KEY"],
  ["Server model name", "STRYDE_MODEL_NAME"],
] as const;

console.log("Stryde runtime preflight (values are never printed)");
for (const [label, key] of required) console.log(`${env[key]?.trim() ? "PRESENT" : "MISSING"}\t${key}\t${label}`);
for (const [label, key] of optional) console.log(`${env[key]?.trim() ? "PRESENT" : "MISSING"}\t${key}\t${label}`);
console.log(`EFFECTIVE\tSUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY\t${env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? "PRESENT" : "MISSING"}`);
console.log("\nAuthentication: Supabase signInWithPassword/signUp; API calls require a bearer access token.");
console.log("The preflight does not create users, grant capabilities, invoke workers, or contact Supabase.");
