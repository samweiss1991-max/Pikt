-- ============================================================
-- Fee Analytics — Migration 009
-- Platform stats for fee-band unlock rate tracking.
-- ============================================================

-- salary_band_low and salary_band_high already exist on
-- candidate_public from migration 001. No schema change needed.

-- 1. Platform stats table — recalculated nightly
CREATE TABLE IF NOT EXISTS platform_stats (
  id              varchar PRIMARY KEY,
  value           jsonb NOT NULL,
  calculated_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed the unlock-rate-by-fee-band stat
INSERT INTO platform_stats (id, value, calculated_at)
VALUES (
  'unlock_rate_by_fee_band',
  '{
    "bands": [
      { "min": 0,  "max": 5,  "unlock_rate": 0.42, "label": "0–5%" },
      { "min": 6,  "max": 10, "unlock_rate": 0.38, "label": "6–10%" },
      { "min": 11, "max": 14, "unlock_rate": 0.19, "label": "11–14%" },
      { "min": 15, "max": 100, "unlock_rate": 0.07, "label": "15%+" }
    ],
    "sample_size": 0,
    "note": "Seed data — will be overwritten by nightly job once sufficient data exists"
  }',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Function to recalculate unlock rates by fee band (nightly cron)
CREATE OR REPLACE FUNCTION recalculate_fee_band_stats()
RETURNS void AS $$
DECLARE
  result jsonb;
BEGIN
  WITH fee_bands AS (
    SELECT
      CASE
        WHEN cp.fee_percentage <= 5  THEN '0–5%'
        WHEN cp.fee_percentage <= 10 THEN '6–10%'
        WHEN cp.fee_percentage <= 14 THEN '11–14%'
        ELSE '15%+'
      END AS band_label,
      CASE
        WHEN cp.fee_percentage <= 5  THEN 0
        WHEN cp.fee_percentage <= 10 THEN 6
        WHEN cp.fee_percentage <= 14 THEN 11
        ELSE 15
      END AS band_min,
      CASE
        WHEN cp.fee_percentage <= 5  THEN 5
        WHEN cp.fee_percentage <= 10 THEN 10
        WHEN cp.fee_percentage <= 14 THEN 14
        ELSE 100
      END AS band_max,
      count(*) AS total_listed,
      count(cu.id) AS total_unlocked
    FROM candidate_public cp
    LEFT JOIN candidate_unlock cu ON cu.candidate_public_id = cp.id
      AND cu.status = 'confirmed'
    WHERE cp.created_at > now() - interval '90 days'
    GROUP BY 1, 2, 3
  )
  SELECT jsonb_build_object(
    'bands', jsonb_agg(
      jsonb_build_object(
        'min', band_min,
        'max', band_max,
        'label', band_label,
        'unlock_rate', CASE
          WHEN total_listed > 0
          THEN round(total_unlocked::numeric / total_listed, 2)
          ELSE 0
        END,
        'total_listed', total_listed,
        'total_unlocked', total_unlocked
      )
      ORDER BY band_min
    ),
    'sample_size', sum(total_listed)
  ) INTO result
  FROM fee_bands;

  UPDATE platform_stats
  SET value = coalesce(result, '{"bands":[],"sample_size":0}'::jsonb),
      calculated_at = now()
  WHERE id = 'unlock_rate_by_fee_band';
END;
$$ LANGUAGE plpgsql;
