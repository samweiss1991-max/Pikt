-- ============================================================
-- Notifications — Migration 007
-- In-app + email notification system.
-- ============================================================

-- 1. Notification type enum
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'candidate_unlocked',
    'candidate_stage_changed',
    'hire_confirmation_due',
    'placement_confirmed',
    'fee_disputed',
    'dispute_resolved',
    'ats_referral_prompt',
    'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Notifications table
CREATE TABLE IF NOT EXISTS notification (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_company_id  uuid NOT NULL,
  recipient_user_id     uuid,
  type                  notification_type NOT NULL,
  title                 varchar(80) NOT NULL,
  body                  varchar(200),
  action_url            text,
  metadata              jsonb DEFAULT '{}',
  read_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_notification_company
    FOREIGN KEY (recipient_company_id)
    REFERENCES companies (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_recipient
  ON notification (recipient_company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_user
  ON notification (recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_unread
  ON notification (recipient_company_id)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_type
  ON notification (type);

-- 3. User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preference (
  user_id                       uuid PRIMARY KEY,
  email_candidate_unlocked      boolean NOT NULL DEFAULT true,
  email_stage_changed           boolean NOT NULL DEFAULT true,
  email_hire_confirmation_due   boolean NOT NULL DEFAULT true,
  email_ats_referral_prompt     boolean NOT NULL DEFAULT true,
  email_candidate_viewed        boolean NOT NULL DEFAULT false,
  inapp_all                     boolean NOT NULL DEFAULT true,

  CONSTRAINT fk_pref_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE
);

-- 4. RLS
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preference ENABLE ROW LEVEL SECURITY;

-- Users see their own company's notifications
CREATE POLICY "notification_select_own" ON notification
  FOR SELECT USING (
    recipient_company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can mark their own as read
CREATE POLICY "notification_update_own" ON notification
  FOR UPDATE USING (
    recipient_company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Service role inserts
CREATE POLICY "notification_insert_service" ON notification
  FOR INSERT WITH CHECK (true);

-- Users manage their own preferences
CREATE POLICY "pref_select_own" ON user_notification_preference
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "pref_upsert_own" ON user_notification_preference
  FOR ALL USING (user_id = auth.uid());
