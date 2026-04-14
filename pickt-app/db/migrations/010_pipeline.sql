-- ============================================================
-- Pipeline Stage Tracker — Migration 010
-- Tracks buyer-side hiring pipeline stages per candidate.
-- ============================================================

-- 1. Pipeline stage enum
DO $$ BEGIN
  CREATE TYPE pipeline_stage AS ENUM (
    'unlocked',
    'contacted',
    'interview_scheduled',
    'interviewing',
    'offer_made',
    'hired',
    'passed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Pipeline events table (append-only activity log)
CREATE TABLE IF NOT EXISTS candidate_pipeline_event (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_id           uuid NOT NULL,
  candidate_id        uuid NOT NULL,
  company_id          uuid NOT NULL,
  stage               pipeline_stage NOT NULL,
  notes               text CHECK (notes IS NULL OR char_length(notes) <= 500),
  updated_by_user_id  uuid NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_pipeline_unlock
    FOREIGN KEY (unlock_id)
    REFERENCES candidate_unlock (id) ON DELETE CASCADE,
  CONSTRAINT fk_pipeline_candidate
    FOREIGN KEY (candidate_id)
    REFERENCES candidate_public (id) ON DELETE CASCADE,
  CONSTRAINT fk_pipeline_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pipeline_candidate
  ON candidate_pipeline_event (candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_company
  ON candidate_pipeline_event (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_unlock
  ON candidate_pipeline_event (unlock_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage
  ON candidate_pipeline_event (company_id, stage);

-- 3. Materialised view: current stage per candidate per company
CREATE MATERIALIZED VIEW IF NOT EXISTS candidate_current_stage AS
SELECT DISTINCT ON (candidate_id, company_id)
  candidate_id,
  company_id,
  unlock_id,
  stage,
  notes,
  created_at AS stage_updated_at
FROM candidate_pipeline_event
ORDER BY candidate_id, company_id, created_at DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_current_stage_pk
  ON candidate_current_stage (candidate_id, company_id);

CREATE OR REPLACE FUNCTION refresh_current_stages()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY candidate_current_stage;
END;
$$ LANGUAGE plpgsql;

-- 4. RLS
ALTER TABLE candidate_pipeline_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_select_own" ON candidate_pipeline_event
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "pipeline_insert_own" ON candidate_pipeline_event
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Referrer can see events on their candidates (stage only, no notes)
CREATE POLICY "pipeline_select_referrer" ON candidate_pipeline_event
  FOR SELECT USING (
    candidate_id IN (
      SELECT id FROM candidate_public
      WHERE uploaded_by_company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );
