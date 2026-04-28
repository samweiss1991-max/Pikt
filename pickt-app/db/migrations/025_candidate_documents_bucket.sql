-- ============================================================
-- Candidate documents storage bucket — Migration 025
-- Provisions the private `candidate-documents` storage bucket
-- referenced by Refer.jsx (CV/cover letter/additional uploads)
-- and the parse-cv edge function.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('candidate-documents', 'candidate-documents', false)
on conflict (id) do nothing;

-- Open upload + read policies (dev-friendly)
-- TODO: tighten to `to authenticated` once auth flow is fully wired and stable
drop policy if exists "auth users can upload candidate docs" on storage.objects;
drop policy if exists "anyone can upload candidate docs" on storage.objects;
create policy "anyone can upload candidate docs"
  on storage.objects for insert
  to public
  with check (bucket_id = 'candidate-documents');

drop policy if exists "auth users can read candidate docs" on storage.objects;
drop policy if exists "anyone can read candidate docs" on storage.objects;
create policy "anyone can read candidate docs"
  on storage.objects for select
  to public
  using (bucket_id = 'candidate-documents');
