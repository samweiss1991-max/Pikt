-- ============================================================
-- Deduplication — Migration 003
-- Fuzzy-match similarity search using pg_trgm.
-- ============================================================

-- 1. Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Trigram index for similarity search on candidate_public
CREATE INDEX IF NOT EXISTS idx_candidate_similarity
  ON candidate_public USING gin(
    (coalesce(role_applied_for, '') || ' ' ||
     coalesce(location_city, '') || ' ' ||
     coalesce(current_company_name, ''))
    gin_trgm_ops
  );

-- 3. Resolution enum
DO $$ BEGIN
  CREATE TYPE duplicate_resolution AS ENUM (
    'different_person',
    'same_person_withdrawn',
    'support_contacted',
    'ignored'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Duplicate check log table
CREATE TABLE IF NOT EXISTS duplicate_check_log (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitting_company_id           uuid NOT NULL,
  potential_duplicate_candidate_id uuid NOT NULL,
  similarity_score                numeric(4,3) NOT NULL
                                  CHECK (similarity_score >= 0 AND similarity_score <= 1),
  resolution                      duplicate_resolution,
  resolved_at                     timestamptz,
  created_at                      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_dedup_company
    FOREIGN KEY (submitting_company_id)
    REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT fk_dedup_candidate
    FOREIGN KEY (potential_duplicate_candidate_id)
    REFERENCES candidate_public (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dedup_company
  ON duplicate_check_log (submitting_company_id);
CREATE INDEX IF NOT EXISTS idx_dedup_candidate
  ON duplicate_check_log (potential_duplicate_candidate_id);
CREATE INDEX IF NOT EXISTS idx_dedup_score
  ON duplicate_check_log (similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_dedup_unresolved
  ON duplicate_check_log (resolution) WHERE resolution IS NULL;

-- 5. RLS
ALTER TABLE duplicate_check_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dedup_insert_authenticated" ON duplicate_check_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "dedup_select_own" ON duplicate_check_log
  FOR SELECT USING (
    submitting_company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "dedup_update_own" ON duplicate_check_log
  FOR UPDATE USING (
    submitting_company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- 6. Helper function: find similar candidates using trigram similarity
CREATE OR REPLACE FUNCTION find_similar_candidates(
  p_role text,
  p_city text,
  p_company text,
  p_threshold numeric DEFAULT 0.6,
  p_limit integer DEFAULT 3
)
RETURNS TABLE (
  candidate_id uuid,
  role_applied_for varchar,
  location_city varchar,
  current_company_name varchar,
  referred_at timestamptz,
  uploaded_by_company_id uuid,
  similarity_score numeric
) AS $$
  SELECT
    cp.id,
    cp.role_applied_for,
    cp.location_city,
    cp.current_company_name,
    cp.referred_at,
    cp.uploaded_by_company_id,
    similarity(
      coalesce(cp.role_applied_for, '') || ' ' ||
      coalesce(cp.location_city, '') || ' ' ||
      coalesce(cp.current_company_name, ''),
      coalesce(p_role, '') || ' ' ||
      coalesce(p_city, '') || ' ' ||
      coalesce(p_company, '')
    )::numeric(4,3) AS similarity_score
  FROM candidate_public cp
  WHERE cp.status = 'listed'
    AND similarity(
      coalesce(cp.role_applied_for, '') || ' ' ||
      coalesce(cp.location_city, '') || ' ' ||
      coalesce(cp.current_company_name, ''),
      coalesce(p_role, '') || ' ' ||
      coalesce(p_city, '') || ' ' ||
      coalesce(p_company, '')
    ) > p_threshold
  ORDER BY similarity_score DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;
