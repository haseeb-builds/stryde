import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../supabase/migrations/20261017185728_trusted_plane_rpc_access_hardening.sql",
  import.meta.url,
);

async function loadMigration(): Promise<string> {
  try {
    return await readFile(migrationUrl, "utf8");
  } catch {
    return "";
  }
}

function normalizedSql(sql: string): string {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

const trustedPlaneFunctions = [
  "stryde_effective_plan(uuid)",
  "stryde_resource_available(uuid, text)",
  "stryde_reserve_resources(uuid, uuid, text, jsonb, integer)",
  "stryde_reconcile_reservation(uuid, text, numeric)",
  "stryde_release_reservations(uuid)",
  "stryde_expire_reservations()",
  "stryde_record_resource_usage(uuid, uuid, text, numeric, text)",
  "stryde_fire_trigger(uuid, text)",
];

test("trusted-plane RPCs are not executable by authenticated clients", async () => {
  const sql = normalizedSql(await loadMigration());
  assert.ok(sql, "the trusted-plane RPC access-hardening migration must exist");

  for (const signature of trustedPlaneFunctions) {
    assert.ok(
      sql.includes(`revoke execute on function public.${signature} from anon, authenticated, public;`),
      `${signature} must revoke execution from anon, authenticated, and public`,
    );
    assert.ok(
      sql.includes(`grant execute on function public.${signature} to service_role;`),
      `${signature} must remain executable by service_role`,
    );
  }
});

test("artifact revision binds the actor to the authenticated user", async () => {
  const sql = normalizedSql(await loadMigration());
  assert.ok(sql, "the trusted-plane RPC access-hardening migration must exist");

  const start = sql.indexOf("create or replace function public.stryde_revise_artifact");
  const end = sql.indexOf("$$;", start);
  assert.ok(start >= 0 && end > start, "the migration must redefine stryde_revise_artifact");
  const definition = sql.slice(start, end);

  assert.match(
    definition,
    /if auth\.uid\(\) is null or p_actor is distinct from auth\.uid\(\) then/,
    "revision must reject a caller-supplied actor that differs from auth.uid()",
  );
  assert.match(
    definition,
    /where id = p_artifact and owner_user_id = auth\.uid\(\)/,
    "revision must select only an artifact owned by the authenticated user",
  );
});

test("the resource-window helper has a fixed, safe search path", async () => {
  const sql = normalizedSql(await loadMigration());
  assert.ok(sql, "the trusted-plane RPC access-hardening migration must exist");
  assert.ok(
    sql.includes("alter function public.stryde_resource_window_start(text) set search_path = pg_catalog;"),
    "the helper should use pg_catalog rather than a mutable schema search path",
  );
});

test("authenticated-callable SECURITY DEFINER RPCs bind ownership to auth.uid() and set search_path", async () => {
  const userCallableDefiners = [
    {
      file: "../supabase/migrations/20260915035349_stryde_pursuit_creation_security_hardening.sql",
      fn: "public.stryde_create_pursuit",
      ownerCheck: /auth\.uid\(\)/,
    },
    {
      file: "../supabase/migrations/20260926103302_fix_commit_intervention_digest_schema.sql",
      fn: "stryde_internal.commit_intervention",
      ownerCheck: /where id = p_pursuit_id and owner_user_id = v_owner for update/,
    },
    {
      file: "../supabase/migrations/20260926120000_adaptive_pursuit_sources_and_human_feedback.sql",
      fn: "stryde_internal.set_objective_claim",
      ownerCheck: /where id = p_pursuit_id and owner_user_id = v_owner for update/,
    },
    {
      file: "../supabase/migrations/20260926120000_adaptive_pursuit_sources_and_human_feedback.sql",
      fn: "stryde_internal.complete_human_action",
      ownerCheck: /where id = p_action_id and owner_user_id = v_owner for update/,
    },
    {
      file: "../supabase/migrations/20260927083847_restore_conversation_turn_rpc.sql",
      fn: "public.stryde_record_conversation_user_input",
      ownerCheck: /where id = p_session_id and owner_user_id = v_actor for update/,
    },
    {
      file: "../supabase/migrations/20260927083847_restore_conversation_turn_rpc.sql",
      fn: "public.stryde_commit_conversation_turn",
      ownerCheck: /where id = p_session_id and owner_user_id = v_actor for update/,
    },
  ];

  for (const spec of userCallableDefiners) {
    const raw = await readFile(new URL(spec.file, import.meta.url), "utf8");
    const sql = normalizedSql(raw);
    const start = sql.indexOf(`create or replace function ${spec.fn}`);
    assert.ok(start >= 0, `${spec.fn} must exist in ${spec.file}`);
    const section = sql.slice(start, start + 3500);
    assert.match(section, /security definer/, `${spec.fn} must be declared security definer`);
    assert.match(section, /set search_path =/, `${spec.fn} must pin an explicit search_path`);
    assert.match(section, /auth\.uid\(\)/, `${spec.fn} must resolve identity from auth.uid()`);
    assert.match(section, spec.ownerCheck, `${spec.fn} must scope entity mutation to the authenticated owner`);
  }
});

