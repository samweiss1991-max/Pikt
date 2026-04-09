-- ============================================================
-- Onboarding — Migration 019
-- Adds onboarding tracking fields to companies table.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE companies ADD COLUMN onboarding_completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'onboarding_step_reached'
  ) THEN
    ALTER TABLE companies ADD COLUMN onboarding_step_reached integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'onboarding_dismissed_at'
  ) THEN
    ALTER TABLE companies ADD COLUMN onboarding_dismissed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'seen_upload_example'
  ) THEN
    ALTER TABLE companies ADD COLUMN seen_upload_example boolean NOT NULL DEFAULT false;
  END IF;
END $$;
