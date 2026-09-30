-- ============================================================
-- Interview Track Record — Migration 026
--
-- One candidate profile can collect interviews from several employers:
-- the first referral creates the candidate, later referrals of the same
-- person (matched by email or mobile) add an interview row and earn the
-- referrer points instead of a fee.
--
-- Targets the tables the app uses today: candidates, candidates_public,
-- candidate_unlocks, companies, users.
--
-- Security model
--   * candidate_interviews: no client access at all (RLS on, no policies).
--     Only edge functions (service role) read it, and candidate-profile
--     strips names / full feedback / reasons unless the viewer has unlocked.
--   * candidates: clients may only read rows their company uploaded or unlocked.
--   * candidates_public: rebuilt with marketplace-safe columns only.
--
-- Apply in the Supabase SQL editor (or `supabase db push`). Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helpers: stage order and feedback teaser
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION interview_stage_rank(stage text)
RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(stage, ''))
    WHEN '1st phone screen' THEN 1
    WHEN 'technical screen' THEN 2
    WHEN '2nd round'        THEN 3
    WHEN '3rd round'        THEN 4
    WHEN 'final round'      THEN 5
    ELSE 1
  END
$$;

-- First sentence, cut to ~60 chars on a word boundary, ending in "…".
-- Mirrors feedbackTeaser() in supabase/functions/_shared/profileShape.js.
CREATE OR REPLACE FUNCTION feedback_teaser(txt text, max_len integer DEFAULT 60)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s text;
  first_sentence text;
BEGIN
  IF txt IS NULL OR btrim(txt) = '' THEN
    RETURN NULL;
  END IF;
  s := btrim(regexp_replace(txt, '\s+', ' ', 'g'));
  first_sentence := substring(s from '^(.*?[.!?])(\s|$)');
  IF first_sentence IS NOT NULL THEN
    s := first_sentence;
  END IF;
  IF length(s) > max_len THEN
    s := regexp_replace(left(s, max_len), '\s+\S*$', '');
  END IF;
  s := regexp_replace(s, '[\s.,;:!?…-]+$', '');
  RETURN s || '…';
END
$$;

-- ------------------------------------------------------------
-- 2. Candidate: identity, activity, open-to-offers
-- ------------------------------------------------------------

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS full_name       text,
  ADD COLUMN IF NOT EXISTS email           text,
  -- HMAC-SHA256 of normalised email / mobile (see create-candidate); used
  -- to recognise the same person when a second employer refers them.
  ADD COLUMN IF NOT EXISTS email_hash      text,
  ADD COLUMN IF NOT EXISTS mobile_hash     text,
  ADD COLUMN IF NOT EXISTS last_active_at  timestamptz,
  ADD COLUMN IF NOT EXISTS open_to_offers  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

UPDATE candidates
   SET last_active_at = coalesce(referred_at, created_at, now())
 WHERE last_active_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_email_hash  ON candidates (email_hash)  WHERE email_hash  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_mobile_hash ON candidates (mobile_hash) WHERE mobile_hash IS NOT NULL;

