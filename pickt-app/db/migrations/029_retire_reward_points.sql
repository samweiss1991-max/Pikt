-- ============================================================
-- Retire reward points — Migration 029
--
-- The reward points system has been removed from the app. This hides the
-- old data WITHOUT deleting it: no user or server function can read or add
-- to it any more, but every row stays in the database.
--
-- Apply in the Supabase SQL editor. Safe to re-run, and safe if the table
-- or view doesn't exist.
--
-- To DELETE the old points data permanently later (cannot be undone):
--
--   DROP VIEW IF EXISTS company_points_balance;
--   DROP TABLE IF EXISTS referral_points;
--
-- To look at the old data first (the SQL editor still has access):
--
--   SELECT * FROM referral_points ORDER BY created_at DESC;
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.company_points_balance') IS NOT NULL THEN
    REVOKE ALL ON company_points_balance FROM PUBLIC, anon, authenticated, service_role;
    COMMENT ON VIEW company_points_balance IS
      'RETIRED by migration 029. Reward points are no longer used. Kept only as a record.';
  END IF;

  IF to_regclass('public.referral_points') IS NOT NULL THEN
    DROP POLICY IF EXISTS "referral_points_select_own" ON referral_points;
    -- service_role too, so an older deployed create-candidate can't add new points
    REVOKE ALL ON referral_points FROM PUBLIC, anon, authenticated, service_role;
    COMMENT ON TABLE referral_points IS
      'RETIRED by migration 029. Reward points are no longer used. Kept only as a record.';
  END IF;
END
$$;
