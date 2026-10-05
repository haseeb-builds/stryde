-- Register Stryde's browser observation worker.
-- Same contract as the other worker tools: this row makes the BROWSER worker
-- addressable by the CONTROLLED Action -> Job -> Attempt contract. It grants no
-- user access and confers no authority of its own. The worker's v1 task grammar
-- is bounded page observation (OBSERVE_PAGE): navigate, render, extract, and
-- return artifacts. It performs no writes, submissions, or credential entry, so
-- its side-effect class is observation-only.

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
  'worker.browser',
  'v1',
  '{
    "type":"object",
    "additionalProperties":false,
    "required":["worker_type","instruction","context","idempotency_key"],
    "properties":{
      "worker_type":{"type":"string","enum":["BROWSER"]},
      "instruction":{"type":"string","minLength":1,"maxLength":12000},
      "context":{"type":"object"},
      "idempotency_key":{"type":"string","minLength":1,"maxLength":500}
    }
  }'::jsonb,
  '{"type":"object"}'::jsonb,
  '{"trust":"UNTRUSTED_RESULT","canonical_authority":false,"requires_verification":true}'::jsonb,
  'OBSERVATION_ONLY',
  'NON_SIDE_EFFECTING_BY_DEFAULT',
  'WORKER_PROVIDER_MUST_DEDUPLICATE',
  120000,
  '{"max_attempts":1,"backoff_seconds":0}'::jsonb,
  'STRYDE_BROWSER_TOKEN',
  '{"mode":"WORKER_SANDBOX_REQUIRED","network":"PUBLIC_WEB_ONLY","forbidden":"LOOPBACK_AND_PRIVATE_RANGES"}'::jsonb,
  '{"requires_worker_runtime":true,"requires_browser_executable":true}'::jsonb,
  '{"observation_type":"BROWSER_OBSERVATION","verification_required":true,"browser_success_is_not_verification":true}'::jsonb
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
