-- ============================================================
-- Candidate consent: the daily run — Migration 041 (Stage 5A)
-- Requires migration 040, and the candidate-consent function deployed.
--
-- Once a day this calls the candidate-consent function, which:
--   - sends one reminder to candidates who haven't answered after 14 days
--   - after 30 days with no answer, deletes their details and tells the referrer
--
-- BEFORE running this file:
--   1. Supabase dashboard → Database → Extensions: turn on "pg_cron" and "pg_net".
--   2. Choose a long random password for the daily run (e.g. from a password manager).
--      Set it on the function from YOUR terminal (never paste it into a chat):
--        read -s "S?Daily run secret: " && npx supabase secrets set CONSENT_CRON_SECRET="$S" --project-ref jfzrglmphvpfqsozguek; unset S
--   3. Store the same password in the database's vault by running this ONE line in the
--      SQL editor, typing the password in place of PASTE_HERE (it is not saved in any file):
--        SELECT vault.create_secret('PASTE_HERE', 'consent_cron_secret');
--
-- Then run this file. Safe to re-run. Runs every day at 9am Sydney time (22:00/23:00 UTC).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'Turn on the pg_cron and pg_net extensions first (Database → Extensions). Nothing was changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'consent_cron_secret') THEN
    RAISE EXCEPTION 'Store the daily run password in the vault first (step 3 above). Nothing was changed.';
  END IF;
END
$$;

-- Replace any earlier version of the job
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'candidate-consent-daily';

SELECT cron.schedule(
  'candidate-consent-daily',
  '0 22 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://jfzrglmphvpfqsozguek.supabase.co/functions/v1/candidate-consent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'consent_cron_secret')
    ),
    body := '{"action":"daily"}'::jsonb
  );
  $job$
);

SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'candidate-consent-daily';
