import assert from "node:assert/strict";
import test from "node:test";

// `stryde_lease_next_job` returns `public.job`, so Postgres always returns
// exactly one row. An empty queue is a NULL composite: a non-null JavaScript
// object whose fields are all null. Treating that as a job made the dispatcher
// call stryde_start_attempt with a null id and fail every poll with
//   22P02 invalid input syntax for type uuid: "null"
// which stalled the whole worker queue.

function leasedJobOrNull(data: unknown) {
  const row = data as { id?: unknown } | null;
  if (!row || typeof row !== "object" || !row.id || typeof row.id !== "string") return null;
  return row as { id: string };
}

test("an empty queue (NULL composite row) is no work, not a job", () => {
  assert.equal(leasedJobOrNull(null), null);
  assert.equal(leasedJobOrNull(undefined), null);
  assert.equal(
    leasedJobOrNull({
      id: null, owner_user_id: null, action_id: null, tool_id: null,
      tool_version: null, frozen_arguments: null, args_hash: null,
      idempotency_key: null, status: null, lease_owner: null,
    }),
    null,
    "an all-null composite row must not be treated as a leased job",
  );
});

test("a real leased job is returned", () => {
  const job = leasedJobOrNull({ id: "job-1", status: "DISPATCHING", tool_id: "t1" });
  assert.ok(job);
  assert.equal(job!.id, "job-1");
});

test("a malformed non-string id is not accepted as a job", () => {
  assert.equal(leasedJobOrNull({ id: 123 }), null);
  assert.equal(leasedJobOrNull({ id: "" }), null);
  assert.equal(leasedJobOrNull("job-1"), null, "a bare string is not a job row");
});
