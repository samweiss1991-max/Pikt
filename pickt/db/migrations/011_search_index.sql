-- ============================================================
-- Full-text search — Migration 011
-- search_vector and GIN index already exist from migration 001.
-- This migration ensures the index covers all needed columns
-- and adds composite indexes for filter queries.
-- ============================================================

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_candidate_public_seniority_status
  ON candidate_public (seniority_level, status);

CREATE INDEX IF NOT EXISTS idx_candidate_public_location
  ON candidate_public (location_city);

CREATE INDEX IF NOT EXISTS idx_candidate_public_fee
  ON candidate_public (fee_percentage);

CREATE INDEX IF NOT EXISTS idx_candidate_public_interview_count
  ON candidate_public (interview_count DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_public_referred_status
  ON candidate_public (referred_at DESC, status);

-- Skills GIN index for array containment queries
CREATE INDEX IF NOT EXISTS idx_candidate_public_skills
  ON candidate_public USING GIN (skills);
