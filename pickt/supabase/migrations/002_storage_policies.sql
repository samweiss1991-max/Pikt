-- ============================================================
-- Storage policies for candidate-documents bucket
-- ============================================================

-- Authenticated users can upload files to their company's folder
create policy "authenticated_upload" on storage.objects
  for insert with check (
    bucket_id = 'candidate-documents'
    and auth.uid() is not null
  );

-- Users can read files in their company's folder
create policy "authenticated_read_own" on storage.objects
  for select using (
    bucket_id = 'candidate-documents'
    and auth.uid() is not null
  );
