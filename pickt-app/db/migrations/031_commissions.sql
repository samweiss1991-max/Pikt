-- ============================================================
-- Commissions — Migration 031
-- Requires migrations 026, 027 and 030, with rates entered in commission_settings.
--
-- THE RULES
--   * Every candidate has one or two referrers, stored in order.
--   * Commission is earned only when a hire is recorded, on the actual
--     first-year salary (base + super, all inclusive).
--   * Rates live ONLY in commission_settings (see migration 030), and past
--     hires keep the rates they were recorded with.
--
-- WHO SEES WHICH FIGURE
--   * Referrers: only their own rate and amount. Never the total or Pickt's share.
--   * Hiring employers: only the total fee. No breakdown.
--   * Candidates: no fee or commission figures.
--   * Pickt admins: everything.
--
-- PRIVACY
--   Every table here has row security on and NO policies, and anon/authenticated
--   have no access, so a browser can't read them even with a hand-written request.
--   Only server functions (service role) can, and they send each viewer only
--   what they may see. Pickt's share has its own table and is only ever returned
--   by the admin-only admin-commissions function.
--
-- Apply in the Supabase SQL editor. Runs as one transaction: if anything
-- fails, nothing changes. Safe to re-run. Ends with a data health report.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Pre-flight: stop with a clear message if the database isn't ready
-- ------------------------------------------------------------
DO $$
DECLARE
  needed text[][] := ARRAY[
    ['candidates', 'uploaded_by_company_id'], ['candidates', 'email_hash'],
    ['candidates', 'mobile_hash'], ['candidates', 'fee_percentage'], ['candidates', 'status'],
    ['candidates', 'full_name'], ['candidates', 'role_applied_for'],
    ['users', 'company_id'], ['companies', 'name'],
    ['candidate_unlocks', 'requesting_company_id'], ['candidate_unlocks', 'status'],
    ['candidate_interviews', 'is_original_referral'],
    ['candidates_public', 'interview_snapshot']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(needed, 1) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = needed[i][1] AND column_name = needed[i][2]
    ) THEN
      RAISE EXCEPTION 'Not ready: %.% is missing. Apply migrations 026 and 027 first, or send this message to your developer. Nothing was changed.',
        needed[i][1], needed[i][2];
    END IF;
  END LOOP;

  IF to_regclass('public.commission_settings') IS NULL THEN
    RAISE EXCEPTION 'Not ready: run migration 030 first. Nothing was changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM commission_settings) THEN
    RAISE EXCEPTION 'Not ready: commission_settings has no rates. Enter them first. Nothing was changed.';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 2. Who referred each candidate, in order
--    The foreign key means a position with no row in commission_settings
--    (a 3rd referrer) cannot exist, even if two requests arrive together.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_referrers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id       uuid NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
  company_id         uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  interview_id       uuid REFERENCES candidate_interviews (id) ON DELETE SET NULL,
  referrer_position  integer NOT NULL REFERENCES commission_settings (referrer_position),
  referred_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_candidate_referrer_company  UNIQUE (candidate_id, company_id),
  CONSTRAINT uq_candidate_referrer_position UNIQUE (candidate_id, referrer_position)
);

CREATE INDEX IF NOT EXISTS idx_candidate_referrers_company ON candidate_referrers (company_id);

