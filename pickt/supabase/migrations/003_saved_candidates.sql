-- ============================================================
-- Saved Candidates table
-- ============================================================

create table saved_candidates (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates (id) on delete cascade,
  company_id    uuid not null references companies (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (candidate_id, company_id, user_id)
);

create index idx_saved_candidates_user on saved_candidates (user_id);
create index idx_saved_candidates_company on saved_candidates (company_id);

-- ── RLS ─────────────────────────────────────────────────────

alter table saved_candidates enable row level security;

-- Users can read their own company's saved candidates
create policy "saved_select_own" on saved_candidates
  for select using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- Users can insert saves for their own company
create policy "saved_insert_own" on saved_candidates
  for insert with check (
    user_id = auth.uid()
    and company_id in (select company_id from users where id = auth.uid())
  );

-- Users can delete their own saves
create policy "saved_delete_own" on saved_candidates
  for delete using (
    user_id = auth.uid()
  );
