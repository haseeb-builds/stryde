-- Register Stryde's first worker capabilities.
-- These rows make worker execution addressable by the existing CONTROLLED
-- Action -> Job -> Attempt contract. They do not grant any user access.

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
  'worker.hermes',
  'v1',
  '{
    "type":"object",
    "additionalProperties":false,
    "required":["worker_type","instruction","context","idempotency_key"],
    "properties":{
      "worker_type":{"type":"string","enum":["HERMES"]},
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
  300000,
  '{"max_attempts":1,"backoff_seconds":0}'::jsonb,
  'STRYDE_HERMES_TOKEN',
  '{"mode":"WORKER_SANDBOX_REQUIRED"}'::jsonb,
  '{"requires_worker_runtime":true}'::jsonb,
  '{"observation_type":"MECHANICAL_ATTEMPT_RESULT","verification_required":true}'::jsonb
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
  'worker.opencode',
  'v1',
  '{
    "type":"object",
    "additionalProperties":false,
    "required":["worker_type","instruction","context","idempotency_key"],
    "properties":{
      "worker_type":{"type":"string","enum":["OPENCODE"]},
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
  300000,
  '{"max_attempts":1,"backoff_seconds":0}'::jsonb,
  'STRYDE_OPENCODE_TOKEN',
  '{"mode":"WORKER_SANDBOX_REQUIRED"}'::jsonb,
  '{"requires_worker_runtime":true}'::jsonb,
  '{"observation_type":"MECHANICAL_ATTEMPT_RESULT","verification_required":true}'::jsonb
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
