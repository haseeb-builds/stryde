alter table public.run add column if not exists failure_reason text;

comment on column public.run.failure_reason is 'Human-readable reason recorded when a Run enters FAILED state.';
