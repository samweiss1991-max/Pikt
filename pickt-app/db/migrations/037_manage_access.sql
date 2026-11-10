-- ============================================================
-- Manage access — Migration 037
-- Requires migration 036.
--
-- Replaces the fixed role rules about money and actions with permissions the Owner
-- grants per role. The Owner always has every permission. Admins and Members start
-- with NONE, and the Owner turns them on in Account settings → Manage access.
--
--   approve        Approve unlocks & hires (includes seeing placement fees)
--   unlock         Unlock candidate profiles
--   record_hire    Record hires
--   see_commission See commission amounts & totals
--   manage_users   Invite and remove users
--   see_billing    See billing & unlock history
--   export         Export data (CSV)
--
-- Linked: nobody spends money without seeing the fee. Turning on unlock or
-- record_hire also turns on approve; turning off approve also turns off both.
-- Every change is logged.
--
-- Browsing, searching, saving and referring are always allowed and aren't listed.
-- The "Let Members see fees" setting from 036 is no longer used; its column is kept.
--
-- Apply in the Supabase SQL editor. Runs as one transaction: if anything fails,
-- nothing changes. Safe to re-run. Ends with a report.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.company_requests') IS NULL THEN
    RAISE EXCEPTION 'Not ready: run migration 036 first. Nothing was changed.';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 1. Permissions and their history
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_permissions (
  company_id  uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('admin', 'member')),
  permission  text NOT NULL CHECK (permission IN ('approve', 'unlock', 'record_hire', 'see_commission', 'manage_users', 'see_billing', 'export')),
  allowed     boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, role, permission)
);

CREATE TABLE IF NOT EXISTS permission_changes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  changed_by  uuid,
  role        text NOT NULL,
  permission  text NOT NULL,
  allowed     boolean NOT NULL,
  -- true when the change was made automatically because of a linked permission
  automatic   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_permission_changes_company ON permission_changes (company_id, created_at DESC);

-- Not paid yet for every hire: there's no employer invoicing yet (see TODO.md)
ALTER TABLE hires ADD COLUMN IF NOT EXISTS fee_paid_at timestamptz;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_permissions', 'permission_changes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON %I TO service_role', t);
  END LOOP;
END
$$;

-- ------------------------------------------------------------
-- 2. The one check everything uses
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_permission(p_user uuid, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT u.role = 'owner' OR coalesce((
      SELECT cp.allowed FROM company_permissions cp
      WHERE cp.company_id = u.company_id AND cp.role = u.role AND cp.permission = p_permission
    ), false)
    FROM users u WHERE u.id = p_user
  ), false)
$$;

-- The marketplace view and the savings figure call this: placement fees now follow
-- the "approve" permission (it replaces the 036 role rule and setting)
CREATE OR REPLACE FUNCTION viewer_can_see_money()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_permission(auth.uid(), 'approve')
$$;

