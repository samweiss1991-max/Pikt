-- ============================================================
-- Dashboard — Migration 039
-- Requires migration 038.
--
-- 1. Contact tracking on unlocked candidates: "Mark as contacted" and
--    "Interviewing" on the candidate's profile. Per company, set by anyone in the
--    company that unlocked the candidate (through the dashboard server function).
-- 2. Saved searches remember when their owner last opened them, so the Dashboard
--    can say "3 new matches" (candidates added since then).
--
-- Saved searches double as the company's active roles. Each person still only
-- sees and changes their own saved searches in the browser; the Dashboard counts
-- the company's on the server.
--
-- Apply in the Supabase SQL editor. Runs as one transaction: if anything fails,
-- nothing changes. Safe to re-run. Ends with a report.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.app_settings') IS NULL THEN
    RAISE EXCEPTION 'Not ready: run migration 038 first. Nothing was changed.';
  END IF;
END
$$;

-- 1. Contact tracking
ALTER TABLE candidate_unlocks ADD COLUMN IF NOT EXISTS contacted_at     timestamptz;
ALTER TABLE candidate_unlocks ADD COLUMN IF NOT EXISTS interviewing_at  timestamptz;
ALTER TABLE candidate_unlocks ADD COLUMN IF NOT EXISTS stage_updated_by uuid;
CREATE INDEX IF NOT EXISTS idx_candidate_unlocks_company_status ON candidate_unlocks (requesting_company_id, status);

-- 2. When each saved search was last opened by its owner
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_saved_searches_company ON saved_searches (company_id, created_at DESC);

-- Marking a candidate contacted or interviewing: only for a company that has
-- unlocked them. Interviewing implies contacted. Clearing interviewing keeps contacted.
CREATE OR REPLACE FUNCTION set_unlock_stage(p_user uuid, p_candidate uuid, p_stage text)
RETURNS candidate_unlocks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who users;
  row_ candidate_unlocks;
BEGIN
  IF p_stage NOT IN ('unlocked', 'contacted', 'interviewing') THEN RAISE EXCEPTION 'invalid_stage'; END IF;
  SELECT * INTO who FROM users WHERE id = p_user;
  IF who.company_id IS NULL THEN RAISE EXCEPTION 'not_in_company'; END IF;
  SELECT * INTO row_ FROM candidate_unlocks
  WHERE candidate_id = p_candidate AND requesting_company_id = who.company_id AND status = 'approved'
  ORDER BY unlocked_at DESC NULLS LAST LIMIT 1 FOR UPDATE;
  IF row_.id IS NULL THEN RAISE EXCEPTION 'not_unlocked'; END IF;

  UPDATE candidate_unlocks SET
    contacted_at = CASE WHEN p_stage = 'unlocked' THEN NULL ELSE coalesce(contacted_at, now()) END,
    interviewing_at = CASE WHEN p_stage = 'interviewing' THEN coalesce(interviewing_at, now()) ELSE NULL END,
    stage_updated_by = p_user,
    updated_at = now()
  WHERE id = row_.id
  RETURNING * INTO row_;
  RETURN row_;
END
$$;

-- Opening a saved search: only its owner's visits count
CREATE OR REPLACE FUNCTION mark_saved_search_seen(p_user uuid, p_search uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE saved_searches SET last_seen_at = now() WHERE id = p_search AND user_id = p_user
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['set_unlock_stage(uuid, uuid, text)', 'mark_saved_search_seen(uuid, uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END
$$;

COMMIT;

-- Report
SELECT check_name, result FROM (
  SELECT 1 AS ord, 'Saved searches (active roles)' AS check_name, count(*)::text AS result FROM saved_searches
  UNION ALL SELECT 2, 'Unlocked candidates', count(*)::text FROM candidate_unlocks WHERE status = 'approved'
  UNION ALL SELECT 3, 'Contact tracking ready', (count(*) = 3)::text FROM information_schema.columns
    WHERE table_name = 'candidate_unlocks' AND column_name IN ('contacted_at', 'interviewing_at', 'stage_updated_by')
) report ORDER BY ord;
