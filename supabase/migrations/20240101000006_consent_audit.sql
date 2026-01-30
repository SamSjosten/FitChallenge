-- =============================================================================
-- MIGRATION 006: CONSENT & AUDIT
-- GDPR compliance tables
-- =============================================================================

-- =============================================================================
-- CONSENT RECORDS
-- =============================================================================
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  consent_type text not null check (
    consent_type in ('terms_of_service', 'privacy_policy', 'health_data', 
                     'push_notifications', 'analytics', 'personalized_ads')
  ),
  granted boolean not null,
  consent_version text not null,
  created_at timestamptz default now()
);

create index idx_consent_user_type on public.consent_records(user_id, consent_type, created_at desc);

-- =============================================================================
-- AUDIT LOG
-- NOTE: ip_address intentionally omitted to minimize privacy liability
-- =============================================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

create index idx_audit_user on public.audit_log(user_id, created_at desc);

-- =============================================================================
-- AUDIT HELPER FUNCTION
-- =============================================================================
create or replace function public.record_audit(
  p_user_id uuid,
  p_action text,
  p_details jsonb default null
)
returns void as $$
begin
  insert into public.audit_log (user_id, action, details)
  values (p_user_id, p_action, p_details);
end;
$$ language plpgsql security definer;

alter function public.record_audit(uuid, text, jsonb)
set search_path = public;
