-- ============================================================
-- Interview feedback — Migration 035
-- Requires migrations 026, 031 and 034.
--
-- Each company that refers a candidate gives its own feedback, so these fields
-- live on candidate_interviews, one row per company:
--   outcome, outcome_other           the Interview outcome dropdown
--   strengths_list, development_areas  chips, including any custom ones
--   note_impressed                   "What impressed you most?"
--   note_why_not_offer               "Why didn't they get the offer?"
--   note_best_fit                    "What kind of role or team would suit them best?"
--
-- Existing notes are copied into note_impressed. Nothing is deleted, and the old
-- columns stay filled while the site on master still uses them.
--
-- PRIVACY
--   candidate_interviews stays closed to browsers. Before unlocking, employers get
--   only: the first sentence of note_impressed (the card preview) and a yes/no for
--   Silver medallist, because that's a positive signal you asked to show. They never
--   get other outcomes, the other answers or the chips until they unlock.
--
-- Apply in the Supabase SQL editor. Runs as one transaction: if anything fails,
-- nothing changes. Safe to re-run. Ends with a report.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'candidates_public' AND column_name = 'experience_band') THEN
    RAISE EXCEPTION 'Not ready: run migration 034 first. Nothing was changed.';
  END IF;
END
$$;

ALTER TABLE candidate_interviews
  ADD COLUMN IF NOT EXISTS outcome             text,
  ADD COLUMN IF NOT EXISTS outcome_other       text,
  ADD COLUMN IF NOT EXISTS strengths_list      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS development_areas   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS note_impressed      text,
  ADD COLUMN IF NOT EXISTS note_why_not_offer  text,
  ADD COLUMN IF NOT EXISTS note_best_fit       text;

-- ------------------------------------------------------------
-- 1. Existing notes become answer (a): this company's feedback, then, for the
--    first referrer, any round-by-round notes from the old form.
-- ------------------------------------------------------------
UPDATE candidate_interviews ci
   SET note_impressed = nullif(btrim(concat_ws(E'\n\n',
         nullif(btrim(ci.feedback), ''),
         CASE WHEN ci.is_original_referral THEN (
           SELECT string_agg(btrim(n ->> 'note_text'), E'\n\n')
           FROM candidates c, jsonb_array_elements(
             CASE WHEN jsonb_typeof(to_jsonb(c.interview_notes)) = 'array' THEN to_jsonb(c.interview_notes) ELSE '[]'::jsonb END
           ) AS n
           WHERE c.id = ci.candidate_id AND nullif(btrim(n ->> 'note_text'), '') IS NOT NULL
         ) END
       )), '')
 WHERE ci.note_impressed IS NULL;

-- ------------------------------------------------------------
-- 2. Existing outcomes: a listed reason carries over; anything else becomes
--    "Other" with its wording kept as the description.
-- ------------------------------------------------------------
UPDATE candidate_interviews
   SET outcome = CASE
         WHEN outcome_reason IN ('Headcount freeze', 'Skills mismatch', 'Timing', 'Overqualified', 'Culture fit', 'Silver medallist') THEN outcome_reason
         ELSE 'Other'
       END,
       outcome_other = CASE
         WHEN outcome_reason IN ('Headcount freeze', 'Skills mismatch', 'Timing', 'Overqualified', 'Culture fit', 'Silver medallist', 'Other') THEN NULL
         ELSE outcome_reason
       END
 WHERE outcome IS NULL AND nullif(btrim(outcome_reason), '') IS NOT NULL;

ALTER TABLE candidate_interviews DROP CONSTRAINT IF EXISTS candidate_interviews_outcome_check;
ALTER TABLE candidate_interviews ADD CONSTRAINT candidate_interviews_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('Headcount freeze', 'Skills mismatch', 'Timing', 'Overqualified', 'Culture fit', 'Silver medallist', 'Other'));

