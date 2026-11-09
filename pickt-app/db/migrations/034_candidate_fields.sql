-- ============================================================
-- Candidate fields — Migration 034
-- Requires migrations 026, 027, 030 and 031.
--
-- Adds the new candidate fields and converts existing candidates:
--   years_experience      → experience_band (a value on a boundary goes in the
--                           higher band: 3 years is "3–5 years")
--   notice_period_days    → notice_period_weeks (rounded up, at most 26)
--   preferred_work_type   → preferred_work_types (a one-item list)
--   employment_type       → employment_types (a one-item list)
--   location names        → country and state codes, for common countries
--
-- The old columns are KEPT, because the site on master, ranking and job matching
-- still read them. Nothing is deleted. The one value removed: residency "Other"
-- is no longer an option, so it becomes blank.
--
-- PRIVACY: visa_type is deliberately NOT in candidates_public. Before unlocking,
-- employers see residency status only. Visa type comes from candidate-profile,
-- and only after unlocking.
--
-- Apply in the Supabase SQL editor. Runs as one transaction: if anything fails,
-- nothing changes. Safe to re-run. Ends with a report.
-- ============================================================

BEGIN;

DO $$
DECLARE
  needed text[] := ARRAY['years_experience', 'notice_period_days', 'preferred_work_type', 'employment_type',
                         'residency_status', 'location_city', 'location_state', 'location_country'];
  col text;
BEGIN
  FOREACH col IN ARRAY needed LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'candidates' AND column_name = col) THEN
      RAISE EXCEPTION 'Not ready: candidates.% is missing. Send this message to your developer. Nothing was changed.', col;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'candidates_public' AND column_name = 'referrer_names') THEN
    RAISE EXCEPTION 'Not ready: run migration 031 first. Nothing was changed.';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 1. New columns
-- ------------------------------------------------------------
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS experience_band        text,
  ADD COLUMN IF NOT EXISTS location_country_code  text,
  ADD COLUMN IF NOT EXISTS location_state_code    text,
  ADD COLUMN IF NOT EXISTS visa_type              text,
  ADD COLUMN IF NOT EXISTS preferred_work_types   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS employment_types       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notice_period_weeks    integer;

-- ------------------------------------------------------------
-- 2. Convert existing candidates. Converting isn't activity, so this
--    must not change "last active".
-- ------------------------------------------------------------
ALTER TABLE candidates DISABLE TRIGGER candidates_mark_active;

UPDATE candidates SET experience_band = CASE
    WHEN years_experience < 1 THEN '<1 year'
    WHEN years_experience < 3 THEN '1–3 years'
    WHEN years_experience < 5 THEN '3–5 years'
    WHEN years_experience < 7 THEN '5–7 years'
    ELSE '7+ years'
  END
WHERE experience_band IS NULL AND years_experience IS NOT NULL AND years_experience >= 0;

UPDATE candidates SET notice_period_weeks = LEAST(26, CEIL(notice_period_days / 7.0)::integer)
WHERE notice_period_weeks IS NULL AND notice_period_days IS NOT NULL AND notice_period_days >= 0;

UPDATE candidates SET preferred_work_types = ARRAY[
    CASE lower(regexp_replace(preferred_work_type::text, '[[:space:]_-]', '', 'g'))
      WHEN 'remote' THEN 'Remote'
      WHEN 'hybrid' THEN 'Hybrid'
      WHEN 'onsite' THEN 'On-site'
    END]
WHERE preferred_work_types = '{}'
  AND lower(regexp_replace(coalesce(preferred_work_type::text, ''), '[[:space:]_-]', '', 'g')) IN ('remote', 'hybrid', 'onsite');

UPDATE candidates SET employment_types = ARRAY[
    CASE lower(regexp_replace(employment_type::text, '[[:space:]_-]', '', 'g'))
      WHEN 'fulltime' THEN 'Full-time'
      WHEN 'parttime' THEN 'Part-time'
      WHEN 'contract' THEN 'Contract'
      WHEN 'casual' THEN 'Casual'
    END]
WHERE employment_types = '{}'
  AND lower(regexp_replace(coalesce(employment_type::text, ''), '[[:space:]_-]', '', 'g')) IN ('fulltime', 'parttime', 'contract', 'casual');

UPDATE candidates SET residency_status = NULL WHERE residency_status = 'Other';

