-- ============================================================
-- Usage Metrics & Quotas — Migration 018
-- ============================================================

CREATE TABLE IF NOT EXISTS usage_metric (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL,
  metric_type   varchar NOT NULL
                CHECK (metric_type IN ('cv_parse', 'unlock', 'ats_import', 'api_call')),
  count         integer NOT NULL DEFAULT 0,
  period_start  timestamptz NOT NULL,
  period_end    timestamptz NOT NULL,

  CONSTRAINT fk_usage_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT uq_usage_metric
    UNIQUE (company_id, metric_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_company_type
  ON usage_metric (company_id, metric_type, period_start DESC);

ALTER TABLE usage_metric ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_select_own" ON usage_metric
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Service role manages usage records
CREATE POLICY "usage_manage_service" ON usage_metric
  FOR ALL WITH CHECK (true);

-- Helper: increment a usage metric for the current month
CREATE OR REPLACE FUNCTION increment_usage(
  p_company_id uuid,
  p_metric_type varchar
)
RETURNS integer AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_count integer;
BEGIN
  v_period_start := date_trunc('month', now());
  v_period_end := date_trunc('month', now()) + interval '1 month';

  INSERT INTO usage_metric (company_id, metric_type, count, period_start, period_end)
  VALUES (p_company_id, p_metric_type, 1, v_period_start, v_period_end)
  ON CONFLICT (company_id, metric_type, period_start)
  DO UPDATE SET count = usage_metric.count + 1
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Helper: get current month usage
CREATE OR REPLACE FUNCTION get_usage(
  p_company_id uuid,
  p_metric_type varchar
)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count INTO v_count
  FROM usage_metric
  WHERE company_id = p_company_id
    AND metric_type = p_metric_type
    AND period_start = date_trunc('month', now());

  RETURN coalesce(v_count, 0);
END;
$$ LANGUAGE plpgsql STABLE;
