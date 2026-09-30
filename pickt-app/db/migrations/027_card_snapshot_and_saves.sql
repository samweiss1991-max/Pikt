-- ============================================================
-- Card interview snapshot + saved candidates — Migration 027
-- Requires migration 026.
--
-- 1. candidates_public gains `interview_snapshot`: for each employer that
--    interviewed the candidate, ONLY the description (industry · location),
--    stage reached, interview count and a ~55-character teaser. Never the
--    employer's name, full feedback or outcome reason.
-- 2. saved_candidates: each company's saved candidates ("Save" on the card,
--    shown on the Pickt List page). Companies only see their own saves.
--
-- Apply in the Supabase SQL editor after 026. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Interview snapshot on the marketplace view
--    (CREATE OR REPLACE may add a column at the end; existing columns
--    are unchanged from migration 026.)
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW candidates_public WITH (security_barrier = true) AS
SELECT
  c.id,
  c.uploaded_by_company_id,
  c.referring_company,
  c.industry,
  c.role_applied_for,
  c.seniority_level,
  c.years_experience,
  c.location_city,
  c.location_state,
  c.location_country,
  c.preferred_work_type,
  c.willing_to_relocate,
  c.employment_type,
  c.notice_period_days,
  c.available_from,
  c.salary_expectation_min,
  c.salary_expectation_max,
  c.skills,
  c.interview_stage_reached,
  c.interviews_completed,
  c.fee_percentage,
  c.status,
  c.referred_at,
  c.created_at,
  c.last_active_at,
  c.open_to_offers,
  (SELECT count(*) FROM candidate_interviews ci WHERE ci.candidate_id = c.id)::integer AS employers_count,
  coalesce((
    SELECT jsonb_agg(
             jsonb_build_object(
               'description', coalesce(nullif(concat_ws(' · ', ci.employer_industry, ci.employer_location), ''), 'Employer'),
               'stage', ci.stage_reached,
               'stage_rank', ci.stage_rank,
               'interviews', ci.interviews_completed,
               'teaser', feedback_teaser(ci.feedback, 55)
             )
             ORDER BY ci.stage_rank DESC, ci.interviews_completed DESC, ci.created_at
           )
    FROM candidate_interviews ci
    WHERE ci.candidate_id = c.id
  ), '[]'::jsonb) AS interview_snapshot
FROM candidates c;

GRANT SELECT ON candidates_public TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. Saved candidates (per company)
-- ------------------------------------------------------------

-- The signed-in user's company (used as a column default and in policies)
CREATE OR REPLACE FUNCTION current_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM users WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION current_company_id() TO authenticated;

CREATE TABLE IF NOT EXISTS saved_candidates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  uuid NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
  company_id    uuid NOT NULL DEFAULT current_company_id() REFERENCES companies (id) ON DELETE CASCADE,
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_saved_candidate_company UNIQUE (candidate_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_candidates_company ON saved_candidates (company_id, created_at DESC);

ALTER TABLE saved_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_select_own_company" ON saved_candidates;
CREATE POLICY "saved_select_own_company" ON saved_candidates
  FOR SELECT USING (company_id = current_company_id());

DROP POLICY IF EXISTS "saved_insert_own_company" ON saved_candidates;
CREATE POLICY "saved_insert_own_company" ON saved_candidates
  FOR INSERT WITH CHECK (company_id = current_company_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "saved_delete_own_company" ON saved_candidates;
CREATE POLICY "saved_delete_own_company" ON saved_candidates
  FOR DELETE USING (company_id = current_company_id());

GRANT SELECT, INSERT, DELETE ON saved_candidates TO authenticated;
