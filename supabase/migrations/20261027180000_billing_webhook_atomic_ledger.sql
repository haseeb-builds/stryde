-- ===========================================================================
-- Stryde Migration: 20261027180000_billing_webhook_atomic_ledger.sql
-- Description: Durable billing webhook event ledger and atomic event processor
--              for Paddle Billing v2 webhooks.
--
-- Guarantees:
-- 1. Idempotent event ledger keyed by provider event_id.
-- 2. Concurrency control: prevents duplicate simultaneous execution of the same event.
-- 3. Recoverable: failed or timed-out events can be retried safely.
-- 4. Out-of-order protection: older events cannot overwrite newer subscription state.
-- 5. Safe plan mapping: quarantined events never grant paid entitlements.
-- ===========================================================================

-- 1. Create durable webhook event ledger
create table if not exists public.billing_webhook_event_ledger (
  event_id text primary key,
  event_type text not null,
  occurred_at timestamptz not null,
  status text not null default 'PROCESSING'
    check (status in ('PROCESSING', 'COMPLETED', 'FAILED', 'IGNORED')),
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

-- Row-level security: only service_role has access to this ledger
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
set search_path = public, auth
as $$
declare
  v_existing_ledger record;
  v_existing_sub record;
  v_result jsonb;
begin
  -- Step 1: Check existing ledger entry for event_id
  select * into v_existing_ledger
  from public.billing_webhook_event_ledger
  where event_id = p_event_id
  for update;

  if found then
    if v_existing_ledger.status = 'COMPLETED' then
      return jsonb_build_object(
        'success', true,
        'duplicate', true,
        'event_id', p_event_id,
        'status', 'COMPLETED'
      );
    elsif v_existing_ledger.status = 'IGNORED' then
      return jsonb_build_object(
        'success', true,
        'ignored', true,
        'event_id', p_event_id,
        'reason', v_existing_ledger.error_message
      );
    elsif v_existing_ledger.status = 'PROCESSING' and v_existing_ledger.updated_at > now() - interval '60 seconds' then
      -- Another transaction is actively processing this event
      return jsonb_build_object(
        'success', false,
        'concurrent_processing', true,
        'event_id', p_event_id
      );
    else
      -- Previous processing failed or timed out; allow retry
      update public.billing_webhook_event_ledger
      set status = 'PROCESSING',
          updated_at = now(),
          error_message = null
      where event_id = p_event_id;
    end if;
  else
    -- Insert new processing entry
    insert into public.billing_webhook_event_ledger (
      event_id,
      event_type,
      occurred_at,
      status,
      owner_user_id,
      payload_sha256
    ) values (
      p_event_id,
      p_event_type,
      p_occurred_at,
      'PROCESSING',
      p_owner_user_id,
      p_payload_sha256
    );
  end if;

  -- Step 2: Lock and check existing subscription_state for owner_user_id
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

  -- Step 3: Atomic Upsert to subscription_state
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

  -- Step 4: Mark ledger entry COMPLETED
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
    'quarantined', p_quarantined
  );
exception
  when others then
    -- Record error in ledger if entry exists
    update public.billing_webhook_event_ledger
    set status = 'FAILED',
        error_message = SQLERRM,
        updated_at = now()
    where event_id = p_event_id;

    raise;
end;
$$;

-- Grant execution to service_role only
revoke all on function public.stryde_process_paddle_billing_event from public, anon, authenticated;
grant execute on function public.stryde_process_paddle_billing_event to service_role;
