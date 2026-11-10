-- ============================================================
-- Candidate consent — Migration 040 (Stage 5A)
-- Requires migration 039.
--
-- A referred candidate is now emailed to confirm before their profile goes live.
--   awaiting  referred, waiting for the candidate (hidden from the marketplace)
--   live      the candidate said yes (in the marketplace)
--   declined  the candidate said no: personal details removed, can't be referred again
--   expired   no answer after 30 days: personal details removed
--   removed   the candidate removed their profile later (Stage 5B)
--
-- Candidates already on Pickt are marked live, so nothing changes for them.
--
-- Apply in the Supabase SQL editor. Runs as one transaction: if anything fails,
-- nothing changes. Safe to re-run. Ends with a report.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_unlocks' AND column_name = 'contacted_at') THEN
    RAISE EXCEPTION 'Not ready: run migration 039 first. Nothing was changed.';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 1. Consent status on each candidate
-- ------------------------------------------------------------
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS consent_status text NOT NULL DEFAULT 'live';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS consent_decided_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidates_consent_status_check') THEN
    ALTER TABLE candidates ADD CONSTRAINT candidates_consent_status_check
      CHECK (consent_status IN ('awaiting', 'live', 'declined', 'expired', 'removed'));
  END IF;
END
$$;
-- New referrals start as awaiting (set by the server); the default only covers
-- rows that already existed, which stay live
CREATE INDEX IF NOT EXISTS idx_candidates_consent_status ON candidates (consent_status);

-- ------------------------------------------------------------
-- 2. The emailed confirmation link (one per candidate, replaced when re-sent)
--    Only a hash of the link's secret is stored.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_consent_requests (
  candidate_id      uuid PRIMARY KEY REFERENCES candidates (id) ON DELETE CASCADE,
  token_hash        text NOT NULL UNIQUE,
  -- The link from the email before, which keeps working after a reminder
  previous_token_hash text,
  site_url          text NOT NULL,
  first_sent_at     timestamptz NOT NULL DEFAULT now(),
  last_sent_at      timestamptz NOT NULL DEFAULT now(),
  reminder_sent_at  timestamptz,
  email_error       text,
  decided_at        timestamptz,
  decision          text CHECK (decision IN ('yes', 'no', 'expired'))
);
ALTER TABLE candidate_consent_requests ADD COLUMN IF NOT EXISTS previous_token_hash text;
CREATE INDEX IF NOT EXISTS idx_consent_previous_token ON candidate_consent_requests (previous_token_hash);
ALTER TABLE candidate_consent_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON candidate_consent_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON candidate_consent_requests TO service_role;

-- ------------------------------------------------------------
-- 3. Nobody can refer someone who said no (or removed their profile)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_referral_needs_consent()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM candidates WHERE id = NEW.candidate_id AND consent_status IN ('declined', 'expired', 'removed')) THEN
    RAISE EXCEPTION 'candidate_unavailable';
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS referral_needs_consent ON candidate_referrers;
CREATE TRIGGER referral_needs_consent BEFORE INSERT ON candidate_referrers
  FOR EACH ROW EXECUTE FUNCTION trg_referral_needs_consent();

-- ------------------------------------------------------------
-- 4. Removing a candidate's personal details (No, no answer, or removed later).
--    Keeps a bare record (role and status) so referrers see what happened.
--    p_keep_identity: keep the scrambled email/mobile so they can't be referred
--    again (used when they said no). Documents are deleted by the server.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION scrub_candidate(p_candidate uuid, p_status text, p_keep_identity boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  col text;
  personal text[] := ARRAY[
    'full_name', 'email', 'mobile_number', 'linkedin_url', 'portfolio_url', 'current_employer', 'current_job_title',
    'cv_file_url', 'cv_filename', 'cover_letter_url', 'additional_documents', 'date_of_birth', 'gender', 'nationality',
    'visa_type', 'residency_status', 'interview_notes', 'feedback_summary', 'strengths', 'gaps', 'why_not_hired',
    'recommendation', 'skill_ratings', 'ats_candidate_id', 'ats_platform', 'embedding', 'location_city', 'location_state',
    'location_state_code', 'location_country', 'location_country_code', 'salary_expectation_min', 'salary_expectation_max',
    'years_experience', 'experience_band', 'notice_period_days', 'notice_period_weeks', 'available_from', 'seniority_level',
    'date_of_application', 'source_of_application', 'skills'];
BEGIN
  IF p_status NOT IN ('declined', 'expired', 'removed') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  FOREACH col IN ARRAY personal LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'candidates' AND column_name = col AND is_nullable = 'YES') THEN
      EXECUTE format('UPDATE candidates SET %I = NULL WHERE id = $1', col) USING p_candidate;
    END IF;
  END LOOP;
  UPDATE candidates SET
    preferred_work_types = '{}', employment_types = '{}', open_to_offers = false,
    email_hash = CASE WHEN p_keep_identity THEN email_hash ELSE NULL END,
    mobile_hash = CASE WHEN p_keep_identity THEN mobile_hash ELSE NULL END,
    consent_status = p_status, consent_decided_at = now(), updated_at = now()
  WHERE id = p_candidate;
  -- The referrers' interview notes about them
  UPDATE candidate_interviews SET
    feedback = NULL, outcome_reason = NULL, strengths_list = '{}', development_areas = '{}',
    note_impressed = NULL, note_why_not_offer = NULL, note_best_fit = NULL, employer_location = NULL
  WHERE candidate_id = p_candidate;
END
$$;

-- ------------------------------------------------------------
-- 5. The marketplace only shows live candidates
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
    WHEN NOT viewer_can_see_money() THEN NULL
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
          WHERE ci.candidate_id = c.id AND ci.outcome = 'Silver medallist') AS is_silver_medallist,
  EXISTS (SELECT 1 FROM candidate_unlocks u
          WHERE u.candidate_id = c.id AND u.requesting_company_id = current_company_id()
            AND u.status = 'approved') AS viewer_unlocked
FROM candidates c
-- Only candidates who have confirmed. Referring companies still see their own
-- referrals (and the candidate's status) through My Candidates.
WHERE c.consent_status = 'live';

REVOKE ALL ON candidates_public FROM PUBLIC, anon;
GRANT SELECT ON candidates_public TO authenticated;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['scrub_candidate(uuid, text, boolean)', 'trg_referral_needs_consent()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END
$$;

COMMIT;

-- ------------------------------------------------------------
-- 6. Report
-- ------------------------------------------------------------
SELECT check_name, result FROM (
  SELECT 1 AS ord, 'Candidates already on Pickt (kept live)' AS check_name, count(*)::text AS result FROM candidates WHERE consent_status = 'live'
  UNION ALL SELECT 2, '... of which have an email address', count(*)::text FROM candidates WHERE consent_status = 'live' AND email IS NOT NULL
  UNION ALL SELECT 3, 'Awaiting confirmation', count(*)::text FROM candidates WHERE consent_status = 'awaiting'
  UNION ALL SELECT 4, 'Marketplace shows', count(*)::text FROM candidates_public
) report ORDER BY ord;
