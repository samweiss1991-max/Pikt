-- ============================================================
-- Shortlist Redesign — Migration 012
-- Ensures shortlist table matches the expanded card spec.
-- The shortlist table was created in candidate_engagement.sql
-- but this migration ensures the status enum and reviewed_at
-- column exist.
-- ============================================================

-- Add reviewed_at column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shortlist' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE shortlist ADD COLUMN reviewed_at timestamptz;
  END IF;
END $$;

-- Update status check constraint to include all required values
-- (drop old constraint if exists, re-add)
DO $$
BEGIN
  ALTER TABLE shortlist DROP CONSTRAINT IF EXISTS shortlist_status_check;
  ALTER TABLE shortlist ADD CONSTRAINT shortlist_status_check
    CHECK (status IN ('pending_review', 'kept', 'removed', 'active'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Index for badge count query (pending_review by company)
CREATE INDEX IF NOT EXISTS idx_shortlist_pending_company
  ON shortlist (company_id) WHERE status = 'pending_review';
