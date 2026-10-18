import assert from "node:assert/strict";
import test from "node:test";
import { assertSourceAdaptation } from "../lib/adaptive-model.ts";

test("assertSourceAdaptation correctly parses and retains audit_status on roadmap methods", () => {
  const validData = {
    summary: "Comprehensive guide to acquiring enterprise customers via outbound engineering.",
    source_claims: [
      {
        statement: "Cold email open rates scale with domain warming.",
        basis: "EXPLICIT_SOURCE",
        confidence: "HIGH",
      },
    ],
    methods: [
      {
        title: "Setup DKIM/SPF DNS records",
        sequence: 1,
        description: "Configure DNS authentications before sending outbound campaigns.",
        prerequisites: ["Custom domain purchased"],
        expected_change: "Inbox deliverability improves from 40% to 95%.",
        actionability: "IMMEDIATE",
        audit_status: "KEEP",
      },
      {
        title: "Send 500 unvetted emails daily immediately",
        sequence: 2,
        description: "Blast initial prospect list without warmup.",
        prerequisites: [],
        expected_change: "Fast initial responses.",
        actionability: "NOT_ACTIONABLE_YET",
        audit_status: "REMOVE",
      },
      {
        title: "A/B test value proposition headlines",
        sequence: 3,
        description: "Run 2-variant pitch tests on 50 leads each.",
        prerequisites: ["DKIM setup"],
        expected_change: "Find higher-converting messaging angle.",
        actionability: "PREPARATORY",
        audit_status: "NEEDS_EXPERIMENT",
      },
      {
        title: "Default unreviewed step",
        sequence: 4,
        description: "A step where model omitted audit_status.",
        prerequisites: [],
        expected_change: "Step progresses.",
        actionability: "IMMEDIATE",
      },
    ],
    assumptions: [
      {
        statement: "User has access to domain registrar DNS panel.",
        importance: "BLOCKING",
      },
    ],
    prerequisites: ["Domain access"],
    expected_outcomes: ["Outbound pipeline initialized"],
    unknowns: ["Target ICP title"],
    fit: {
      status: "GOOD",
      reasons: ["Aligns with customer acquisition goal"],
    },
    conflicts: [],
    gaps: ["No phone numbers provided in lead list"],
    adapted_strategy: [
      "Prioritize deliverability setup, eliminate unvetted blasting, and run headline experiments.",
    ],
    goal_candidates: [
      {
        goal: "Book 10 qualified customer calls in 30 days",
        why: "Validates proposition with minimal spend",
        conditions: ["Deliverability intact"],
      },
    ],
    provenance: {
      source_id: "src_123",
      uri: "https://example.com/playbook",
      content_sha256: "abcdef1234567890",
      extraction_status: "COMPLETED",
    },
  };

  const parsed = assertSourceAdaptation(validData);
  assert.equal(parsed.methods.length, 4);
  assert.equal(parsed.methods[0].audit_status, "KEEP");
  assert.equal(parsed.methods[1].audit_status, "REMOVE");
  assert.equal(parsed.methods[2].audit_status, "NEEDS_EXPERIMENT");
  assert.equal(parsed.methods[3].audit_status, undefined);
});

test("assertSourceAdaptation rejects unknown or malformed audit_status silently by omitting invalid values", () => {
  const data = {
    summary: "Audit status edge cases test",
    source_claims: [],
    methods: [
      {
        title: "Valid title",
        sequence: 1,
        description: "Valid description",
        prerequisites: [],
        expected_change: "Valid change",
        actionability: "IMMEDIATE",
        audit_status: "INVALID_AUDIT_STATUS",
      },
    ],
    assumptions: [],
    prerequisites: [],
    expected_outcomes: [],
    unknowns: [],
    fit: { status: "GOOD", reasons: [] },
    conflicts: [],
    gaps: [],
    adapted_strategy: [],
    goal_candidates: [],
    provenance: {
      source_id: "src_456",
      uri: null,
      content_sha256: null,
      extraction_status: "COMPLETED",
    },
  };

  const parsed = assertSourceAdaptation(data);
  assert.equal(parsed.methods[0].audit_status, undefined);
});
