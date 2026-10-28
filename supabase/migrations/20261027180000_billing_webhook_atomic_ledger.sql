-- ===========================================================================
-- Stryde Migration: 20261027180000_billing_webhook_atomic_ledger.sql
-- Description: Durable billing webhook event ledger and atomic event processor
--              for Paddle Billing v2 webhooks with PostgreSQL concurrency guarantees.
--
-- Guarantees:
-- 1. Atomic first-delivery claim via INSERT ... ON CONFLICT (event_id) DO NOTHING.
-- 2. Payload integrity: rejects/flags conflicting payloads submitted with identical event_id.
-- 3. Durable failure state: caught processing exceptions commit FAILED ledger state.
-- 4. Safe quarantine: unknown price IDs never overwrite or revoke valid existing paid entitlements.
-- 5. Out-of-order protection: older events cannot overwrite newer subscription state.
-- 6. Least privilege: executable strictly by service_role; deny-all RLS on ledger.
-- ===========================================================================

-- 1. Create durable webhook event ledger
create table if not exists public.billing_webhook_event_ledger (
  event_id text primary key,
  event_type text not null,
  occurred_at timestamptz not null,
  status text not null default 'PROCESSING'
    check (status in ('PROCESSING', 'COMPLETED', 'FAILED', 'IGNORED', 'CONFLICT')),
  owner_user_id uuid null references auth.users(id) on delete set null,
  payload_sha256 text not null,
  error_message text null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  updated_at timestamptz not null default now()
);

-- Index for querying recent events by user or occurred_at
create index if not exists idx_billing_webhook_ledger_user
  on public.billing_webhook_event_ledger(owner_user_id, occurred_at desc);

create index if not exists idx_billing_webhook_ledger_status
  on public.billing_webhook_event_ledger(status, updated_at);

-- Row-level security: only service_role has access to this ledger (no client policies)
alter table public.billing_webhook_event_ledger enable row level security;

