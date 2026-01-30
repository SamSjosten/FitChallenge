-- =============================================================================
-- MIGRATION 004: ACTIVITY IDEMPOTENCY
-- Adds idempotency keys and atomic log_activity function
-- =============================================================================

-- =============================================================================
-- ADD IDEMPOTENCY COLUMNS
-- =============================================================================
alter table public.activity_logs
add column client_event_id uuid,
add column source_external_id text;

-- =============================================================================
-- PREVENT DUPLICATE MANUAL ENTRIES
-- =============================================================================
create unique index activity_logs_user_client_event_unique
on public.activity_logs (user_id, client_event_id)
where client_event_id is not null;

-- =============================================================================
-- PREVENT DUPLICATE HEALTH SYNC ENTRIES
-- =============================================================================
create unique index activity_logs_source_dedupe
on public.activity_logs (user_id, source, source_external_id)
where source_external_id is not null;

-- =============================================================================
-- ATOMIC LOG_ACTIVITY FUNCTION
-- Single transaction: insert log + update aggregation
-- =============================================================================
create or replace function public.log_activity(
  p_challenge_id uuid,
  p_activity_type text,
  p_value integer,
  p_recorded_at timestamptz,
  p_source text,
  p_client_event_id uuid default null,
  p_source_external_id text default null
)
returns void
language plpgsql
security invoker
as $$
begin
  -- Check challenge is active (not archived/completed/cancelled)
  if exists (
    select 1 from public.challenges c
    where c.id = p_challenge_id
      and c.status in ('archived', 'completed', 'cancelled')
  ) then
    raise exception 'challenge_not_active';
  end if;

  -- Validate participation (must be accepted)
  if not exists (
    select 1 from public.challenge_participants cp
    where cp.challenge_id = p_challenge_id
      and cp.user_id = auth.uid()
      and cp.invite_status = 'accepted'
  ) then
    raise exception 'not_participant';
  end if;

  -- Insert log (idempotency enforced by unique indexes)
  insert into public.activity_logs (
    challenge_id, user_id, activity_type, value, unit, recorded_at,
    source, client_event_id, source_external_id
  ) values (
    p_challenge_id, auth.uid(), p_activity_type::challenge_type, p_value,
    p_activity_type, p_recorded_at, p_source, p_client_event_id, p_source_external_id
  );

  -- Update aggregated counter atomically
  update public.challenge_participants
  set current_progress = current_progress + p_value,
      updated_at = now()
  where challenge_id = p_challenge_id
    and user_id = auth.uid()
    and invite_status = 'accepted';
end;
$$;

-- Set safe search path
alter function public.log_activity(uuid, text, integer, timestamptz, text, uuid, text)
set search_path = public;
