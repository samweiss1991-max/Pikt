-- ============================================================
-- Candidate Engagement Stats — Materialised View
-- Real-data engagement signals for marketplace tiles and profiles.
-- Refreshed every 30 minutes via cron.
-- ============================================================

-- 1. Supporting indexes for performant aggregation
CREATE INDEX IF NOT EXISTS idx_audit_candidate_event_date
  ON audit_log (candidate_id, event_type, created_at DESC);

-- 2. Shortlist table (if not already created)
CREATE TABLE IF NOT EXISTS shortlist (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    uuid NOT NULL,
  company_id      uuid NOT NULL,
  user_id         uuid NOT NULL,
  status          varchar NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'removed', 'pending_review')),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_shortlist_candidate
    FOREIGN KEY (candidate_id)
    REFERENCES candidate_public (id) ON DELETE CASCADE,
  CONSTRAINT fk_shortlist_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT uq_shortlist_candidate_company
    UNIQUE (candidate_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_shortlist_candidate
  ON shortlist (candidate_id, status);
CREATE INDEX IF NOT EXISTS idx_shortlist_company
  ON shortlist (company_id);

ALTER TABLE shortlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shortlist_select_own" ON shortlist
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY "shortlist_insert_own" ON shortlist
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY "shortlist_update_own" ON shortlist
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- 3. Drop and recreate materialised view
DROP MATERIALIZED VIEW IF EXISTS candidate_engagement_stats;

CREATE MATERIALIZED VIEW candidate_engagement_stats AS
SELECT
  a.candidate_id,

  -- Views
  COUNT(*) FILTER (
    WHERE a.event_type = 'profile_viewed'
      AND a.created_at > now() - interval '7 days'
  ) AS views_this_week,

  COUNT(*) FILTER (
    WHERE a.event_type = 'profile_viewed'
  ) AS views_total,

  -- Saves (from shortlist, excluding removed)
  (
    SELECT COUNT(*)
    FROM shortlist s
    WHERE s.candidate_id = a.candidate_id
      AND s.status != 'removed'
  ) AS saves_count,

  -- Companies currently reviewing (shortlist status = pending_review)
  (
    SELECT COUNT(*)
    FROM shortlist s
    WHERE s.candidate_id = a.candidate_id
      AND s.status = 'pending_review'
  ) AS reviewing_count,

  -- Unlock count
  (
    SELECT COUNT(*)
    FROM candidate_unlock cu
    WHERE cu.candidate_public_id = a.candidate_id
      AND cu.status = 'confirmed'
  ) AS unlock_count,

  -- Days since last unlock
  (
    SELECT EXTRACT(days FROM now() - MAX(cu.unlocked_at))
    FROM candidate_unlock cu
    WHERE cu.candidate_public_id = a.candidate_id
  )::integer AS days_since_last_unlock,

  -- Popular flag: >5 views this week
  CASE
    WHEN COUNT(*) FILTER (
      WHERE a.event_type = 'profile_viewed'
        AND a.created_at > now() - interval '7 days'
    ) > 5 THEN true
    ELSE false
  END AS is_popular

FROM audit_log a
WHERE a.candidate_id IS NOT NULL
GROUP BY a.candidate_id;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_stats_candidate_id
  ON candidate_engagement_stats (candidate_id);

-- 4. Refresh function
CREATE OR REPLACE FUNCTION refresh_engagement_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY candidate_engagement_stats;
END;
$$ LANGUAGE plpgsql;
