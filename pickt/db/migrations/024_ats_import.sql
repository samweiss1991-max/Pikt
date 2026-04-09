-- ============================================================
-- ATS Import — Migration 024
-- Tracks bulk and individual ATS imports.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE ats_import_status AS ENUM ('pending', 'success', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ats_import_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL,
  ats_provider          ats_provider NOT NULL,
  job_id_in_ats         text,
  candidate_ids         uuid[] NOT NULL,
  status                ats_import_status NOT NULL DEFAULT 'pending',
  imported_count        integer NOT NULL DEFAULT 0,
  skipped_count         integer NOT NULL DEFAULT 0,
  error_message         text,
  triggered_by_user_id  uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_ats_import_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ats_import_company
  ON ats_import_log (company_id, created_at DESC);

-- Add ats_synced_at to candidate_unlock if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_unlock' AND column_name = 'ats_synced_at'
  ) THEN
    ALTER TABLE candidate_unlock ADD COLUMN ats_synced_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_unlock' AND column_name = 'ats_candidate_id_external'
  ) THEN
    ALTER TABLE candidate_unlock ADD COLUMN ats_candidate_id_external text;
  END IF;
END $$;

-- RLS
ALTER TABLE ats_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ats_import_select_own" ON ats_import_log
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "ats_import_insert_service" ON ats_import_log
  FOR INSERT WITH CHECK (true);
