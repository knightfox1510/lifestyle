# End-to-end tests

They drive the real app in a phone-sized browser: sign in, log water, add and
delete a food, add a medicine and take a dose, close the day (and reopen it),
and log while offline.

Use a **test account and a test household**, never a real person's: the tests
add and remove entries.

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
