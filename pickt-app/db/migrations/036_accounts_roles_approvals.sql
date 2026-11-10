-- ============================================================
-- Accounts, roles and approvals — Migration 036
-- Requires migrations 030 to 035.
--
-- WHO CAN DO WHAT
--   Owner, Admin: see fees and commission amounts, unlock, record hires, manage the
--                 team, approve or decline requests. Admins can't change Owners, and
--                 the last Owner can't be removed.
--   Member:       browse, search, save and refer. Can only REQUEST unlocks and hires,
--                 and gets no fee or commission figures unless the Owner turns on
--                 "Let Members see fees and commission amounts".
--
-- Earlier rules still apply on top: a referrer sees only its own rate, a hirer only
-- the total, and Pickt's share is only ever returned to Pickt admins.
--
-- All the new tables are closed to browsers. Server functions decide what each
-- person receives, and the rules below are enforced here too, not just in screens.
--
-- Existing company users become Owners, once: re-running this won't undo role changes.
-- Nothing is deleted.
--
-- Apply in the Supabase SQL editor. Runs as one transaction: if anything fails,
-- nothing changes. Safe to re-run. Ends with a report.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'candidates_public' AND column_name = 'is_silver_medallist') THEN
    RAISE EXCEPTION 'Not ready: run migration 035 first. Nothing was changed.';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 1. Roles
-- ------------------------------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text;

-- Once only: the first time, everyone already in a company becomes its Owner
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner') THEN
    UPDATE users SET role = 'owner';
  END IF;
END
$$;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'admin', 'member'));

ALTER TABLE companies ADD COLUMN IF NOT EXISTS members_see_fees boolean NOT NULL DEFAULT false;

ALTER TABLE candidate_unlocks
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by  uuid;
ALTER TABLE hires ADD COLUMN IF NOT EXISTS requested_by uuid;

-- ------------------------------------------------------------
-- 2. New tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id      uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  homepage     text NOT NULL DEFAULT 'marketplace'
               CHECK (homepage IN ('marketplace', 'my-candidates', 'shortlist', 'refer', 'dashboard')),
  default_view text NOT NULL DEFAULT 'stack'
               CHECK (default_view IN ('stack', 'carousel', 'matrix', 'tinder', 'focus')),
  email_prefs  jsonb NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  email         text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  accepted_at   timestamptz,
  cancelled_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_invite_open ON company_invites (lower(email))
  WHERE accepted_at IS NULL AND cancelled_at IS NULL;

CREATE TABLE IF NOT EXISTS company_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  candidate_id        uuid NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
  type                text NOT NULL CHECK (type IN ('unlock', 'hire')),
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  requested_by        uuid NOT NULL,
  note                text,
  proposed_salary     numeric(12,2) CHECK (proposed_salary IS NULL OR proposed_salary > 0),
  proposed_start_date date,
  approved_salary     numeric(12,2),
  approved_start_date date,
  hire_id             uuid REFERENCES hires (id) ON DELETE SET NULL,
  decided_by          uuid,
  decided_at          timestamptz,
  decline_reason      text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_requests_company ON company_requests (company_id, status, created_at DESC);
-- One pending unlock and one pending hire per candidate, per company
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_request_pending ON company_requests (company_id, candidate_id, type)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS user_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications (user_id, created_at DESC);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_preferences', 'company_invites', 'company_requests', 'user_notifications'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON %I TO service_role', t);
  END LOOP;
END
$$;

-- ------------------------------------------------------------
-- 3. Who the signed-in person is
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION viewer_can_see_money()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT u.role IN ('owner', 'admin') OR c.members_see_fees
    FROM users u JOIN companies c ON c.id = u.company_id
    WHERE u.id = auth.uid()
  ), false)
$$;
REVOKE ALL ON FUNCTION viewer_can_see_money() FROM PUBLIC, anon;
-- service_role too: server functions read the marketplace view, which uses these
GRANT EXECUTE ON FUNCTION viewer_can_see_money() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_company_id() TO service_role;

-- Savings are a dollar figure, so they follow the same rule
CREATE OR REPLACE FUNCTION my_hire_savings()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT viewer_can_see_money() OR count(*) = 0 THEN NULL
    ELSE greatest(0, sum(first_year_salary * 0.22 - total_fee_amount))
  END
  FROM hires
  WHERE hiring_company_id = current_company_id()
$$;

