-- ============================================================
-- PII Vault Architecture — Migration 001
-- Splits candidate data into public (marketplace-visible)
-- and encrypted PII (post-unlock only).
-- ============================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. Enum types
-- ============================================================

DO $$ BEGIN
  CREATE TYPE seniority_level AS ENUM (
    'Junior',
    'Mid-level',
    'Senior',
    'Staff/Lead',
    'Principal',
    'Director+',
    'Manager'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reason_not_hired AS ENUM (
    'Headcount freeze',
    'Offer declined',
    'Salary mismatch',
    'Role cancelled',
    'Better fit selected',
    'Timing — project delayed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE candidate_status AS ENUM (
    'listed',
    'unlocked',
    'placed',
    'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE availability_status AS ENUM (
    'available',
    'interviewing_elsewhere',
    'placed',
    'withdrawn',
    'unconfirmed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. CANDIDATE_PUBLIC — marketplace-visible data
-- ============================================================

CREATE TABLE IF NOT EXISTS candidate_public (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by_company_id          uuid NOT NULL,
  role_applied_for                varchar NOT NULL,
  seniority_level                 seniority_level NOT NULL,
  location_city                   varchar,
  current_company_name            varchar,
  skills                          text[],
  interview_stage_reached         varchar,
  interview_count                 integer NOT NULL DEFAULT 0,
  reason_not_hired                reason_not_hired,
  feedback_summary                text,
  strengths                       text,
  gaps                            text,
  status                          candidate_status NOT NULL DEFAULT 'listed',
  salary_band_low                 integer,
  salary_band_high                integer,
  years_experience                integer,
  work_history                    jsonb,
  top_skills                      jsonb,
  referred_at                     timestamptz NOT NULL DEFAULT now(),
  last_availability_confirmed_at  timestamptz,
  availability_status             availability_status NOT NULL DEFAULT 'available',
  search_vector                   tsvector GENERATED ALWAYS AS (
                                    setweight(to_tsvector('english', coalesce(role_applied_for, '')), 'A') ||
                                    setweight(to_tsvector('english', coalesce(location_city, '')), 'B') ||
                                    setweight(to_tsvector('english', coalesce(current_company_name, '')), 'B') ||
                                    setweight(to_tsvector('english', coalesce(feedback_summary, '')), 'C') ||
                                    setweight(to_tsvector('english', coalesce(strengths, '')), 'C') ||
                                    setweight(to_tsvector('english', coalesce(array_to_string(skills, ' '), '')), 'B')
                                  ) STORED,
  parse_confidence_score          integer,
  created_at                      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT salary_band_check CHECK (
    salary_band_low IS NULL OR salary_band_high IS NULL OR salary_band_low <= salary_band_high
  ),
  CONSTRAINT interview_count_check CHECK (interview_count >= 0),
  CONSTRAINT years_experience_check CHECK (years_experience IS NULL OR years_experience >= 0),
  CONSTRAINT parse_confidence_check CHECK (
    parse_confidence_score IS NULL OR (parse_confidence_score >= 0 AND parse_confidence_score <= 100)
  )
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_candidate_public_search
  ON candidate_public USING gin(search_vector);

-- FK + status indexes
CREATE INDEX IF NOT EXISTS idx_candidate_public_company
  ON candidate_public (uploaded_by_company_id);
CREATE INDEX IF NOT EXISTS idx_candidate_public_status
  ON candidate_public (status);
CREATE INDEX IF NOT EXISTS idx_candidate_public_availability
  ON candidate_public (availability_status);
CREATE INDEX IF NOT EXISTS idx_candidate_public_referred
  ON candidate_public (referred_at DESC);

-- ============================================================
-- 3. CANDIDATE_PII — encrypted personal data (post-unlock only)
-- ============================================================

CREATE TABLE IF NOT EXISTS candidate_pii (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_public_id     uuid NOT NULL UNIQUE,
  full_name               text NOT NULL,
  email                   text NOT NULL,
  phone                   text,
  linkedin_url            text,
  full_cv_text            text NOT NULL,
  cv_parsed_json          jsonb,
  encryption_key_version  integer NOT NULL DEFAULT 1,
  created_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_candidate_pii_public
    FOREIGN KEY (candidate_public_id)
    REFERENCES candidate_public (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_candidate_pii_public_id
  ON candidate_pii (candidate_public_id);

-- ============================================================
-- 4. CANDIDATE_UNLOCK — tracks which companies have paid access
-- ============================================================

CREATE TABLE IF NOT EXISTS candidate_unlock (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_public_id     uuid NOT NULL,
  company_id              uuid NOT NULL,
  user_id                 uuid NOT NULL,
  status                  varchar NOT NULL DEFAULT 'confirmed'
                          CHECK (status IN ('pending', 'confirmed', 'revoked')),
  session_token           uuid DEFAULT gen_random_uuid(),
  session_expires_at      timestamptz DEFAULT (now() + interval '24 hours'),
  unlocked_at             timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_unlock_candidate
    FOREIGN KEY (candidate_public_id)
    REFERENCES candidate_public (id)
    ON DELETE CASCADE,
  CONSTRAINT uq_unlock_candidate_company
    UNIQUE (candidate_public_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_unlock_company
  ON candidate_unlock (company_id);
CREATE INDEX IF NOT EXISTS idx_unlock_candidate
  ON candidate_unlock (candidate_public_id);

-- ============================================================
-- 5. Migrate existing data (if candidates table exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidates') THEN
    -- Migrate public fields
    INSERT INTO candidate_public (
      id,
      uploaded_by_company_id,
      role_applied_for,
      seniority_level,
      location_city,
      current_company_name,
      skills,
      interview_stage_reached,
      interview_count,
      feedback_summary,
      strengths,
      gaps,
      status,
      salary_band_low,
      salary_band_high,
      years_experience,
      referred_at,
      created_at
    )
    SELECT
      id,
      uploaded_by_company_id,
      coalesce(role_applied_for, 'Unknown'),
      'Mid-level'::seniority_level,
      location_city,
      current_employer,
      skills,
      interview_stage_reached,
      coalesce(interviews_completed, 0),
      feedback_summary,
      strengths,
      gaps,
      CASE status
        WHEN 'available' THEN 'listed'::candidate_status
        WHEN 'unlocked'  THEN 'unlocked'::candidate_status
        WHEN 'placed'    THEN 'placed'::candidate_status
        WHEN 'withdrawn' THEN 'withdrawn'::candidate_status
        ELSE 'listed'::candidate_status
      END,
      salary_expectation_min::integer,
      salary_expectation_max::integer,
      years_experience,
      coalesce(referred_at, now()),
      coalesce(created_at, now())
    FROM candidates
    ON CONFLICT (id) DO NOTHING;

    -- Migrate PII fields (stored as plaintext — encrypt in application layer)
    INSERT INTO candidate_pii (
      candidate_public_id,
      full_name,
      email,
      phone,
      linkedin_url,
      full_cv_text,
      encryption_key_version
    )
    SELECT
      id,
      coalesce(full_name, 'MIGRATION_PENDING'),
      coalesce(email, 'MIGRATION_PENDING'),
      mobile_number,
      linkedin_url,
      'MIGRATION_PENDING',
      0  -- version 0 = unencrypted, needs re-encryption
    FROM candidates
    WHERE full_name IS NOT NULL OR email IS NOT NULL
    ON CONFLICT (candidate_public_id) DO NOTHING;

    RAISE NOTICE 'Migration complete: existing candidates moved to PII vault.';
    RAISE NOTICE 'IMPORTANT: Run the encryption script to encrypt PII rows with key_version=0.';
  ELSE
    RAISE NOTICE 'No existing candidates table found. Clean install.';
  END IF;
END $$;

-- ============================================================
-- 6. Row Level Security
-- ============================================================

ALTER TABLE candidate_public ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_pii ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_unlock ENABLE ROW LEVEL SECURITY;

-- candidate_public: any authenticated user can read listed candidates
CREATE POLICY "public_select_listed" ON candidate_public
  FOR SELECT USING (status = 'listed' OR status = 'unlocked');

-- candidate_public: uploading company has full CRUD
CREATE POLICY "public_crud_own" ON candidate_public
  FOR ALL USING (
    uploaded_by_company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- candidate_pii: ONLY accessible via server-side API (service role)
-- No direct client access — all PII access goes through /api/candidates/:id/pii
CREATE POLICY "pii_deny_all" ON candidate_pii
  FOR SELECT USING (false);

-- candidate_unlock: companies see their own unlocks
CREATE POLICY "unlock_select_own" ON candidate_unlock
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "unlock_insert_own" ON candidate_unlock
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Uploading company sees unlocks on their candidates
CREATE POLICY "unlock_select_uploader" ON candidate_unlock
  FOR SELECT USING (
    candidate_public_id IN (
      SELECT id FROM candidate_public
      WHERE uploaded_by_company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );
