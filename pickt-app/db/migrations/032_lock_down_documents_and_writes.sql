-- ============================================================
-- Lock down documents and candidate records — Migration 032
-- Requires migration 031.
--
-- WHO CAN DO WHAT
--   * CVs and documents: nobody can read them directly, logged in or not. A CV is
--     only reachable through the cv-url server function, which checks the viewer
--     is that candidate's referrer or an employer who has unlocked them.
--   * Uploads: logged-in users only, into their own folder.
--   * Candidate records: browsers can read what their rules allow, but can't add,
--     change or delete anything. Hirers can't change a candidate at all, and
--     referrers have no way to edit one until the candidate-approval process exists.
--
-- Existing files are kept. Old access rules are copied into a private backup
-- table first, so they can be restored if needed.
--
-- Apply in the Supabase SQL editor. Runs as one transaction: if anything fails,
-- nothing changes. Safe to re-run. Ends by listing the rules now in place.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Keep a private copy of the old rules
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage_policy_backup_032 (
  policyname  text,
  cmd         text,
  roles       text,
  qual        text,
  with_check  text,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE storage_policy_backup_032 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON storage_policy_backup_032 FROM PUBLIC, anon, authenticated;

INSERT INTO storage_policy_backup_032 (policyname, cmd, roles, qual, with_check)
SELECT policyname, cmd, roles::text, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (qual ILIKE '%candidate-documents%' OR with_check ILIKE '%candidate-documents%');

-- ------------------------------------------------------------
-- 2. Remove every rule on this bucket, then allow uploads only
-- ------------------------------------------------------------
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%candidate-documents%' OR with_check ILIKE '%candidate-documents%')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END
$$;

UPDATE storage.buckets SET public = false WHERE id = 'candidate-documents';

-- Own folder: uploads/<user id>/<file>.
-- TEMPORARY: the flat uploads/<number>_<file> form is what the version of the site
-- on master still uses. Remove that line once this branch is live.
CREATE POLICY "logged in users upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'candidate-documents'
    AND (
      (storage.foldername(name))[1] = 'uploads' AND (storage.foldername(name))[2] = auth.uid()::text
      OR name ~ '^uploads/[0-9]+_[^/]+$'
    )
  );

-- No SELECT, UPDATE or DELETE rule: browsers can't read, replace or remove files.

-- ------------------------------------------------------------
-- 3. Candidate records can't be changed from a browser
--    Every change goes through a server function.
-- ------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON candidates FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON candidate_unlocks FROM PUBLIC, anon, authenticated;

COMMIT;

-- ------------------------------------------------------------
-- 4. What's in place now
-- ------------------------------------------------------------
SELECT 'Access rule' AS type, policyname AS name, cmd AS action, roles::text AS who
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (qual ILIKE '%candidate-documents%' OR with_check ILIKE '%candidate-documents%')
UNION ALL
SELECT 'Bucket public?', public::text, NULL, NULL FROM storage.buckets WHERE id = 'candidate-documents'
UNION ALL
SELECT 'Files kept', count(*)::text, NULL, NULL FROM storage.objects WHERE bucket_id = 'candidate-documents';
