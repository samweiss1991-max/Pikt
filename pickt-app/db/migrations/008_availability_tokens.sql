-- ============================================================
-- Availability confirmation tokens — Migration 008
-- One-click tokenised confirm/remove links for email checks.
-- ============================================================

CREATE TABLE IF NOT EXISTS availability_token (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_public_id   uuid NOT NULL,
  company_id            uuid NOT NULL,
  action                varchar NOT NULL CHECK (action IN ('confirm', 'remove')),
  used_at               timestamptz,
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_avail_token_candidate
    FOREIGN KEY (candidate_public_id)
    REFERENCES candidate_public (id) ON DELETE CASCADE,
  CONSTRAINT fk_avail_token_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_avail_token_candidate
  ON availability_token (candidate_public_id);
CREATE INDEX IF NOT EXISTS idx_avail_token_unused
  ON availability_token (id) WHERE used_at IS NULL;