-- Common countries, including short forms typed into the old free-text box.
-- Anything else keeps its name with no code, and is still found by name.
UPDATE candidates c SET location_country = m.name, location_country_code = m.code
FROM (VALUES
  ('australia', 'Australia', 'AU'), ('au', 'Australia', 'AU'),
  ('new zealand', 'New Zealand', 'NZ'), ('nz', 'New Zealand', 'NZ'),
  ('united kingdom', 'United Kingdom', 'GB'), ('uk', 'United Kingdom', 'GB'), ('gb', 'United Kingdom', 'GB'),
  ('united states', 'United States', 'US'), ('usa', 'United States', 'US'), ('us', 'United States', 'US'),
  ('canada', 'Canada', 'CA'), ('singapore', 'Singapore', 'SG'), ('ireland', 'Ireland', 'IE'), ('india', 'India', 'IN')
) AS m(typed, name, code)
WHERE c.location_country_code IS NULL AND lower(btrim(c.location_country)) = m.typed;

-- Australian states, by name or short form
UPDATE candidates c SET location_state = m.name, location_state_code = m.code
FROM (VALUES
  ('new south wales', 'New South Wales', 'NSW'), ('nsw', 'New South Wales', 'NSW'),
  ('victoria', 'Victoria', 'VIC'), ('vic', 'Victoria', 'VIC'),
  ('queensland', 'Queensland', 'QLD'), ('qld', 'Queensland', 'QLD'),
  ('western australia', 'Western Australia', 'WA'), ('wa', 'Western Australia', 'WA'),
  ('south australia', 'South Australia', 'SA'), ('sa', 'South Australia', 'SA'),
  ('tasmania', 'Tasmania', 'TAS'), ('tas', 'Tasmania', 'TAS'),
  ('australian capital territory', 'Australian Capital Territory', 'ACT'), ('act', 'Australian Capital Territory', 'ACT'),
  ('northern territory', 'Northern Territory', 'NT'), ('nt', 'Northern Territory', 'NT')
) AS m(typed, name, code)
WHERE c.location_state_code IS NULL AND c.location_country_code = 'AU' AND lower(btrim(c.location_state)) = m.typed;

ALTER TABLE candidates ENABLE TRIGGER candidates_mark_active;

-- ------------------------------------------------------------
-- 3. Allowed values
-- ------------------------------------------------------------
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_experience_band_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_experience_band_check
  CHECK (experience_band IS NULL OR experience_band IN ('<1 year', '1–3 years', '3–5 years', '5–7 years', '7+ years'));

ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_notice_weeks_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_notice_weeks_check
  CHECK (notice_period_weeks IS NULL OR notice_period_weeks BETWEEN 0 AND 26);

ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_work_types_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_work_types_check
  CHECK (preferred_work_types <@ ARRAY['Remote', 'Hybrid', 'On-site']::text[]);

ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_employment_types_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_employment_types_check
  CHECK (employment_types <@ ARRAY['Full-time', 'Part-time', 'Contract', 'Casual']::text[]);

-- ------------------------------------------------------------
-- 4. Marketplace view: existing columns unchanged from 031, new ones added at the
--    end. Residency status is added; visa_type is deliberately left out.
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
               'teaser', feedback_teaser(ci.feedback, 55)
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
  c.notice_period_weeks
FROM candidates c;

REVOKE ALL ON candidates_public FROM PUBLIC, anon;
GRANT SELECT ON candidates_public TO authenticated;

COMMIT;

-- ------------------------------------------------------------
-- 5. Report
-- ------------------------------------------------------------
SELECT check_name, result FROM (
  SELECT 1 AS ord, 'Total candidates' AS check_name, count(*)::text AS result FROM candidates
  UNION ALL SELECT 2, 'With an experience band', count(*)::text FROM candidates WHERE experience_band IS NOT NULL
  UNION ALL SELECT 3, 'With notice in weeks', count(*)::text FROM candidates WHERE notice_period_weeks IS NOT NULL
  UNION ALL SELECT 4, 'With a work preference list', count(*)::text FROM candidates WHERE preferred_work_types <> '{}'
  UNION ALL SELECT 5, 'With an employment type list', count(*)::text FROM candidates WHERE employment_types <> '{}'
  UNION ALL SELECT 6, 'With a country code', count(*)::text FROM candidates WHERE location_country_code IS NOT NULL
  UNION ALL SELECT 7, 'Visa type visible in marketplace view (must be 0)', count(*)::text
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'candidates_public' AND column_name = 'visa_type'
) report ORDER BY ord;
