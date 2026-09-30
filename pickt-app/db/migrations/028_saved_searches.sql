-- ============================================================
-- Saved searches — Migration 028
-- Requires migration 027 (current_company_id()).
--
-- An employer's named searches ("Save search" on the marketplace), stored on
-- their account so they're available on any device. Each user sees and
-- deletes only their own. The browser's "remembered last search" is separate
-- and never stored here.
--
-- Apply in the Supabase SQL editor after 027. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_searches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  company_id    uuid DEFAULT current_company_id() REFERENCES companies (id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  -- { query, categories[], salaryMin, salaryMax, minExperience, availability[], workPreference[], locations[] }
  criteria      jsonb NOT NULL,
  -- Normalised fingerprint of `criteria`, so the same search can't be saved twice
  criteria_key  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_saved_search_user_criteria UNIQUE (user_id, criteria_key)
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches (user_id, created_at DESC);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_searches_select_own" ON saved_searches;
CREATE POLICY "saved_searches_select_own" ON saved_searches
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_searches_insert_own" ON saved_searches;
CREATE POLICY "saved_searches_insert_own" ON saved_searches
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_searches_delete_own" ON saved_searches;
CREATE POLICY "saved_searches_delete_own" ON saved_searches
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON saved_searches TO authenticated;
