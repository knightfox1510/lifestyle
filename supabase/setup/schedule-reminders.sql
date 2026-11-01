-- Run ONCE in the Supabase SQL editor after the app is deployed.
-- Calls the app's reminder endpoint every 5 minutes (medicine doses, class
-- reminders, expiries, renewals, weekly digest). Not a migration because it
-- contains your deployment URL and secret.
--
-- 1. Replace the two placeholder values below.
-- 2. Run the whole script.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the URL and secret in Supabase Vault (encrypted), not in the job text.
select vault.create_secret('https://YOUR-APP.vercel.app', 'hearth_app_url');
select vault.create_secret('PASTE-THE-SAME-CRON_SECRET-AS-IN-VERCEL', 'hearth_cron_secret');

select cron.schedule(
  'hearth-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'hearth_app_url') || '/api/cron/tick',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'hearth_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Check it's running (after ~5 minutes):
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select status_code, content from net._http_response order by created desc limit 5;
-- To change the URL/secret later:
--   select vault.update_secret((select id from vault.secrets where name = 'hearth_app_url'), 'https://new-url');
-- To stop:
--   select cron.unschedule('hearth-reminders');
