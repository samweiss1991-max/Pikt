-- ============================================================
-- Reputation Score System — Migration 022
-- ============================================================

-- 1. Company reputation table
CREATE TABLE IF NOT EXISTS company_reputation (
  company_id                  uuid PRIMARY KEY,
  placement_rate              numeric(5,4) DEFAULT 0,
  placement_rate_score        numeric(3,1) DEFAULT 0
                              CHECK (placement_rate_score >= 0 AND placement_rate_score <= 5),
  listing_quality_score       numeric(3,1) DEFAULT 0
                              CHECK (listing_quality_score >= 0 AND listing_quality_score <= 5),
  availability_accuracy_score numeric(3,1) DEFAULT 0
                              CHECK (availability_accuracy_score >= 0 AND availability_accuracy_score <= 5),
  response_rate_score         numeric(3,1) DEFAULT 0
                              CHECK (response_rate_score >= 0 AND response_rate_score <= 5),
  overall_score               numeric(3,1) DEFAULT 0
                              CHECK (overall_score >= 0 AND overall_score <= 5),
  total_placements            integer NOT NULL DEFAULT 0,
  total_unlocks               integer NOT NULL DEFAULT 0,
  member_since                date,
  last_calculated_at          timestamptz,
  score_version               integer NOT NULL DEFAULT 1,

  CONSTRAINT fk_reputation_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id) ON DELETE CASCADE
);

-- 2. Pending response tracking (48-hour SLA)
CREATE TABLE IF NOT EXISTS pending_response (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_company_id uuid NOT NULL,
  buyer_company_id    uuid NOT NULL,
  candidate_id        uuid NOT NULL,
  unlock_id           uuid NOT NULL,
  stage               varchar NOT NULL DEFAULT 'contacted',
  created_at          timestamptz NOT NULL DEFAULT now(),
  sla_deadline        timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  responded_at        timestamptz,
  status              varchar NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'responded', 'expired')),

  CONSTRAINT fk_pending_resp_referrer
    FOREIGN KEY (referrer_company_id)
    REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT fk_pending_resp_buyer
    FOREIGN KEY (buyer_company_id)
    REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT fk_pending_resp_candidate
    FOREIGN KEY (candidate_id)
    REFERENCES candidate_public (id) ON DELETE CASCADE,
  CONSTRAINT fk_pending_resp_unlock
    FOREIGN KEY (unlock_id)
    REFERENCES candidate_unlock (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_resp_referrer
  ON pending_response (referrer_company_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_resp_pending
  ON pending_response (status, sla_deadline)
  WHERE status = 'pending';

-- 3. RLS
ALTER TABLE company_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_response ENABLE ROW LEVEL SECURITY;

-- Anyone can read reputation (it's public)
CREATE POLICY "reputation_select_all" ON company_reputation
  FOR SELECT USING (true);

-- Service role manages reputation
CREATE POLICY "reputation_manage_service" ON company_reputation
  FOR ALL WITH CHECK (true);

-- Referrer sees their own pending responses
CREATE POLICY "pending_resp_select_referrer" ON pending_response
  FOR SELECT USING (
    referrer_company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "pending_resp_update_referrer" ON pending_response
  FOR UPDATE USING (
    referrer_company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Service role creates pending responses
CREATE POLICY "pending_resp_insert_service" ON pending_response
  FOR INSERT WITH CHECK (true);
