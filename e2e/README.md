# End-to-end tests

They drive the real app in a phone-sized browser: sign in, log water, add and
delete a food, add a medicine and take a dose, close the day (and reopen it),
and log while offline.

Use a **test account and a test household**, never a real person's: the tests
add and remove entries. The account is created automatically on the first run
(confirmed, no email is sent) and makes its own household, so all you choose is
an email address nobody uses, e.g. a Gmail "plus" address of your own
(`you+hearth-e2e@gmail.com`): mail to it, if any, reaches your inbox.

```bash
E2E_BASE_URL=https://your-preview.vercel.app \
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
E2E_EMAIL=e2e@example.com \
npm run test:e2e
```

Without these variables the tests are skipped. In GitHub Actions, add them as
repository secrets (Settings → Secrets and variables → Actions); the workflow
runs them after the other checks.