-- ------------------------------------------------------------
-- 3. Saving a referral now includes the new fields
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_referral(
  p_candidate_id uuid,
  p_company_id   uuid,
  p_interview    jsonb,
  p_is_original  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_position     integer;
  v_rate         numeric;
  v_interview_id uuid;
BEGIN
  PERFORM 1 FROM candidates WHERE id = p_candidate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'candidate_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM candidate_referrers WHERE candidate_id = p_candidate_id AND company_id = p_company_id)
     OR EXISTS (SELECT 1 FROM candidate_interviews WHERE candidate_id = p_candidate_id AND employer_company_id = p_company_id) THEN
    RAISE EXCEPTION 'already_referred';
  END IF;

  IF EXISTS (SELECT 1 FROM hires WHERE candidate_id = p_candidate_id) THEN
    RAISE EXCEPTION 'already_hired';
  END IF;

  SELECT count(*)::integer + 1 INTO v_position FROM candidate_referrers WHERE candidate_id = p_candidate_id;
  SELECT referrer_rate INTO v_rate FROM commission_settings WHERE referrer_position = v_position;
  IF NOT FOUND THEN RAISE EXCEPTION 'referrals_full'; END IF;

  INSERT INTO candidate_interviews (
    candidate_id, employer_company_id, employer_industry, employer_location,
    stage_reached, interviews_completed, feedback, outcome_reason, is_original_referral,
    outcome, outcome_other, strengths_list, development_areas,
    note_impressed, note_why_not_offer, note_best_fit
  ) VALUES (
    p_candidate_id, p_company_id,
    p_interview ->> 'employer_industry', p_interview ->> 'employer_location',
    coalesce(p_interview ->> 'stage_reached', '1st phone screen'),
    coalesce((p_interview ->> 'interviews_completed')::integer, 0),
    p_interview ->> 'feedback', p_interview ->> 'outcome_reason', p_is_original,
    p_interview ->> 'outcome', p_interview ->> 'outcome_other',
    coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_interview -> 'strengths_list', '[]'::jsonb))), '{}'),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_interview -> 'development_areas', '[]'::jsonb))), '{}'),
    p_interview ->> 'note_impressed', p_interview ->> 'note_why_not_offer', p_interview ->> 'note_best_fit'
  ) RETURNING id INTO v_interview_id;

  INSERT INTO candidate_referrers (candidate_id, company_id, interview_id, referrer_position)
  VALUES (p_candidate_id, p_company_id, v_interview_id, v_position);

  RETURN jsonb_build_object('position', v_position, 'rate', v_rate);
END
$$;

-- ------------------------------------------------------------
-- 4. Marketplace view: the card preview becomes the first sentence (up to 120
--    characters), and a yes/no for Silver medallist is added at the end. Other
--    outcomes, the other answers and the chips are deliberately not here.
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
  CASE
    WHEN c.uploaded_by_company_id = current_company_id()
      OR EXISTS (SELECT 1 FROM candidate_referrers cr
                 WHERE cr.candidate_id = c.id AND cr.company_id = current_company_id())
    THEN NULL
    ELSE (SELECT coalesce(sum(s.referrer_rate + s.pickt_rate), 0)
          FROM commission_settings s
          WHERE s.referrer_position <= greatest(1, (SELECT count(*) FROM candidate_referrers cr WHERE cr.candidate_id = c.id)))
  END AS fee_percentage,
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
               'teaser', feedback_teaser(ci.feedback, 120)
             )
             ORDER BY ci.stage_rank DESC, ci.interviews_completed DESC, ci.created_at
           )
    FROM candidate_interviews ci
    WHERE ci.candidate_id = c.id
  ), '[]'::jsonb) AS interview_snapshot,
  (SELECT count(*) FROM candidate_referrers cr WHERE cr.candidate_id = c.id)::integer AS referrer_count,
  coalesce((
    SELECT jsonb_agg(co.name ORDER BY cr.referrer_position)
    FROM candidate_referrers cr
    JOIN companies co ON co.id = cr.company_id
    WHERE cr.candidate_id = c.id
  ), '[]'::jsonb) AS referrer_names,
  c.residency_status,
  c.experience_band,
  c.location_country_code,
  c.location_state_code,
  c.preferred_work_types,
  c.employment_types,
  c.notice_period_weeks,
  EXISTS (SELECT 1 FROM candidate_interviews ci
          WHERE ci.candidate_id = c.id AND ci.outcome = 'Silver medallist') AS is_silver_medallist
FROM candidates c;

REVOKE ALL ON candidates_public FROM PUBLIC, anon;
GRANT SELECT ON candidates_public TO authenticated;

COMMIT;

-- ------------------------------------------------------------
-- 5. Report
-- ------------------------------------------------------------
SELECT check_name, result FROM (
  SELECT 1 AS ord, 'Interview rows' AS check_name, count(*)::text AS result FROM candidate_interviews
  UNION ALL SELECT 2, 'With answer (a) filled from existing notes', count(*)::text FROM candidate_interviews WHERE note_impressed IS NOT NULL
  UNION ALL SELECT 3, 'With an outcome', count(*)::text FROM candidate_interviews WHERE outcome IS NOT NULL
  UNION ALL SELECT 4, 'Private fields visible in marketplace view (must be 0)', count(*)::text
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'candidates_public'
     AND column_name IN ('outcome', 'outcome_other', 'strengths_list', 'development_areas', 'note_impressed', 'note_why_not_offer', 'note_best_fit', 'visa_type')
) report ORDER BY ord;
