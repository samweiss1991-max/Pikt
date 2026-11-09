-- ============================================================
-- Fix access rules — Migration 033
-- Requires migrations 027 and 032.
--
-- WHAT THIS FIXES
--   1. "Infinite recursion" errors: the users rule read the users table, and the
--      candidates and candidate_unlocks rules read each other.
--   2. Anyone logged in could change their own company_id and role in users, and so
--      join any company. Nothing in the app does this, so browsers lose that ability.
--   3. Anyone logged in could create companies, and company members could rename
--      theirs. Nothing in the app does this from a browser either.
--   4. The old placements table let referrers read an employer's fee.
--   5. Logged-out visitors no longer reach any of these tables at all.
--
-- All writes to these tables go through server functions, which aren't affected.
-- No data is changed or deleted, only who can reach it.
--
-- Apply in the Supabase SQL editor. Runs as one transaction: if anything fails,
-- nothing changes. Safe to re-run. Ends with a report of what browsers can do.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.current_company_id()') IS NULL THEN
    RAISE EXCEPTION 'Not ready: current_company_id() is missing. Apply migration 027 first. Nothing was changed.';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 1. users: see your own company's people; no browser changes
--    current_company_id() runs with its own permissions, so it doesn't
--    trigger this rule again. That's what ends the recursion.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_same_company" ON users;
DROP POLICY IF EXISTS "users_insert_self" ON users;
DROP POLICY IF EXISTS "users_update_self" ON users;

CREATE POLICY "users_select_same_company" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR company_id = current_company_id());

-- ------------------------------------------------------------
-- 2. companies: see your own; no browser changes
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "companies_select_own" ON companies;
DROP POLICY IF EXISTS "companies_insert_authenticated" ON companies;
DROP POLICY IF EXISTS "companies_update_own" ON companies;

CREATE POLICY "companies_select_own" ON companies
  FOR SELECT TO authenticated
  USING (id = current_company_id());

-- ------------------------------------------------------------
-- 3. candidate_unlocks: see your own company's unlocks; no browser changes
--    The rule that let a referrer see who unlocked is removed. It read candidates
--    while candidates read this table. Referrers get a count from my-referrals.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "unlocks_select_own" ON candidate_unlocks;
DROP POLICY IF EXISTS "unlocks_insert_own" ON candidate_unlocks;
DROP POLICY IF EXISTS "unlocks_select_uploader" ON candidate_unlocks;

CREATE POLICY "unlocks_select_own" ON candidate_unlocks
  FOR SELECT TO authenticated
  USING (requesting_company_id = current_company_id());

-- ------------------------------------------------------------
-- 4. candidates: read rows your company added or has unlocked; no browser changes
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "candidates_select_own" ON candidates;
DROP POLICY IF EXISTS "candidates_select_restrict" ON candidates;
DROP POLICY IF EXISTS "candidates_select_own_or_unlocked" ON candidates;
DROP POLICY IF EXISTS "candidates_insert_own" ON candidates;
DROP POLICY IF EXISTS "candidates_update_own" ON candidates;
DROP POLICY IF EXISTS "candidates_delete_own" ON candidates;

CREATE POLICY "candidates_select_own_or_unlocked" ON candidates
  FOR SELECT TO authenticated
  USING (
    uploaded_by_company_id = current_company_id()
    OR EXISTS (
      SELECT 1 FROM candidate_unlocks u
      WHERE u.candidate_id = candidates.id
        AND u.requesting_company_id = current_company_id()
        AND u.status = 'approved'
    )
  );

-- ------------------------------------------------------------
-- 5. Old placements table: no browser access at all. Any rows are kept.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.placements') IS NOT NULL THEN
    DROP POLICY IF EXISTS "placements_select_involved" ON placements;
    ALTER TABLE placements ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON placements FROM PUBLIC, anon, authenticated;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 6. Browser permissions, on top of the rules above
-- ------------------------------------------------------------
REVOKE ALL ON users, companies, candidates, candidate_unlocks FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON users, companies, candidates, candidate_unlocks FROM authenticated;
GRANT SELECT ON users, companies, candidates, candidate_unlocks TO authenticated;

REVOKE ALL ON saved_candidates FROM PUBLIC, anon;
REVOKE ALL ON saved_searches FROM PUBLIC, anon;

COMMIT;

-- ------------------------------------------------------------
-- 7. Report. Every "can" column except can_read for logged-in users should be false.
-- ------------------------------------------------------------
SELECT t AS table_name,
       has_table_privilege('anon', 'public.' || t, 'SELECT') AS logged_out_can_read,
       has_table_privilege('anon', 'public.' || t, 'INSERT,UPDATE,DELETE') AS logged_out_can_change,
       has_table_privilege('authenticated', 'public.' || t, 'SELECT') AS logged_in_can_read,
       has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE') AS logged_in_can_change
FROM unnest(ARRAY['users', 'companies', 'candidates', 'candidate_unlocks']) AS t
UNION ALL
SELECT 'placements',
       has_table_privilege('anon', 'public.placements', 'SELECT'),
       has_table_privilege('anon', 'public.placements', 'INSERT,UPDATE,DELETE'),
       has_table_privilege('authenticated', 'public.placements', 'SELECT'),
       has_table_privilege('authenticated', 'public.placements', 'INSERT,UPDATE,DELETE')
WHERE to_regclass('public.placements') IS NOT NULL
ORDER BY 1;
