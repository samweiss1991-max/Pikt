-- ============================================================
-- Placements — Migration 005
-- Tracks confirmed hires and the 90-day window.
-- ============================================================

CREATE TABLE IF NOT EXISTS placement (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_id             uuid NOT NULL UNIQUE,
  candidate_public_id   uuid NOT NULL,
  hiring_company_id     uuid NOT NULL,
  hired_at              date NOT NULL,
  annual_salary         integer NOT NULL CHECK (annual_salary > 0),
  fee_percentage        numeric(4,2) NOT NULL,
  fee_amount            integer NOT NULL CHECK (fee_amount >= 0),
  payment_method        varchar NOT NULL DEFAULT 'stripe'
                        CHECK (payment_method IN ('stripe', 'invoice')),
  stripe_payment_id     varchar,
  invoice_id            varchar,
  status                varchar NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed', 'paid', 'disputed', 'cancelled')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_placement_unlock
    FOREIGN KEY (unlock_id)
    REFERENCES candidate_unlock (id) ON DELETE CASCADE,
  CONSTRAINT fk_placement_candidate
    FOREIGN KEY (candidate_public_id)
    REFERENCES candidate_public (id) ON DELETE CASCADE,
  CONSTRAINT fk_placement_company
    FOREIGN KEY (hiring_company_id)
    REFERENCES companies (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_placement_company
  ON placement (hiring_company_id);
CREATE INDEX IF NOT EXISTS idx_placement_candidate
  ON placement (candidate_public_id);
CREATE INDEX IF NOT EXISTS idx_placement_status
  ON placement (status);

ALTER TABLE placement ENABLE ROW LEVEL SECURITY;

-- Hiring company sees their own placements
CREATE POLICY "placement_select_own" ON placement
  FOR SELECT USING (
    hiring_company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "placement_insert_own" ON placement
  FOR INSERT WITH CHECK (
    hiring_company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Referring company sees placements on their candidates
CREATE POLICY "placement_select_referrer" ON placement
  FOR SELECT USING (
    candidate_public_id IN (
      SELECT id FROM candidate_public
      WHERE uploaded_by_company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

-- updated_at trigger
CREATE TRIGGER trg_placement_updated_at
  BEFORE UPDATE ON placement
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