-- ------------------------------------------------------------
-- 3. One row per employer that interviewed the candidate
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS candidate_interviews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id          uuid NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
  employer_company_id   uuid NOT NULL REFERENCES companies (id)  ON DELETE CASCADE,
  -- Shown while locked (never the employer's name)
  employer_industry     text,
  employer_location     text,
  stage_reached         text NOT NULL DEFAULT '1st phone screen',
  stage_rank            integer GENERATED ALWAYS AS (interview_stage_rank(stage_reached)) STORED,
  interviews_completed  integer NOT NULL DEFAULT 0 CHECK (interviews_completed >= 0),
  -- Only sent after unlock
  feedback              text,
  outcome_reason        text,
  -- Safe to send while locked
  feedback_teaser       text GENERATED ALWAYS AS (feedback_teaser(feedback)) STORED,
  is_original_referral  boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_candidate_interview_employer UNIQUE (candidate_id, employer_company_id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_interviews_candidate
  ON candidate_interviews (candidate_id, stage_rank DESC);

-- No policies = no access for anon/authenticated. Edge functions use the service role.
ALTER TABLE candidate_interviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON candidate_interviews FROM anon, authenticated;

-- Backfill: every existing candidate gets one row from its referring company.
-- Employer description falls back to the candidate's industry / city, the
-- closest data available for existing referrals.
INSERT INTO candidate_interviews (
  candidate_id, employer_company_id, employer_industry, employer_location,
  stage_reached, interviews_completed, feedback, outcome_reason,
  is_original_referral, created_at
)
SELECT
  c.id,
  c.uploaded_by_company_id,
  c.industry,
  c.location_city,
  coalesce(c.interview_stage_reached, '1st phone screen'),
  coalesce(c.interviews_completed, 0),
  coalesce(nullif(btrim(c.feedback_summary), ''), c.strengths),
  c.why_not_hired,
  true,
  coalesce(c.referred_at, c.created_at, now())
FROM candidates c
WHERE c.uploaded_by_company_id IS NOT NULL
ON CONFLICT (candidate_id, employer_company_id) DO NOTHING;

-- ------------------------------------------------------------
-- 4. Referral points (repeat referrals earn points, not fees)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS referral_points (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  candidate_id  uuid REFERENCES candidates (id) ON DELETE SET NULL,
  interview_id  uuid REFERENCES candidate_interviews (id) ON DELETE SET NULL,
  points        integer NOT NULL CHECK (points <> 0),
  reason        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_points_company ON referral_points (company_id, created_at DESC);

ALTER TABLE referral_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_points_select_own" ON referral_points;
CREATE POLICY "referral_points_select_own" ON referral_points
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE OR REPLACE VIEW company_points_balance
WITH (security_invoker = true) AS
  SELECT company_id, sum(points)::integer AS points
  FROM referral_points
  GROUP BY company_id;

GRANT SELECT ON company_points_balance TO authenticated;

-- ------------------------------------------------------------
-- 5. "Last active" — set by: a new referral, the referrer updating the
--    record, or the candidate confirming availability (mark_candidate_active)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION mark_candidate_active(p_candidate_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE candidates SET last_active_at = now() WHERE id = p_candidate_id;
$$;
REVOKE ALL ON FUNCTION mark_candidate_active(uuid) FROM PUBLIC, anon, authenticated;

-- New interview row (first or repeat referral) → candidate is active
CREATE OR REPLACE FUNCTION trg_interview_marks_active()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE candidates SET last_active_at = now() WHERE id = NEW.candidate_id;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS candidate_interviews_mark_active ON candidate_interviews;
CREATE TRIGGER candidate_interviews_mark_active
  AFTER INSERT ON candidate_interviews
  FOR EACH ROW EXECUTE FUNCTION trg_interview_marks_active();

-- Referrer edits the candidate's details → active (ignores bookkeeping columns)
CREATE OR REPLACE FUNCTION trg_candidate_update_marks_active()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ignored text[] := ARRAY['last_active_at', 'updated_at', 'status', 'email_hash', 'mobile_hash', 'search_vector'];
BEGIN
  IF (to_jsonb(NEW) - ignored) IS DISTINCT FROM (to_jsonb(OLD) - ignored) THEN
    NEW.last_active_at := now();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS candidates_mark_active ON candidates;
CREATE TRIGGER candidates_mark_active
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION trg_candidate_update_marks_active();

-- ------------------------------------------------------------
-- 6. Lock down direct reads of the full candidates table
--    (only rows your company uploaded or has unlocked)
-- ------------------------------------------------------------

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candidates_select_own_or_unlocked" ON candidates;
CREATE POLICY "candidates_select_own_or_unlocked" ON candidates
  FOR SELECT USING (
    uploaded_by_company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM candidate_unlocks u
      WHERE u.candidate_id = candidates.id
        AND u.requesting_company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
        AND u.status = 'approved'
    )
  );

-- RESTRICTIVE: even if an older, looser SELECT policy exists, this must also pass
DROP POLICY IF EXISTS "candidates_select_restrict" ON candidates;
CREATE POLICY "candidates_select_restrict" ON candidates
  AS RESTRICTIVE FOR SELECT USING (
    uploaded_by_company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM candidate_unlocks u
      WHERE u.candidate_id = candidates.id
        AND u.requesting_company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
        AND u.status = 'approved'
    )
  );

-- ------------------------------------------------------------
-- 7. Marketplace view: safe columns only
--    No feedback, strengths/gaps, reasons, interview notes, contact
--    details, current employer, CV/document links or identity hashes.
--    referring_company stays public (shown on marketplace cards).
-- ------------------------------------------------------------

-- Fails (rather than silently dropping things) if other objects depend on the old view.
DROP VIEW IF EXISTS candidates_public;

CREATE VIEW candidates_public WITH (security_barrier = true) AS
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
  (SELECT count(*) FROM candidate_interviews ci WHERE ci.candidate_id = c.id)::integer AS employers_count
FROM candidates c;

GRANT SELECT ON candidates_public TO anon, authenticated;