-- ------------------------------------------------------------
-- 3. Hires. source/external_reference let an ATS plugin record hires later.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hires (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id          uuid NOT NULL UNIQUE REFERENCES candidates (id) ON DELETE RESTRICT,
  hiring_company_id     uuid NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
  unlock_id             uuid REFERENCES candidate_unlocks (id) ON DELETE SET NULL,
  -- Base + super, all inclusive
  first_year_salary     numeric(12,2) NOT NULL CHECK (first_year_salary > 0),
  start_date            date NOT NULL,
  total_fee_percentage  numeric(5,2) NOT NULL DEFAULT 0,
  total_fee_amount      numeric(12,2) NOT NULL DEFAULT 0,
  source                text NOT NULL DEFAULT 'employer' CHECK (source IN ('employer', 'ats')),
  external_reference    text,
  recorded_by           uuid,
  corrected_by          uuid,
  corrected_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hires_company ON hires (hiring_company_id);

-- ------------------------------------------------------------
-- 4. Commissions (the referrer's share) and Pickt's share, kept apart
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commissions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hire_id              uuid NOT NULL REFERENCES hires (id) ON DELETE RESTRICT,
  candidate_id         uuid NOT NULL REFERENCES candidates (id) ON DELETE RESTRICT,
  referrer_company_id  uuid NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
  referrer_position    integer NOT NULL,
  first_year_salary    numeric(12,2) NOT NULL,
  rate                 numeric(5,2) NOT NULL,
  amount               numeric(12,2) NOT NULL,
  status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at              timestamptz,
  paid_by              uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_commission_hire_position UNIQUE (hire_id, referrer_position)
);

CREATE INDEX IF NOT EXISTS idx_commissions_referrer ON commissions (referrer_company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS commission_platform_shares (
  commission_id  uuid PRIMARY KEY REFERENCES commissions (id) ON DELETE RESTRICT,
  rate           numeric(5,2) NOT NULL,
  amount         numeric(12,2) NOT NULL
);

-- ------------------------------------------------------------
-- 5. Pickt admins, and referrals waiting for an admin
--    A review is created when the email matches one candidate and the mobile
--    matches another. Holds no contact details, only which records matched.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pickt_admins (
  user_id   uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  added_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_identity_reviews (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                 uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  email_match_candidate_id   uuid REFERENCES candidates (id) ON DELETE CASCADE,
  mobile_match_candidate_id  uuid REFERENCES candidates (id) ON DELETE CASCADE,
  status                     text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by                uuid,
  resolved_at                timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 6. Lock everything down
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['commission_settings', 'candidate_referrers', 'hires', 'commissions',
                           'commission_platform_shares', 'pickt_admins', 'referral_identity_reviews']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON %I TO service_role', t);
  END LOOP;
END
$$;

-- ------------------------------------------------------------
-- 7. The total fee is never stored on the candidate, because the company that
--    added a candidate can read that row. The total is worked out per viewer in
--    candidates_public and the candidate-profile function. Whatever a browser
--    sends in fee_percentage is thrown away.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION employer_fee_for(p_referrer_count integer)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(referrer_rate + pickt_rate), 0)
  FROM commission_settings
  WHERE referrer_position <= p_referrer_count
$$;

DROP TRIGGER IF EXISTS candidates_fee_from_settings ON candidates;
DROP FUNCTION IF EXISTS trg_candidate_fee_from_settings();

ALTER TABLE candidates ALTER COLUMN fee_percentage DROP NOT NULL;

CREATE OR REPLACE FUNCTION trg_candidate_server_rules()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Every candidate must have a referrer. Old rows that already have none stay
  -- editable (the report below counts them); this stops any new ones appearing.
  IF NEW.uploaded_by_company_id IS NULL
     AND (TG_OP = 'INSERT' OR OLD.uploaded_by_company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'candidate_needs_referrer';
  END IF;

  NEW.fee_percentage := NULL;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS candidates_server_rules ON candidates;
CREATE TRIGGER candidates_server_rules
  BEFORE INSERT OR UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION trg_candidate_server_rules();

-- A fee change shouldn't make a candidate look recently active
CREATE OR REPLACE FUNCTION trg_candidate_update_marks_active()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ignored text[] := ARRAY['last_active_at', 'updated_at', 'status', 'email_hash', 'mobile_hash', 'search_vector', 'fee_percentage'];
BEGIN
  IF (to_jsonb(NEW) - ignored) IS DISTINCT FROM (to_jsonb(OLD) - ignored) THEN
    NEW.last_active_at := now();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END
$$;

-- ------------------------------------------------------------
-- 8. Backfill existing candidates: the earliest two companies become 1st and
--    2nd, and any others keep their interview rows but earn nothing.
-- ------------------------------------------------------------
INSERT INTO candidate_referrers (candidate_id, company_id, interview_id, referrer_position, referred_at)
SELECT ranked.candidate_id, ranked.employer_company_id, ranked.id, ranked.pos, ranked.created_at
FROM (
  SELECT ci.*,
         row_number() OVER (
           PARTITION BY ci.candidate_id
           ORDER BY ci.is_original_referral DESC, ci.created_at, ci.id
         )::integer AS pos
  FROM candidate_interviews ci
) ranked
JOIN commission_settings s ON s.referrer_position = ranked.pos
WHERE NOT EXISTS (SELECT 1 FROM candidate_referrers cr WHERE cr.candidate_id = ranked.candidate_id);

-- Candidates with a referring company but no interview row
INSERT INTO candidate_referrers (candidate_id, company_id, referrer_position, referred_at)
SELECT c.id, c.uploaded_by_company_id, 1, coalesce(c.created_at, now())
FROM candidates c
WHERE c.uploaded_by_company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM candidate_referrers cr WHERE cr.candidate_id = c.id);

-- Fires the trigger above, which clears the old stored totals
UPDATE candidates SET status = status;

-- ------------------------------------------------------------
-- 9. One candidate per email and per mobile. Only added if the existing data
--     has no duplicates (the report below shows if it was skipped).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM candidates WHERE email_hash IS NOT NULL GROUP BY email_hash HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_email_hash ON candidates (email_hash) WHERE email_hash IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM candidates WHERE mobile_hash IS NOT NULL GROUP BY mobile_hash HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_mobile_hash ON candidates (mobile_hash) WHERE mobile_hash IS NOT NULL;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 10. Add a referrer. All-or-nothing, and the row lock means two companies
--     referring at the same moment can't both take the last spot.
--     Returns only that referrer's own position and rate.
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
    stage_reached, interviews_completed, feedback, outcome_reason, is_original_referral
  ) VALUES (
    p_candidate_id, p_company_id,
    p_interview ->> 'employer_industry', p_interview ->> 'employer_location',
    coalesce(p_interview ->> 'stage_reached', '1st phone screen'),
    coalesce((p_interview ->> 'interviews_completed')::integer, 0),
    p_interview ->> 'feedback', p_interview ->> 'outcome_reason', p_is_original
  ) RETURNING id INTO v_interview_id;

  INSERT INTO candidate_referrers (candidate_id, company_id, interview_id, referrer_position)
  VALUES (p_candidate_id, p_company_id, v_interview_id, v_position);

  RETURN jsonb_build_object('position', v_position, 'rate', v_rate);
END
$$;

-- ------------------------------------------------------------
-- 11. Record a hire and create every commission, all-or-nothing.
--     Rates are copied onto each row so later rate changes don't alter history.
--     Returns only what the employer may see: the total fee.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_hire(
  p_candidate_id uuid,
  p_company_id   uuid,
  p_user_id      uuid,
  p_salary       numeric,
  p_start_date   date,
  p_source       text DEFAULT 'employer',
  p_external_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unlock_id uuid;
  v_hire_id   uuid;
  v_pct       numeric := 0;
  v_total     numeric := 0;
  v_comm_id   uuid;
  r           record;
BEGIN
  IF p_salary IS NULL OR p_salary <= 0 THEN RAISE EXCEPTION 'invalid_salary'; END IF;
  IF p_start_date IS NULL THEN RAISE EXCEPTION 'invalid_start_date'; END IF;

  PERFORM 1 FROM candidates WHERE id = p_candidate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'candidate_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM hires WHERE candidate_id = p_candidate_id) THEN
    RAISE EXCEPTION 'already_hired';
  END IF;

  -- A company can't earn commission on its own hire
  IF EXISTS (SELECT 1 FROM candidate_referrers WHERE candidate_id = p_candidate_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'own_referral';
  END IF;

  SELECT id INTO v_unlock_id FROM candidate_unlocks
  WHERE candidate_id = p_candidate_id AND requesting_company_id = p_company_id AND status = 'approved'
  LIMIT 1;
  IF v_unlock_id IS NULL THEN RAISE EXCEPTION 'not_unlocked'; END IF;

  IF NOT EXISTS (SELECT 1 FROM candidate_referrers WHERE candidate_id = p_candidate_id) THEN
    RAISE EXCEPTION 'no_referrer';
  END IF;

  INSERT INTO hires (candidate_id, hiring_company_id, unlock_id, first_year_salary, start_date, source, external_reference, recorded_by)
  VALUES (p_candidate_id, p_company_id, v_unlock_id, p_salary, p_start_date, p_source, p_external_ref, p_user_id)
  RETURNING id INTO v_hire_id;

  FOR r IN
    SELECT cr.company_id, cr.referrer_position, s.referrer_rate, s.pickt_rate
    FROM candidate_referrers cr
    JOIN commission_settings s USING (referrer_position)
    WHERE cr.candidate_id = p_candidate_id
    ORDER BY cr.referrer_position
  LOOP
    INSERT INTO commissions (hire_id, candidate_id, referrer_company_id, referrer_position, first_year_salary, rate, amount)
    VALUES (v_hire_id, p_candidate_id, r.company_id, r.referrer_position, p_salary, r.referrer_rate,
            round(p_salary * r.referrer_rate / 100, 2))
    RETURNING id INTO v_comm_id;

    INSERT INTO commission_platform_shares (commission_id, rate, amount)
    VALUES (v_comm_id, r.pickt_rate, round(p_salary * r.pickt_rate / 100, 2));

    v_pct   := v_pct + r.referrer_rate + r.pickt_rate;
    -- Adding the rounded parts means the total always equals the parts exactly
    v_total := v_total + round(p_salary * r.referrer_rate / 100, 2) + round(p_salary * r.pickt_rate / 100, 2);
  END LOOP;

  UPDATE hires SET total_fee_percentage = v_pct, total_fee_amount = v_total WHERE id = v_hire_id;

  -- "placed" is what My Candidates shows. Must never stop a hire being recorded.
  BEGIN
    UPDATE candidates SET status = 'placed' WHERE id = p_candidate_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_hire: could not set candidate status: %', SQLERRM;
  END;

  RETURN jsonb_build_object('hire_id', v_hire_id, 'total_fee_percentage', v_pct, 'total_fee_amount', v_total);
END
$$;

-- ------------------------------------------------------------
-- 12. Admin correction of salary / start date. Uses the rates saved at hire
--     time. Refused once any commission on the hire has been paid.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION correct_hire(
  p_hire_id    uuid,
  p_admin_id   uuid,
  p_salary     numeric,
  p_start_date date
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric;
BEGIN
  IF p_salary IS NULL OR p_salary <= 0 THEN RAISE EXCEPTION 'invalid_salary'; END IF;
  IF p_start_date IS NULL THEN RAISE EXCEPTION 'invalid_start_date'; END IF;

  PERFORM 1 FROM hires WHERE id = p_hire_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'hire_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM commissions WHERE hire_id = p_hire_id AND status = 'paid') THEN
    RAISE EXCEPTION 'commission_already_paid';
  END IF;

  UPDATE commissions
     SET first_year_salary = p_salary, amount = round(p_salary * rate / 100, 2)
   WHERE hire_id = p_hire_id;

  UPDATE commission_platform_shares s
     SET amount = round(p_salary * s.rate / 100, 2)
    FROM commissions c
   WHERE c.id = s.commission_id AND c.hire_id = p_hire_id;

  SELECT sum(c.amount + s.amount) INTO v_total
    FROM commissions c JOIN commission_platform_shares s ON s.commission_id = c.id
   WHERE c.hire_id = p_hire_id;

  UPDATE hires
     SET first_year_salary = p_salary, start_date = p_start_date, total_fee_amount = v_total,
         corrected_by = p_admin_id, corrected_at = now()
   WHERE id = p_hire_id;
END
$$;

-- ------------------------------------------------------------
-- 13. Admin report (includes Pickt's share). Server only.
-- ------------------------------------------------------------
DROP VIEW IF EXISTS admin_commission_report;
CREATE VIEW admin_commission_report AS
SELECT
  c.id AS commission_id,
  c.hire_id,
  c.candidate_id,
  cand.full_name AS candidate_name,
  cand.role_applied_for AS candidate_role,
  hc.name AS hiring_company,
  rc.name AS referrer_company,
  c.referrer_position,
  c.first_year_salary,
  h.start_date,
  c.rate AS referrer_rate,
  c.amount AS referrer_amount,
  s.rate AS pickt_rate,
  s.amount AS pickt_amount,
  h.total_fee_percentage,
  h.total_fee_amount,
  c.status,
  c.paid_at,
  c.created_at
FROM commissions c
JOIN hires h ON h.id = c.hire_id
JOIN commission_platform_shares s ON s.commission_id = c.id
JOIN candidates cand ON cand.id = c.candidate_id
JOIN companies hc ON hc.id = h.hiring_company_id
JOIN companies rc ON rc.id = c.referrer_company_id;

REVOKE ALL ON admin_commission_report FROM PUBLIC, anon, authenticated;
GRANT SELECT ON admin_commission_report TO service_role;

-- Lets the app decide whether to show the Admin menu link. Tells the signed-in
-- user about themselves only. The real check is inside admin-commissions.
CREATE OR REPLACE FUNCTION am_i_pickt_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM pickt_admins WHERE user_id = auth.uid())
$$;

-- ------------------------------------------------------------
-- 14. Only server functions may run these
-- ------------------------------------------------------------
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'employer_fee_for(integer)',
    'trg_candidate_server_rules()',
    'register_referral(uuid, uuid, jsonb, boolean)',
    'record_hire(uuid, uuid, uuid, numeric, date, text, text)',
    'correct_hire(uuid, uuid, numeric, date)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION am_i_pickt_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION am_i_pickt_admin() TO authenticated;

-- Dashboard savings: only ever the signed-in company's own hires, as the hirer
CREATE OR REPLACE FUNCTION my_hire_savings()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN count(*) = 0 THEN NULL ELSE greatest(0, sum(first_year_salary * 0.22 - total_fee_amount)) END
  FROM hires
  WHERE hiring_company_id = current_company_id()
$$;
REVOKE ALL ON FUNCTION my_hire_savings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_hire_savings() TO authenticated;

-- ------------------------------------------------------------
-- 15. Marketplace view. fee_percentage is the total fee, sent only to companies
--     that aren't that candidate's referrer. A candidate's own referrers get NULL.
--     Also adds referrer names and count (no rates, no ids). No longer readable
--     without logging in; every page that uses it requires login.
--
--     Rates are read inline, not through employer_fee_for(), because a view's
--     functions run with the viewer's permissions and viewers can't run that one.
--     Fails safely (nothing changes) if another view depends on this one.
-- ------------------------------------------------------------
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
  ), '[]'::jsonb) AS referrer_names
FROM candidates c;

REVOKE ALL ON candidates_public FROM anon;
GRANT SELECT ON candidates_public TO authenticated;

-- ------------------------------------------------------------
-- 16. Old placement tables: nothing in the app uses them now, and their rules
--     could let a referrer read an employer's fee or a browser insert placements.
--     Any data in them is kept. It just can't be reached from a browser.
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['placement', 'placements'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON %I FROM PUBLIC, anon, authenticated', t);
    END IF;
  END LOOP;
END
$$;

COMMIT;

-- ------------------------------------------------------------
-- 17. Data health report. Anything other than 0 in the first six rows means
--     existing candidates break the new rules and need attention.
-- ------------------------------------------------------------
SELECT check_name, result FROM (
  SELECT 1 AS ord, 'candidates with no referrer' AS check_name,
         (SELECT count(*) FROM candidates c WHERE NOT EXISTS (SELECT 1 FROM candidate_referrers cr WHERE cr.candidate_id = c.id))::text AS result
  UNION ALL SELECT 2, 'candidates missing an email',
         (SELECT count(*) FROM candidates WHERE email_hash IS NULL)::text
  UNION ALL SELECT 3, 'candidates missing a mobile',
         (SELECT count(*) FROM candidates WHERE mobile_hash IS NULL)::text
  UNION ALL SELECT 4, 'emails used by more than one candidate',
         (SELECT count(*) FROM (SELECT 1 FROM candidates WHERE email_hash IS NOT NULL GROUP BY email_hash HAVING count(*) > 1) d)::text
  UNION ALL SELECT 5, 'mobiles used by more than one candidate',
         (SELECT count(*) FROM (SELECT 1 FROM candidates WHERE mobile_hash IS NOT NULL GROUP BY mobile_hash HAVING count(*) > 1) d)::text
  UNION ALL SELECT 6, 'companies past the 2-referrer limit (kept, earn nothing)',
         (SELECT count(*) FROM candidate_interviews ci WHERE NOT EXISTS (SELECT 1 FROM candidate_referrers cr WHERE cr.candidate_id = ci.candidate_id AND cr.company_id = ci.employer_company_id))::text
  UNION ALL SELECT 7, 'INFO: total candidates', (SELECT count(*) FROM candidates)::text
  UNION ALL SELECT 8, 'INFO: candidates with two referrers',
         (SELECT count(*) FROM candidate_referrers WHERE referrer_position = 2)::text
  UNION ALL SELECT 9, 'INFO: Pickt admins set up', (SELECT count(*) FROM pickt_admins)::text
) report
ORDER BY ord;