-- ------------------------------------------------------------
-- 4. The last Owner can't be removed or changed, whichever way it's tried
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_protect_last_owner()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'owner'
     AND (TG_OP = 'DELETE' OR NEW.role <> 'owner' OR NEW.company_id <> OLD.company_id) THEN
    -- The row lock stops two Owners removing each other at the same moment.
    -- If the company itself is being deleted, there's nothing to protect.
    PERFORM 1 FROM companies WHERE id = OLD.company_id FOR UPDATE;
    IF FOUND AND NOT EXISTS (
      SELECT 1 FROM users WHERE company_id = OLD.company_id AND role = 'owner' AND id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'last_owner';
    END IF;
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS users_protect_last_owner ON users;
CREATE TRIGGER users_protect_last_owner
  BEFORE UPDATE OF role, company_id OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION trg_protect_last_owner();

-- ------------------------------------------------------------
-- 5. Team changes. p_actor is always the signed-in person, checked here.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION team_change_role(p_actor uuid, p_target uuid, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor  users;
  target users;
BEGIN
  IF p_role NOT IN ('owner', 'admin', 'member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  SELECT * INTO actor FROM users WHERE id = p_actor;
  SELECT * INTO target FROM users WHERE id = p_target;
  IF actor.id IS NULL OR actor.role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF target.id IS NULL OR target.company_id <> actor.company_id THEN RAISE EXCEPTION 'not_in_company'; END IF;
  IF actor.role = 'admin' AND (target.role = 'owner' OR p_role = 'owner') THEN RAISE EXCEPTION 'owners_only'; END IF;
  UPDATE users SET role = p_role, updated_at = now() WHERE id = p_target;
END
$$;

CREATE OR REPLACE FUNCTION team_remove_member(p_actor uuid, p_target uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor  users;
  target users;
BEGIN
  SELECT * INTO actor FROM users WHERE id = p_actor;
  SELECT * INTO target FROM users WHERE id = p_target;
  IF actor.id IS NULL OR actor.role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF target.id IS NULL OR target.company_id <> actor.company_id THEN RAISE EXCEPTION 'not_in_company'; END IF;
  IF actor.role = 'admin' AND target.role = 'owner' THEN RAISE EXCEPTION 'owners_only'; END IF;
  DELETE FROM users WHERE id = p_target;
END
$$;

-- A person joins the company that invited them. Only called once their email is confirmed.
CREATE OR REPLACE FUNCTION claim_company_invite(p_user uuid, p_email text, p_name text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  invite company_invites;
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE id = p_user) THEN RETURN false; END IF;
  SELECT * INTO invite FROM company_invites
   WHERE lower(email) = lower(p_email) AND accepted_at IS NULL AND cancelled_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO users (id, company_id, email, full_name, role)
  VALUES (p_user, invite.company_id, p_email, p_name, invite.role);
  UPDATE company_invites SET accepted_at = now() WHERE id = invite.id;
  RETURN true;
END
$$;

-- ------------------------------------------------------------
-- 6. Requests and decisions
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_company_request(
  p_user uuid, p_candidate uuid, p_type text, p_note text, p_salary numeric, p_start date
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who users;
  v_id uuid;
BEGIN
  SELECT * INTO who FROM users WHERE id = p_user;
  IF who.id IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF p_type NOT IN ('unlock', 'hire') THEN RAISE EXCEPTION 'invalid_type'; END IF;
  PERFORM 1 FROM candidates WHERE id = p_candidate;
  IF NOT FOUND THEN RAISE EXCEPTION 'candidate_not_found'; END IF;

  -- A company can't unlock or hire a candidate it referred
  IF EXISTS (SELECT 1 FROM candidate_referrers WHERE candidate_id = p_candidate AND company_id = who.company_id)
     OR EXISTS (SELECT 1 FROM candidates WHERE id = p_candidate AND uploaded_by_company_id = who.company_id) THEN
    RAISE EXCEPTION 'own_referral';
  END IF;
  IF EXISTS (SELECT 1 FROM hires WHERE candidate_id = p_candidate) THEN RAISE EXCEPTION 'already_hired'; END IF;

  IF p_type = 'unlock' THEN
    IF EXISTS (SELECT 1 FROM candidate_unlocks WHERE candidate_id = p_candidate
               AND requesting_company_id = who.company_id AND status = 'approved') THEN
      RAISE EXCEPTION 'already_unlocked';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM candidate_unlocks WHERE candidate_id = p_candidate
                   AND requesting_company_id = who.company_id AND status = 'approved') THEN
      RAISE EXCEPTION 'not_unlocked';
    END IF;
    IF p_salary IS NULL OR p_salary <= 0 THEN RAISE EXCEPTION 'invalid_salary'; END IF;
    IF p_start IS NULL THEN RAISE EXCEPTION 'invalid_start_date'; END IF;
  END IF;

  BEGIN
    INSERT INTO company_requests (company_id, candidate_id, type, requested_by, note, proposed_salary, proposed_start_date)
    VALUES (who.company_id, p_candidate, p_type, p_user, nullif(btrim(p_note), ''), p_salary, p_start)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_pending';
  END;
  RETURN v_id;
END
$$;

-- Loads a pending request for a decision, checking the approver's role and company
CREATE OR REPLACE FUNCTION lock_request_for_decision(p_request uuid, p_approver uuid)
RETURNS company_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who users;
  req company_requests;
BEGIN
  SELECT * INTO who FROM users WHERE id = p_approver;
  IF who.id IS NULL OR who.role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO req FROM company_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND OR req.company_id <> who.company_id THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'already_decided'; END IF;
  RETURN req;
END
$$;

CREATE OR REPLACE FUNCTION unlock_for_company(p_candidate uuid, p_company uuid, p_actor uuid, p_requested_by uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM candidate_referrers WHERE candidate_id = p_candidate AND company_id = p_company)
     OR EXISTS (SELECT 1 FROM candidates WHERE id = p_candidate AND uploaded_by_company_id = p_company) THEN
    RAISE EXCEPTION 'own_referral';
  END IF;
  INSERT INTO candidate_unlocks (candidate_id, requesting_company_id, status, unlocked_at, requested_by, approved_by)
  VALUES (p_candidate, p_company, 'approved', now(), p_requested_by, p_actor)
  ON CONFLICT (candidate_id, requesting_company_id) DO UPDATE
    SET status = 'approved', unlocked_at = coalesce(candidate_unlocks.unlocked_at, now()),
        requested_by = coalesce(candidate_unlocks.requested_by, excluded.requested_by),
        approved_by = coalesce(candidate_unlocks.approved_by, excluded.approved_by)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

CREATE OR REPLACE FUNCTION approve_unlock_request(p_request uuid, p_approver uuid)
RETURNS company_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req company_requests;
BEGIN
  req := lock_request_for_decision(p_request, p_approver);
  IF req.type <> 'unlock' THEN RAISE EXCEPTION 'wrong_type'; END IF;
  PERFORM unlock_for_company(req.candidate_id, req.company_id, p_approver, req.requested_by);
  UPDATE company_requests SET status = 'approved', decided_by = p_approver, decided_at = now()
   WHERE id = p_request RETURNING * INTO req;
  RETURN req;
END
$$;

-- p_salary and p_start are what the approver confirmed, which may be edited
CREATE OR REPLACE FUNCTION approve_hire_request(p_request uuid, p_approver uuid, p_salary numeric, p_start date)
RETURNS company_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req company_requests;
  result jsonb;
BEGIN
  req := lock_request_for_decision(p_request, p_approver);
  IF req.type <> 'hire' THEN RAISE EXCEPTION 'wrong_type'; END IF;
  -- Records the hire and every commission, or fails and changes nothing
  result := record_hire(req.candidate_id, req.company_id, p_approver, coalesce(p_salary, req.proposed_salary), coalesce(p_start, req.proposed_start_date));
  UPDATE hires SET requested_by = req.requested_by WHERE id = (result ->> 'hire_id')::uuid;
  UPDATE company_requests
     SET status = 'approved', decided_by = p_approver, decided_at = now(),
         approved_salary = coalesce(p_salary, req.proposed_salary),
         approved_start_date = coalesce(p_start, req.proposed_start_date),
         hire_id = (result ->> 'hire_id')::uuid
   WHERE id = p_request RETURNING * INTO req;
  RETURN req;
END
$$;

CREATE OR REPLACE FUNCTION decline_company_request(p_request uuid, p_approver uuid, p_reason text)
RETURNS company_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req company_requests;
BEGIN
  IF nullif(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
  req := lock_request_for_decision(p_request, p_approver);
  UPDATE company_requests SET status = 'declined', decided_by = p_approver, decided_at = now(), decline_reason = btrim(p_reason)
   WHERE id = p_request RETURNING * INTO req;
  RETURN req;
END
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'trg_protect_last_owner()',
    'team_change_role(uuid, uuid, text)',
    'team_remove_member(uuid, uuid)',
    'claim_company_invite(uuid, text, text)',
    'create_company_request(uuid, uuid, text, text, numeric, date)',
    'lock_request_for_decision(uuid, uuid)',
    'unlock_for_company(uuid, uuid, uuid, uuid)',
    'approve_unlock_request(uuid, uuid)',
    'approve_hire_request(uuid, uuid, numeric, date)',
    'decline_company_request(uuid, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END
$$;

-- ------------------------------------------------------------
-- 7. Marketplace view: the total fee now also depends on the viewer's role, and
--    viewer_unlocked says whether their company has this candidate unlocked.
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
FROM candidates c;

REVOKE ALL ON candidates_public FROM PUBLIC, anon;
GRANT SELECT ON candidates_public TO authenticated;

COMMIT;

-- ------------------------------------------------------------
-- 8. Report
-- ------------------------------------------------------------
SELECT check_name, result FROM (
  SELECT 1 AS ord, 'Owners' AS check_name, count(*)::text AS result FROM users WHERE role = 'owner'
  UNION ALL SELECT 2, 'Admins', count(*)::text FROM users WHERE role = 'admin'
  UNION ALL SELECT 3, 'Members', count(*)::text FROM users WHERE role = 'member'
  UNION ALL SELECT 4, 'Companies with no Owner (must be 0)', count(*)::text
    FROM companies c WHERE EXISTS (SELECT 1 FROM users u WHERE u.company_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.company_id = c.id AND u.role = 'owner')
  UNION ALL SELECT 5, 'Companies letting Members see fees', count(*)::text FROM companies WHERE members_see_fees
) report ORDER BY ord;
