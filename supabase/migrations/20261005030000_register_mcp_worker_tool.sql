-- Register Stryde's MCP capability transport as a worker tool.
-- The MCP worker executes ONE tool call on a configured MCP server per job
-- (context: server, tool, arguments). Servers are declared by the operator via
-- STRYDE_MCP_SERVERS; individual tool capabilities and grants are owner
-- decisions made through the normal capability-grant flow. This row makes the
-- transport addressable; it grants nothing by itself.

insert into public.tool (
  tool_key,
  tool_version,
  argument_schema,
  output_schema,
  output_classification,
  side_effect_class,
  reversibility,
  idempotency_behavior,
  timeout_ms,
  retry_policy,
  credential_scope,
  egress_policy,
  environment_restrictions,
  verification_capability
)
values
(
  'worker.mcp',
  'v1',
  '{
    "type":"object",
    "additionalProperties":false,
    "required":["worker_type","instruction","context","idempotency_key"],
    "properties":{
      "worker_type":{"type":"string","enum":["MCP"]},
      "instruction":{"type":"string","minLength":1,"maxLength":12000},
      "context":{"type":"object"},
      "idempotency_key":{"type":"string","minLength":1,"maxLength":500}
    }
  }'::jsonb,
  '{"type":"object"}'::jsonb,
  '{"trust":"UNTRUSTED_RESULT","canonical_authority":false,"requires_verification":true}'::jsonb,
  'WORKER_EXECUTION',
  'NON_SIDE_EFFECTING_BY_DEFAULT',
  'WORKER_PROVIDER_MUST_DEDUPLICATE',
  120000,
  '{"max_attempts":1,"backoff_seconds":0}'::jsonb,
  'STRYDE_MCP_TOKEN',
  '{"mode":"WORKER_SANDBOX_REQUIRED","network":"PER_CONFIGURED_MCP_SERVERS"}'::jsonb,
  '{"requires_worker_runtime":true,"requires_mcp_servers_config":true}'::jsonb,
  '{"observation_type":"MECHANICAL_ATTEMPT_RESULT","verification_required":true,"tool_success_is_not_verification":true}'::jsonb
)
on conflict (tool_key, tool_version) do update
set argument_schema = excluded.argument_schema,
    output_schema = excluded.output_schema,
    output_classification = excluded.output_classification,
    side_effect_class = excluded.side_effect_class,
    reversibility = excluded.reversibility,
    idempotency_behavior = excluded.idempotency_behavior,
    timeout_ms = excluded.timeout_ms,
    retry_policy = excluded.retry_policy,
    credential_scope = excluded.credential_scope,
    egress_policy = excluded.egress_policy,
    environment_restrictions = excluded.environment_restrictions,
    verification_capability = excluded.verification_capability;
