-- ============================================================
-- Similar Candidates — Migration 013
-- Composite index and scoring function for recommendations.
-- ============================================================

-- Composite index for similarity queries
CREATE INDEX IF NOT EXISTS idx_candidate_public_similar
  ON candidate_public (seniority_level, location_city, status);

-- Function: find similar candidates with weighted scoring
CREATE OR REPLACE FUNCTION find_similar_candidates_scored(
  p_candidate_id uuid,
  p_limit integer DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  role_applied_for varchar,
  seniority_level seniority_level,
  location_city varchar,
  current_company_name varchar,
  skills text[],
  interview_count integer,
  salary_band_low integer,
  salary_band_high integer,
  fee_percentage numeric,
  years_experience integer,
  referred_at timestamptz,
  top_skills jsonb,
  availability_status availability_status,
  similarity_score integer
) AS $$
  SELECT
    cp2.id,
    cp2.role_applied_for,
    cp2.seniority_level,
    cp2.location_city,
    cp2.current_company_name,
    cp2.skills,
    cp2.interview_count,
    cp2.salary_band_low,
    cp2.salary_band_high,
    cp2.fee_percentage,
    cp2.years_experience,
    cp2.referred_at,
    cp2.top_skills,
    cp2.availability_status,
    (
      CASE WHEN cp2.seniority_level = cp1.seniority_level THEN 30 ELSE 0 END +
      CASE WHEN cp2.location_city = cp1.location_city THEN 20 ELSE 0 END +
      (SELECT COUNT(*) FROM unnest(cp2.skills) s
       WHERE s = ANY(cp1.skills))::integer * 10 +
      CASE WHEN cp2.salary_band_low IS NOT NULL
        AND cp1.salary_band_low IS NOT NULL
        AND cp2.salary_band_low BETWEEN (cp1.salary_band_low * 0.8)::integer
          AND (cp1.salary_band_high * 1.2)::integer
        THEN 10 ELSE 0 END
    )::integer AS similarity_score
  FROM candidate_public cp2
  CROSS JOIN candidate_public cp1
  WHERE cp1.id = p_candidate_id
    AND cp2.id != p_candidate_id
    AND cp2.status = 'listed'
    AND cp2.availability_status = 'available'
  ORDER BY similarity_score DESC, cp2.referred_at DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;
