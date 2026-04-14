-- ============================================================
-- Disputes — Migration 006
-- Dispute resolution for placement fees.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE dispute_reason AS ENUM (
    'Hired through different channel',
    'Candidate withdrew before offer',
    'Role was cancelled',
    'We already knew this candidate',
    'Other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM (
    'open',
    'under_review',
    'resolved_in_favour',
    'resolved_against',
    'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS dispute (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_id       uuid NOT NULL,
  company_id      uuid NOT NULL,
  reason          dispute_reason NOT NULL,
  notes           text NOT NULL CHECK (char_length(notes) >= 50),
  evidence_url    text,
  status          dispute_status NOT NULL DEFAULT 'open',
  admin_notes     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,

  CONSTRAINT fk_dispute_unlock
    FOREIGN KEY (unlock_id)
    REFERENCES candidate_unlock (id) ON DELETE CASCADE,
  CONSTRAINT fk_dispute_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dispute_company ON dispute (company_id);
CREATE INDEX IF NOT EXISTS idx_dispute_unlock ON dispute (unlock_id);
CREATE INDEX IF NOT EXISTS idx_dispute_status ON dispute (status);
CREATE INDEX IF NOT EXISTS idx_dispute_open ON dispute (status) WHERE status = 'open';

ALTER TABLE dispute ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispute_select_own" ON dispute
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "dispute_insert_own" ON dispute
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );
