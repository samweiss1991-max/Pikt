-- ============================================================
-- Commission settings — Migration 030
--
-- The one place commission rates are stored. One row per referrer position;
-- the number of rows is the maximum number of referrers a candidate can have.
--
-- This file deliberately contains NO rates, because this code is on GitHub.
-- Rates are entered directly in the Supabase SQL editor after running this:
--
--   INSERT INTO commission_settings (referrer_position, referrer_rate, pickt_rate)
--   VALUES (<position>, <referrer %>, <Pickt %>);
--
-- To change a rate later (past hires keep the rates they were recorded with):
--
--   UPDATE commission_settings
--      SET referrer_rate = <referrer %>, pickt_rate = <Pickt %>, updated_at = now()
--    WHERE referrer_position = <position>;
--
-- Row security is on with no policies, and browsers have no access. Only server
-- functions can read this table.
--
-- Apply in the Supabase SQL editor. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS commission_settings (
  referrer_position  integer PRIMARY KEY CHECK (referrer_position >= 1),
  referrer_rate      numeric(5,2) NOT NULL CHECK (referrer_rate >= 0),
  pickt_rate         numeric(5,2) NOT NULL CHECK (pickt_rate >= 0),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE commission_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON commission_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON commission_settings TO service_role;
