-- ============================================================
-- Engagement Stats — Migration 004
-- Materialised view for social proof on candidate profiles.
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS candidate_engagement_stats AS
SELECT
  al.candidate_id,
  count(*) FILTER (
    WHERE al.event_type = 'profile_viewed'
      AND al.created_at >= now() - interval '7 days'
  ) AS views_this_week,
  count(DISTINCT al.actor_company_id) FILTER (
    WHERE al.event_type = 'shortlist_added'
  ) AS saves_count,
  count(DISTINCT al.actor_company_id) FILTER (
    WHERE al.event_type = 'profile_unlocked'
      OR al.event_type = 'pii_accessed'
  ) AS reviewing_count
FROM audit_log al
WHERE al.candidate_id IS NOT NULL
GROUP BY al.candidate_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_stats_candidate
  ON candidate_engagement_stats (candidate_id);

-- Refresh function (call periodically via cron or on-demand)
CREATE OR REPLACE FUNCTION refresh_engagement_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY candidate_engagement_stats;
END;
$$ LANGUAGE plpgsql;