-- 2. Atomic Event Processor Function
create or replace function public.stryde_process_paddle_billing_event(
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_payload_sha256 text,
  p_owner_user_id uuid,
  p_plan_id text,
  p_provider text,
  p_provider_customer_ref text,
  p_provider_subscription_ref text,
  p_provider_status text,
  p_status text,
  p_effective_at timestamptz,
  p_expires_at timestamptz,
  p_quarantined boolean default false,
  p_quarantine_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_inserted_id text;
  v_existing_ledger record;
  v_existing_sub record;
  v_err_msg text;
begin
  -- Step 1: Atomic First-Delivery Claim via INSERT ... ON CONFLICT DO NOTHING
  -- This prevents race conditions on first delivery from throwing uniqueness violations.
  insert into public.billing_webhook_event_ledger (
    event_id,
    event_type,
    occurred_at,
    status,
    owner_user_id,
    payload_sha256,
    created_at,
    updated_at
  ) values (
    p_event_id,
    p_event_type,
    p_occurred_at,
    'PROCESSING',
    p_owner_user_id,
    p_payload_sha256,
    now(),
    now()
  )
  on conflict (event_id) do nothing
  returning event_id into v_inserted_id;

  -- Lock the ledger row FOR UPDATE to serialize concurrent executions for this event
  select * into v_existing_ledger
  from public.billing_webhook_event_ledger
  where event_id = p_event_id
  for update;

  -- If the row was NOT inserted by this transaction, it pre-existed. Check status & integrity.
  if v_inserted_id is null then
    -- Check Event-ID Payload Integrity: if same event_id arrives with conflicting payload
    if v_existing_ledger.payload_sha256 is distinct from p_payload_sha256
       or v_existing_ledger.event_type is distinct from p_event_type then
      update public.billing_webhook_event_ledger
      set status = 'CONFLICT',
          error_message = 'Conflicting payload detected for existing event_id',
          updated_at = now()
      where event_id = p_event_id;

      return jsonb_build_object(
        'success', false,
        'conflict', true,
        'error', 'Conflicting payload detected for existing event_id',
        'event_id', p_event_id
      );
    end if;

    -- If already completed, acknowledge as duplicate
    if v_existing_ledger.status = 'COMPLETED' then
      return jsonb_build_object(
        'success', true,
        'duplicate', true,
        'event_id', p_event_id,
        'status', 'COMPLETED'
      );
    end if;

    -- If previously ignored, return ignored
    if v_existing_ledger.status = 'IGNORED' then
      return jsonb_build_object(
        'success', true,
        'ignored', true,
        'event_id', p_event_id,
        'reason', v_existing_ledger.error_message
      );
    end if;

    -- If currently being processed by another recent transaction, return concurrent_processing
    if v_existing_ledger.status = 'PROCESSING' and v_existing_ledger.updated_at > now() - interval '60 seconds' then
      return jsonb_build_object(
        'success', false,
        'concurrent_processing', true,
        'event_id', p_event_id
      );
    end if;

    -- Otherwise (previous attempt FAILED or timed out PROCESSING), allow retry
    update public.billing_webhook_event_ledger
    set status = 'PROCESSING',
        updated_at = now(),
        error_message = null
    where event_id = p_event_id;
  end if;

  -- Step 2: Quarantined Event Handling (Unknown Price Plan Safety)
  -- If the incoming event uses an unmapped/unknown price ID:
  -- We MUST NOT grant paid access, but we ALSO must NOT destroy/overwrite an existing paid subscription!
  if p_quarantined then
    update public.billing_webhook_event_ledger
    set status = 'IGNORED',
        error_message = coalesce(p_quarantine_reason, 'Unrecognized price plan quarantined; existing subscription preserved'),
        completed_at = now(),
        updated_at = now()
    where event_id = p_event_id;

    return jsonb_build_object(
      'success', true,
      'quarantined', true,
      'event_id', p_event_id,
      'reason', coalesce(p_quarantine_reason, 'Unrecognized price plan quarantined; existing subscription preserved')
    );
  end if;

  -- Step 3: Transactional Subscription State Update with Subtransaction Protection
  -- Using a subtransaction ensures that if subscription update fails, the FAILED status on the
  -- ledger is committed durably instead of being rolled back with the transaction.
  begin
    -- Lock existing subscription_state row for this user if it exists
    select last_event_at, provider_subscription_ref, status, plan_id
    into v_existing_sub
    from public.subscription_state
    where owner_user_id = p_owner_user_id
    for update;

    if found and v_existing_sub.last_event_at is not null then
      -- Out-of-order check: if incoming event is older than the last processed event, ignore it
      if p_occurred_at < v_existing_sub.last_event_at then
        update public.billing_webhook_event_ledger
        set status = 'IGNORED',
            error_message = 'stale_event',
            completed_at = now(),
            updated_at = now()
        where event_id = p_event_id;

        return jsonb_build_object(
          'success', true,
          'ignored', true,
          'reason', 'stale_event',
          'occurred_at', p_occurred_at,
          'current_last_event_at', v_existing_sub.last_event_at
        );
      end if;

      -- Duplicate state check
      if p_occurred_at = v_existing_sub.last_event_at
         and v_existing_sub.provider_subscription_ref = p_provider_subscription_ref
         and v_existing_sub.status = p_status
         and v_existing_sub.plan_id = p_plan_id then
        update public.billing_webhook_event_ledger
        set status = 'COMPLETED',
            completed_at = now(),
            updated_at = now()
        where event_id = p_event_id;

        return jsonb_build_object(
          'success', true,
          'duplicate', true,
          'event_id', p_event_id
        );
      end if;
    end if;

    -- Atomic Upsert to subscription_state
    insert into public.subscription_state (
      owner_user_id,
      plan_id,
      provider,
      provider_customer_ref,
      provider_subscription_ref,
      provider_status,
      status,
      source,
      effective_at,
      expires_at,
      last_event_at,
      reconciled_at,
      updated_at
    ) values (
      p_owner_user_id,
      p_plan_id,
      p_provider,
      p_provider_customer_ref,
      p_provider_subscription_ref,
      p_provider_status,
      p_status,
      'BILLING_WEBHOOK',
      p_effective_at,
      p_expires_at,
      p_occurred_at,
      now(),
      now()
    ) on conflict (owner_user_id) do update set
      plan_id = excluded.plan_id,
      provider = excluded.provider,
      provider_customer_ref = excluded.provider_customer_ref,
      provider_subscription_ref = excluded.provider_subscription_ref,
      provider_status = excluded.provider_status,
      status = excluded.status,
      source = 'BILLING_WEBHOOK',
      effective_at = excluded.effective_at,
      expires_at = excluded.expires_at,
      last_event_at = excluded.last_event_at,
      reconciled_at = now(),
      updated_at = now()
    where public.subscription_state.last_event_at is null
       or public.subscription_state.last_event_at <= excluded.last_event_at;

    -- Mark ledger entry COMPLETED
    update public.billing_webhook_event_ledger
    set status = 'COMPLETED',
        completed_at = now(),
        updated_at = now()
    where event_id = p_event_id;

    return jsonb_build_object(
      'success', true,
      'updated', true,
      'event_id', p_event_id,
      'plan_id', p_plan_id,
      'status', p_status,
      'quarantined', false
    );
  exception
    when others then
      v_err_msg := SQLERRM;
      -- Subtransaction rolls back any incomplete subscription_state changes
      -- Update ledger durably to FAILED so failure is recorded and retryable
      update public.billing_webhook_event_ledger
      set status = 'FAILED',
          error_message = v_err_msg,
          updated_at = now()
      where event_id = p_event_id;

      return jsonb_build_object(
        'success', false,
        'retryable', true,
        'error', v_err_msg,
        'event_id', p_event_id
      );
  end;
end;
$$;

-- Grant execution to service_role only
revoke all on function public.stryde_process_paddle_billing_event from public, anon, authenticated;
grant execute on function public.stryde_process_paddle_billing_event to service_role;