-- Everyone who gets new requests: the Owners, plus roles allowed to approve
CREATE OR REPLACE FUNCTION company_approvers(p_company uuid)
RETURNS TABLE (id uuid, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email FROM users u
  WHERE u.company_id = p_company AND has_permission(u.id, 'approve')
$$;

-- ------------------------------------------------------------
-- 3. Changing a permission. Owners only; linked permissions follow.
--    Returns every change made, so the screen can explain automatic ones.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_role_permission(p_actor uuid, p_role text, p_permission text, p_allowed boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor users;
  changes jsonb := '[]'::jsonb;
  linked text;
BEGIN
  SELECT * INTO actor FROM users WHERE id = p_actor;
  IF actor.id IS NULL OR actor.role <> 'owner' THEN RAISE EXCEPTION 'owners_only'; END IF;
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF p_permission NOT IN ('approve', 'unlock', 'record_hire', 'see_commission', 'manage_users', 'see_billing', 'export') THEN
    RAISE EXCEPTION 'invalid_permission';
  END IF;

  -- One change at a time per company, so two Owners can't leave a half-linked state
  PERFORM 1 FROM companies WHERE id = actor.company_id FOR UPDATE;

  -- The change asked for, then whatever it requires
  FOR linked IN
    SELECT unnest(CASE
      WHEN p_allowed AND p_permission IN ('unlock', 'record_hire') THEN ARRAY[p_permission, 'approve']
      WHEN NOT p_allowed AND p_permission = 'approve' THEN ARRAY['approve', 'unlock', 'record_hire']
      ELSE ARRAY[p_permission]
    END)
  LOOP
    IF has_permission_for_role(actor.company_id, p_role, linked) IS DISTINCT FROM p_allowed THEN
      INSERT INTO company_permissions (company_id, role, permission, allowed, updated_at)
      VALUES (actor.company_id, p_role, linked, p_allowed, now())
      ON CONFLICT (company_id, role, permission) DO UPDATE SET allowed = excluded.allowed, updated_at = now();
      INSERT INTO permission_changes (company_id, changed_by, role, permission, allowed, automatic)
      VALUES (actor.company_id, p_actor, p_role, linked, p_allowed, linked <> p_permission);
      changes := changes || jsonb_build_object('permission', linked, 'allowed', p_allowed, 'automatic', linked <> p_permission);
    END IF;
  END LOOP;
  RETURN changes;
END
$$;

CREATE OR REPLACE FUNCTION has_permission_for_role(p_company uuid, p_role text, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT allowed FROM company_permissions
                   WHERE company_id = p_company AND role = p_role AND permission = p_permission), false)
$$;

-- ------------------------------------------------------------
-- 4. Existing rules now ask for permissions instead of roles
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
  IF actor.id IS NULL OR NOT has_permission(p_actor, 'manage_users') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF target.id IS NULL OR target.company_id <> actor.company_id THEN RAISE EXCEPTION 'not_in_company'; END IF;
  IF actor.role <> 'owner' AND (target.role = 'owner' OR p_role = 'owner') THEN RAISE EXCEPTION 'owners_only'; END IF;
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
  IF actor.id IS NULL OR NOT has_permission(p_actor, 'manage_users') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF target.id IS NULL OR target.company_id <> actor.company_id THEN RAISE EXCEPTION 'not_in_company'; END IF;
  IF actor.role <> 'owner' AND target.role = 'owner' THEN RAISE EXCEPTION 'owners_only'; END IF;
  DELETE FROM users WHERE id = p_target;
END
$$;

CREATE OR REPLACE FUNCTION lock_request_for_decision(p_request uuid, p_approver uuid)
RETURNS company_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who users;
  req company_requests;
BEGIN
  SELECT * INTO who FROM users WHERE id = p_approver;
  IF who.id IS NULL OR NOT has_permission(p_approver, 'approve') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO req FROM company_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND OR req.company_id <> who.company_id THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'already_decided'; END IF;
  RETURN req;
END
$$;

-- ------------------------------------------------------------
-- 5. Only server functions may run these
-- ------------------------------------------------------------
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'has_permission(uuid, text)',
    'company_approvers(uuid)',
    'set_role_permission(uuid, text, text, boolean)',
    'has_permission_for_role(uuid, text, text)',
    'team_change_role(uuid, uuid, text)',
    'team_remove_member(uuid, uuid)',
    'lock_request_for_decision(uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION viewer_can_see_money() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION viewer_can_see_money() TO authenticated, service_role;

COMMIT;

-- ------------------------------------------------------------
-- 6. Report
-- ------------------------------------------------------------
SELECT check_name, result FROM (
  SELECT 1 AS ord, 'Owners (always have every permission)' AS check_name, count(*)::text AS result FROM users WHERE role = 'owner'
  UNION ALL SELECT 2, 'Admins', count(*)::text FROM users WHERE role = 'admin'
  UNION ALL SELECT 3, 'Members', count(*)::text FROM users WHERE role = 'member'
  UNION ALL SELECT 4, 'Permissions turned on for Admins or Members', count(*)::text FROM company_permissions WHERE allowed
) report ORDER BY ord;
