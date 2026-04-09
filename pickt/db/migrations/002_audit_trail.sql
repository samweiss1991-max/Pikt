-- ============================================================
-- Audit Trail — Migration 002
-- Append-only, immutable event log for compliance and analytics.
-- ============================================================

-- 1. Event type enum
DO $$ BEGIN
  CREATE TYPE audit_event_type AS ENUM (
    'profile_viewed',
    'profile_unlocked',
    'pii_accessed',
    'cv_downloaded',
    'candidate_contacted',
    'pipeline_stage_changed',
    'placement_confirmed',
    'fee_disputed',
    'shortlist_added',
    'shortlist_removed',
    'similar_candidate_clicked',
    'ats_import_triggered'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        audit_event_type NOT NULL,
  actor_company_id  uuid NOT NULL,
  actor_user_id     uuid NOT NULL,
  candidate_id      uuid,
  ip_address        inet,
  user_agent        text,
  session_id        varchar,
  metadata          jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type
  ON audit_log (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_company
  ON audit_log (actor_company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_candidate
  ON audit_log (candidate_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user
  ON audit_log (actor_user_id);

-- Composite index for filtered admin queries
CREATE INDEX IF NOT EXISTS idx_audit_log_type_date
  ON audit_log (event_type, created_at DESC);

-- 4. Immutability trigger — prevents UPDATE and DELETE
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_immutable ON audit_log;
CREATE TRIGGER audit_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- 5. Row Level Security
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Application role can INSERT only
CREATE POLICY "audit_insert_only" ON audit_log
  FOR INSERT WITH CHECK (true);

-- Admin read access (company sees their own audit entries)
CREATE POLICY "audit_select_own_company" ON audit_log
  FOR SELECT USING (
    actor_company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Uploading company can see audit events on their candidates
CREATE POLICY "audit_select_candidate_owner" ON audit_log
  FOR SELECT USING (
    candidate_id IN (
      SELECT id FROM candidate_public
      WHERE uploaded_by_company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- 6. Revoke UPDATE/DELETE at role level for defense in depth
-- (Trigger catches it, but belt-and-suspenders)
DO $$
BEGIN
  -- Only revoke if the role exists (handles fresh installs)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE UPDATE, DELETE ON audit_log FROM authenticated;
  END IF;
END $$;
