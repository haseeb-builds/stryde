-- Persisted working-state projection for the adaptive Work Controller.
alter table public.conversation_session
  add column if not exists working_state jsonb;
