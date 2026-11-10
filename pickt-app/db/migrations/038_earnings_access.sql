-- ============================================================
-- Earnings & savings — Migration 038
-- Requires migration 037.
--
-- 1. A new permission, see_earnings ("View earnings & savings"). The Owner always
--    has it; Admins and Members start without it, and the Owner turns it on in
--    Account settings -> Manage access.
-- 2. One place for Pickt-wide settings, starting with the agency fee that savings
--    are compared against (20% of first-year salary). To change it later:
--      UPDATE app_settings SET value = '22' WHERE key = 'agency_fee_benchmark_percent';
--
-- Apply in the Supabase SQL editor. Runs as one transaction: if anything fails,
-- nothing changes. Safe to re-run. Ends with a report.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.company_permissions') IS NULL THEN
    RAISE EXCEPTION 'Not ready: run migration 037 first. Nothing was changed.';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 1. Allow the new permission in the permissions table
-- ------------------------------------------------------------
DO $$
DECLARE
  c text;
BEGIN
  -- Remove the old list, whatever the database named it
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'company_permissions'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%permission%'
  LOOP
    EXECUTE format('ALTER TABLE company_permissions DROP CONSTRAINT %I', c);
  END LOOP;
END
$$;
ALTER TABLE company_permissions ADD CONSTRAINT company_permissions_permission_check CHECK (
  permission IN ('approve', 'unlock', 'record_hire', 'see_commission', 'manage_users', 'see_billing', 'export', 'see_earnings')
);

-- Same as 037, with see_earnings added to the allowed list
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
  IF p_permission NOT IN ('approve', 'unlock', 'record_hire', 'see_commission', 'manage_users', 'see_billing', 'export', 'see_earnings') THEN
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

REVOKE ALL ON FUNCTION set_role_permission(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_role_permission(uuid, text, text, boolean) TO service_role;

-- ------------------------------------------------------------
-- 2. Settings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON app_settings TO service_role;

-- Only added the first time: re-running never undoes a change you made
INSERT INTO app_settings (key, value, description)
VALUES ('agency_fee_benchmark_percent', '20', 'Typical Australian agency fee (% of first-year salary) that savings are compared with')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ------------------------------------------------------------
-- 3. Report
-- ------------------------------------------------------------
SELECT check_name, result FROM (
  SELECT 1 AS ord, 'Agency fee benchmark (%)' AS check_name, (SELECT value FROM app_settings WHERE key = 'agency_fee_benchmark_percent') AS result
  UNION ALL SELECT 2, 'View earnings & savings turned on for Admins or Members', count(*)::text FROM company_permissions WHERE permission = 'see_earnings' AND allowed
  UNION ALL SELECT 3, 'Hires that savings are worked out from', count(*)::text FROM hires
) report ORDER BY ord;
