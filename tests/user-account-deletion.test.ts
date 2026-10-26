import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cascadeDeleteUserData } from "../lib/account-deletion.ts";

test("cascadeDeleteUserData deletes all user-owned records and removes user from auth", async () => {
  const deletedTables: string[] = [];
  let deletedAuthUserId: string | null = null;
  const targetUserId = "user-to-delete-123";

  const mockServiceClient = {
    from: (table: string) => ({
      delete: () => ({
        eq: (col: string, val: string) => {
          if (col === "owner_user_id" && val === targetUserId) {
            deletedTables.push(table);
          }
          return Promise.resolve({ error: null });
        },
      }),
    }),
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          deletedAuthUserId = id;
          return { data: {}, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;

  const result = await cascadeDeleteUserData(mockServiceClient, targetUserId);

  assert.equal(result.success, true);
  assert.equal(deletedAuthUserId, targetUserId);

  // Verify critical tables were purged
  const expectedTables = [
    "conversation_message",
    "conversation_session",
    "action",
    "claim",
    "observation",
    "memory_item",
    "pursuit_source",
    "pursuit",
  ];

  for (const table of expectedTables) {
    assert.ok(
      deletedTables.includes(table),
      `Expected ${table} to be purged during cascade deletion`
    );
  }
});

test("cascadeDeleteUserData fails closed if user ID is empty or invalid", async () => {
  const mockServiceClient = {} as unknown as SupabaseClient;
  await assert.rejects(
    async () => await cascadeDeleteUserData(mockServiceClient, ""),
    /Invalid or missing user ID/
  );
});
