-- ============================================================
-- Pickt Marketplace — Initial Schema (v2)
-- Run in the Supabase SQL Editor
-- ============================================================

-- 0. Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. Tables
-- ============================================================

create table companies (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  industry          text,
  website           text,
  logo_url          text,
  plan              text not null default 'free'
                    check (plan in ('free','starter','pro','enterprise')),
  ats_connection_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table users (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies (id) on delete cascade,
  email       text unique not null,
  full_name   text,
  role        text not null default 'member'
              check (role in ('admin','member','viewer')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table candidates (
  id                        uuid primary key default gen_random_uuid(),
  uploaded_by_company_id    uuid not null references companies (id) on delete cascade,

  -- Industry & role
  industry                  text,
  role_applied_for          text,
  seniority_level           text,
  years_experience          integer,
  skills                    text[],
  employment_type           text,
  salary_expectation_min    numeric,
  salary_expectation_max    numeric,
  notice_period_days        integer,
  available_from            date,

  -- Location & demographics
  location_city             text,
  location_state            text,
  location_country          text,
  residency_status          text,
  visa_type                 text,
  nationality               text,
  work_rights_verified      boolean default false,
  preferred_work_type       text,
  willing_to_relocate       boolean default false,
  gender                    text,
  date_of_birth             date,

  -- Application data
  date_of_application       date,
  source_of_application     text,
  ats_candidate_id          text,
  ats_platform              text,
  interview_stage_reached   text,
  interviews_completed      integer default 0,
  why_not_hired             text,
  recommendation            text,

  -- Interview feedback
  strengths                 text,
  gaps                      text,
  feedback_summary          text,
  interview_notes           jsonb,       -- [{round_number, interviewer_role, outcome, note_text, score, date}]
  skill_ratings             jsonb,

  -- PII fields (nulled in public view)
  full_name                 text,
  email                     text,
  mobile_number             text,
  linkedin_url              text,
  portfolio_url             text,
  current_employer          text,
  current_job_title         text,

  -- CV & documents
  cv_file_url               text,
  cv_filename               text,
  cover_letter_url          text,
  additional_documents      jsonb,

  -- Referral metadata (used by ranking & cards)
  referred_at               timestamptz default now(),
  referring_company         text,

  -- pickt metadata
  fee_percentage            numeric not null default 8
                            check (fee_percentage >= 0 and fee_percentage <= 100),
  pii_redacted              boolean not null default true,
  status                    text not null default 'available'
                            check (status in ('available','unlocked','placed','withdrawn')),
  source                    text
                            check (source is null or source in ('extension','upload_form','api_direct')),
  consent_given             boolean default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table candidate_unlocks (
  id                      uuid primary key default gen_random_uuid(),
  candidate_id            uuid not null references candidates (id) on delete cascade,
  requesting_company_id   uuid not null references companies (id) on delete cascade,
  status                  text not null default 'pending'
                          check (status in ('pending','approved','rejected')),
  ats_candidate_id        text,
  unlocked_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Prevent duplicate unlocks for the same candidate by the same company
  unique (candidate_id, requesting_company_id)
);

create table placements (
  id                       uuid primary key default gen_random_uuid(),
  unlock_id                uuid not null references candidate_unlocks (id) on delete cascade,
  outcome                  text,
  hired_at                 timestamptz,
  first_year_salary        numeric,
  placement_fee_percentage numeric,
  placement_fee_amount     numeric,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table transactions (
  id                uuid primary key default gen_random_uuid(),
  placement_id      uuid not null references placements (id) on delete cascade,
  platform_cut      numeric,
  company_payout    numeric,
  stripe_payment_id text,
  status            text not null default 'pending'
                    check (status in ('pending','processing','completed','failed','refunded')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- 2. updated_at trigger
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_companies_updated_at         before update on companies         for each row execute function set_updated_at();
create trigger trg_users_updated_at             before update on users             for each row execute function set_updated_at();
create trigger trg_candidates_updated_at        before update on candidates        for each row execute function set_updated_at();
create trigger trg_candidate_unlocks_updated_at before update on candidate_unlocks for each row execute function set_updated_at();
create trigger trg_placements_updated_at        before update on placements        for each row execute function set_updated_at();
create trigger trg_transactions_updated_at      before update on transactions      for each row execute function set_updated_at();

-- ============================================================
-- 3. Indexes (all FK columns)
-- ============================================================

create index idx_users_company          on users (company_id);
create index idx_candidates_company     on candidates (uploaded_by_company_id);
create index idx_candidates_industry    on candidates (industry);
create index idx_candidates_status      on candidates (status);
create index idx_unlocks_candidate      on candidate_unlocks (candidate_id);
create index idx_unlocks_company        on candidate_unlocks (requesting_company_id);
create index idx_placements_unlock      on placements (unlock_id);
create index idx_transactions_placement on transactions (placement_id);

-- ============================================================
-- 4. Anonymised public view (security definer)
--
--    This view runs as the table OWNER, bypassing RLS.
--    Since we do NOT have a broad "authenticated can SELECT
--    candidates" policy, this is the ONLY way non-owning
--    companies can read candidate data — and PII is nulled.
-- ============================================================

create view candidates_public
  with (security_invoker = false)      -- = security definer
as
select
  id,
  uploaded_by_company_id,

  -- Industry & role (visible)
  industry,
  role_applied_for,
  seniority_level,
  years_experience,
  skills,
  employment_type,
  salary_expectation_min,
  salary_expectation_max,
  notice_period_days,
  available_from,

  -- Location (visible, except PII)
  location_city,
  location_state,
  location_country,
  residency_status,
  visa_type,
  nationality,
  work_rights_verified,
  preferred_work_type,
  willing_to_relocate,
  null::text    as gender,
  null::date    as date_of_birth,

  -- Application data (visible)
  date_of_application,
  source_of_application,
  ats_candidate_id,
  ats_platform,
  interview_stage_reached,
  interviews_completed,
  why_not_hired,
  recommendation,

  -- Interview feedback (visible)
  strengths,
  gaps,
  feedback_summary,
  interview_notes,
  skill_ratings,

  -- PII fields → nulled
  null::text    as full_name,
  null::text    as email,
  null::text    as mobile_number,
  null::text    as linkedin_url,
  null::text    as portfolio_url,
  null::text    as current_employer,
  null::text    as current_job_title,

  -- CV & documents → nulled
  null::text    as cv_file_url,
  null::text    as cv_filename,
  null::text    as cover_letter_url,
  null::jsonb   as additional_documents,

  -- Referral metadata (visible)
  referred_at,
  referring_company,

  -- pickt metadata (visible)
  fee_percentage,
  pii_redacted,
  status,
  source,
  consent_given,
  created_at

from candidates
where status = 'available';   -- only show available candidates in marketplace

-- Grant authenticated users access to the view
grant select on candidates_public to authenticated;

-- ============================================================
-- 5. Row Level Security
-- ============================================================

alter table companies         enable row level security;
alter table users             enable row level security;
alter table candidates        enable row level security;
alter table candidate_unlocks enable row level security;
alter table placements        enable row level security;
alter table transactions      enable row level security;

-- ── companies ────────────────────────────────────────────────

-- Users can read their own company row
create policy "companies_select_own" on companies
  for select using (
    id in (select company_id from users where id = auth.uid())
  );

-- Users can update their own company row
create policy "companies_update_own" on companies
  for update using (
    id in (select company_id from users where id = auth.uid())
  );

-- Allow insert during signup (user doesn't have a users row yet)
create policy "companies_insert_authenticated" on companies
  for insert with check (auth.uid() is not null);

-- ── users ────────────────────────────────────────────────────

-- Users can read fellow members of their company
create policy "users_select_same_company" on users
  for select using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- Allow insert during signup (must be inserting their own auth id)
create policy "users_insert_self" on users
  for insert with check (id = auth.uid());

-- Users can update their own row
create policy "users_update_self" on users
  for update using (id = auth.uid());

-- ── candidates ───────────────────────────────────────────────
-- NOTE: There is intentionally NO broad "authenticated can SELECT"
-- policy. Non-owning companies access candidates ONLY through the
-- security-definer `candidates_public` view, which nulls PII.

-- Uploading company: full CRUD on their own candidates
create policy "candidates_select_own" on candidates
  for select using (
    uploaded_by_company_id in (select company_id from users where id = auth.uid())
  );

create policy "candidates_insert_own" on candidates
  for insert with check (
    uploaded_by_company_id in (select company_id from users where id = auth.uid())
  );

create policy "candidates_update_own" on candidates
  for update using (
    uploaded_by_company_id in (select company_id from users where id = auth.uid())
  );

create policy "candidates_delete_own" on candidates
  for delete using (
    uploaded_by_company_id in (select company_id from users where id = auth.uid())
  );

-- ── candidate_unlocks ────────────────────────────────────────

-- Requesting company sees their own unlocks
create policy "unlocks_select_own" on candidate_unlocks
  for select using (
    requesting_company_id in (select company_id from users where id = auth.uid())
  );

-- Requesting company can create unlock requests
create policy "unlocks_insert_own" on candidate_unlocks
  for insert with check (
    requesting_company_id in (select company_id from users where id = auth.uid())
  );

-- Uploading company sees unlocks on their candidates
create policy "unlocks_select_uploader" on candidate_unlocks
  for select using (
    candidate_id in (
      select id from candidates
      where uploaded_by_company_id in (select company_id from users where id = auth.uid())
    )
  );

-- ── placements ───────────────────────────────────────────────

-- Visible to both sides of the unlock
create policy "placements_select_involved" on placements
  for select using (
    unlock_id in (
      select cu.id from candidate_unlocks cu
      join candidates c on c.id = cu.candidate_id
      where cu.requesting_company_id in (select company_id from users where id = auth.uid())
         or c.uploaded_by_company_id  in (select company_id from users where id = auth.uid())
    )
  );

-- ── transactions ─────────────────────────────────────────────

-- Visible to both sides of the placement
create policy "transactions_select_involved" on transactions
  for select using (
    placement_id in (
      select p.id from placements p
      join candidate_unlocks cu on cu.id = p.unlock_id
      join candidates c on c.id = cu.candidate_id
      where cu.requesting_company_id in (select company_id from users where id = auth.uid())
         or c.uploaded_by_company_id  in (select company_id from users where id = auth.uid())
    )
  );
