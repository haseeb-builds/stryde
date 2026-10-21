import assert from "node:assert/strict";
import test from "node:test";
import { compileForSituation } from "../lib/context-compiler.ts";
import type { AdaptiveSituation } from "../lib/adaptive-situation.ts";

test("R-7 context compiler integrity: preserves methods with audit_status, assumptions, prerequisites, unknowns, and provenance", () => {
  const situation: AdaptiveSituation = {
    generated_at: new Date().toISOString(),
    pursuit: {
      id: "p1",
      title: "Couch to Marathon",
      status: "ACTIVE",
      objective_claim_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    claims: [],
    decisions: [],
    actions: [],
    events: [],
    sources: [],
    observations: [],
    episodic_memory: [],
    memories: [],
    worker_capabilities: [],
    capabilities: { web_search: true },
    agent_selection: { source: "STRYDE_AUTO", preferred: null, allowed_workers: [], note: null },
    skills: [],
    source_adaptations: [
      {
        id: "adapt-marathon-v2",
        source_id: "src-roadmap-1",
        version: 2,
        status: "ADVISED",
        summary: "Audited training plan with evidence-backed adjustments",
        methods: [
          {
            title: "Long Slow Distance",
            sequence: 1,
            description: "Zone 2 aerobic base building for 90 minutes weekly",
            prerequisites: ["Base fitness"],
            expected_change: "Mitochondrial density increase",
            actionability: "IMMEDIATE",
            audit_status: "KEEP",
          },
          {
            title: "Daily Sprints",
            sequence: 2,
            description: "Maximum effort sprints every morning",
            prerequisites: [],
            expected_change: "Power",
            actionability: "BLOCKED",
            audit_status: "REMOVE",
          },
        ],
        assumptions: ["User has access to running track", "Adequate recovery sleep"],
        prerequisites: ["Medical clearance for intense running"],
        expected_outcomes: ["Aerobic threshold improvement by 10%"],
        unknowns: ["Lactate threshold baseline"],
        fit: { status: "GOOD", reasons: ["Matches target race timeline"] },
        gaps: ["No strength training component"],
        conflicts: ["Daily sprints conflict with aerobic recovery"],
        adapted_strategy: ["Focus on polarized 80/20 training"],
        goal_candidates: ["Complete half marathon tune-up in week 8"],
        source_claims: [
          { statement: "Zone 2 running improves mitochondrial density", basis: "EXPLICIT_SOURCE" },
        ],
        provenance: {
          turn_key: "turn-audit-99",
          reassessed_from: "adapt-marathon-v1",
          audit_status: "COMPLETE",
        },
        created_at: new Date().toISOString(),
      },
    ],
  };

  const compiled = compileForSituation(situation, { userMessage: "What does my updated training plan look like?" });

  assert.equal(compiled.packet.source_adaptations.length, 1);
  const adaptation = compiled.packet.source_adaptations[0];

  // Verify core identification
  assert.equal(adaptation.id, "adapt-marathon-v2");
  assert.equal(adaptation.version, 2);
  assert.equal(adaptation.status, "ADVISED");

  // Verify roadmap audit fields are strictly preserved
  const methods = adaptation.methods as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(methods), "methods must be an array");
  assert.equal(methods.length, 2);
  assert.equal(methods[0].title, "Long Slow Distance");
  assert.equal(methods[0].audit_status, "KEEP");
  assert.equal(methods[1].title, "Daily Sprints");
  assert.equal(methods[1].audit_status, "REMOVE");

  // Verify assumptions, prerequisites, expected_outcomes, unknowns
  assert.deepEqual(adaptation.assumptions, ["User has access to running track", "Adequate recovery sleep"]);
  assert.deepEqual(adaptation.prerequisites, ["Medical clearance for intense running"]);
  assert.deepEqual(adaptation.expected_outcomes, ["Aerobic threshold improvement by 10%"]);
  assert.deepEqual(adaptation.unknowns, ["Lactate threshold baseline"]);

  // Verify fit, gaps, conflicts, adapted_strategy, goal_candidates
  assert.deepEqual((adaptation.fit as Record<string, unknown>).status, "GOOD");
  assert.deepEqual(adaptation.gaps, ["No strength training component"]);
  assert.deepEqual(adaptation.conflicts, ["Daily sprints conflict with aerobic recovery"]);
  assert.deepEqual(adaptation.adapted_strategy, ["Focus on polarized 80/20 training"]);
  assert.deepEqual(adaptation.goal_candidates, ["Complete half marathon tune-up in week 8"]);

  // Verify provenance and source_claims
  assert.equal((adaptation.provenance as Record<string, unknown>).audit_status, "COMPLETE");
  assert.equal((adaptation.provenance as Record<string, unknown>).turn_key, "turn-audit-99");
  assert.equal((adaptation.source_claims as Array<Record<string, unknown>>)[0].basis, "EXPLICIT_SOURCE");
});
