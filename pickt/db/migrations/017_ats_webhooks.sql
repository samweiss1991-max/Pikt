-- ============================================================
-- ATS Webhooks — Migration 017
-- Webhook receiver config and pending referral prompts.
-- ============================================================

-- 1. ATS provider enum
DO $$ BEGIN
  CREATE TYPE ats_provider AS ENUM ('greenhouse', 'lever', 'workday');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ats_webhook_status AS ENUM ('active', 'inactive', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pending_referral_status AS ENUM ('pending', 'actioned', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Webhook configuration
CREATE TABLE IF NOT EXISTS ats_webhook_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL,
  ats_provider          ats_provider NOT NULL,
  webhook_secret        text NOT NULL,
  webhook_endpoint_url  text NOT NULL,
  last_ping_at          timestamptz,
  last_event_received_at timestamptz,
  status                ats_webhook_status NOT NULL DEFAULT 'inactive',
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_ats_config_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT uq_ats_config_company_provider
    UNIQUE (company_id, ats_provider)
);

CREATE INDEX IF NOT EXISTS idx_ats_config_company
  ON ats_webhook_config (company_id);

-- 3. Pending referrals
CREATE TABLE IF NOT EXISTS pending_referral (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL,
  ats_provider          ats_provider NOT NULL,
  ats_candidate_id      text,
  ats_candidate_name    text,
  ats_role              text,
  ats_rejection_reason  text,
  ats_raw_payload       jsonb,
  status                pending_referral_status NOT NULL DEFAULT 'pending',
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_pending_referral_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_referral_company
  ON pending_referral (company_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_referral_status
  ON pending_referral (status) WHERE status = 'pending';

-- 4. Webhook event log (last N events for settings page)
CREATE TABLE IF NOT EXISTS ats_webhook_event (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       uuid NOT NULL,
  event_type      text,
  payload_summary text,
  processing_ms   integer,
  status          text NOT NULL DEFAULT 'processed'
                  CHECK (status IN ('processed', 'ignored', 'error')),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_webhook_event_config
    FOREIGN KEY (config_id)
    REFERENCES ats_webhook_config (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_config
  ON ats_webhook_event (config_id, created_at DESC);

-- 5. RLS
ALTER TABLE ats_webhook_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_referral ENABLE ROW LEVEL SECURITY;
ALTER TABLE ats_webhook_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ats_config_select_own" ON ats_webhook_config
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY "ats_config_manage_own" ON ats_webhook_config
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "pending_referral_select_own" ON pending_referral
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY "pending_referral_update_own" ON pending_referral
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "webhook_event_select_own" ON ats_webhook_event
  FOR SELECT USING (
    config_id IN (
      SELECT id FROM ats_webhook_config
      WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

-- Service role can insert events (from webhook handler)
CREATE POLICY "webhook_event_insert_service" ON ats_webhook_event
  FOR INSERT WITH CHECK (true);
CREATE POLICY "pending_referral_insert_service" ON pending_referral
  FOR INSERT WITH CHECK (true);
