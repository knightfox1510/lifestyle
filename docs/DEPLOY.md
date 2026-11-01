# Going live: Supabase + Vercel

> **No terminal?** Follow [`SETUP-IN-BROWSER.md`](SETUP-IN-BROWSER.md) instead. It does everything from a web browser (one-paste database setup, in-browser key generator).

This takes about 30–45 minutes the first time. You need accounts on **Supabase**, **Vercel**, **Google AI Studio** (Gemini key), and the GitHub repo `knightfox1510/lifestyle`. Free tiers are enough to start.

## 1. Supabase (database, login, file storage)

1. Create a project at [supabase.com](https://supabase.com). Pick the **Mumbai (ap-south-1)** region to sit next to the Vercel `bom1` region in `vercel.json`. Save the database password.
2. **Apply the migrations** (all files in `supabase/migrations/`, in order). Choose one way:
   - **CLI (recommended).** Run these from the repo root:
     ```bash
     npx supabase login
     ```
     ```bash
     npx supabase init
     ```
     (Only if `supabase/config.toml` doesn't exist; it won't touch `migrations/`.)
     ```bash
     npx supabase link --project-ref YOUR_PROJECT_REF
     ```
     ```bash
     npx supabase db push
     ```
   - **SQL editor:** paste `supabase/setup/all-in-one.sql` (all migrations combined) into a new query and run it once. After adding a migration, regenerate it with `node scripts/build-setup-sql.mjs`.

   The migrations create every table and the row-level security policies, the private `medical-documents` storage bucket, and the realtime feed for the shared grocery list.
3. **Keys:** Project Settings → API. Copy the **Project URL**, the **anon / publishable** key and the **service_role / secret** key.
4. **Auth URLs:** Authentication → URL Configuration.
   - **Site URL:** `https://YOUR-APP.vercel.app` (or your custom domain).
   - **Redirect URLs:** add `https://YOUR-APP.vercel.app/auth/callback`. Also add `http://localhost:3000/auth/callback` for local development, and `https://*-YOUR-TEAM.vercel.app/auth/callback` if you want preview deployments to work.
5. **Email sign-in** works out of the box using Supabase's built-in mailer, which is rate-limited. For more than a few users, set up custom SMTP under Authentication → Emails (Resend, Postmark, Amazon SES…).
6. **Google sign-in (optional):**
   1. In Google Cloud Console → APIs & Services → Credentials, create an OAuth client ID of type **Web application**.
   2. Set its authorised redirect URI to `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
   3. In Supabase → Authentication → Providers → Google, paste the client ID and secret.

## 2. Secrets to generate

Generate each value on your machine (or open `https://YOUR-APP/setup-keys.html` after the first deploy, which generates them in the browser). These are for you to paste into Vercel; don't commit them.

```bash
openssl rand -base64 32
```
→ `APP_ENCRYPTION_KEY`

```bash
openssl rand -hex 32
```
→ `CRON_SECRET`

```bash
npx web-push generate-vapid-keys
```
→ `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`

Get the Gemini key at [aistudio.google.com](https://aistudio.google.com) → **Get API key** → `GEMINI_API_KEY`.

## 3. Vercel (hosting)

1. [vercel.com](https://vercel.com) → **Add New… → Project** → import `knightfox1510/lifestyle`. The framework preset is detected as **Next.js**; keep the default build settings.
2. Choose the branch you deploy from: either merge `claude/blissful-hawking-v4uppl` into `main`, or set the Production Branch to it under Settings → Git.
3. **Environment variables** (Settings → Environment Variables), for **Production** and **Preview**:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key (**server only**) |
   | `GEMINI_API_KEY` | from AI Studio |
   | `GEMINI_MODEL` | optional, defaults to `gemini-flash-latest` |
   | `FDC_API_KEY` | optional, free USDA FoodData Central key (fdc.nal.usda.gov/api-key-signup) for ingredient search |
   | `APP_ENCRYPTION_KEY` | generated above |
   | `CRON_SECRET` | generated above |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | generated above |
   | `VAPID_PRIVATE_KEY` | generated above |
   | `VAPID_SUBJECT` | `mailto:you@yourdomain.com` |
   | `NEXT_PUBLIC_SITE_URL` | `https://YOUR-APP.vercel.app` (no trailing slash) |

   `NEXT_PUBLIC_*` values are baked in at build time, so **redeploy** after changing them.
4. **Deploy.** Open the URL, sign in, create your household, then invite your partner from Settings → Household.
5. **Custom domain (optional):** Settings → Domains. Then update `NEXT_PUBLIC_SITE_URL`, the Supabase Site URL / Redirect URLs and the cron URL in step 4 to the new domain, and redeploy.

## 4. Reminders (scheduled job)

Reminders need something to call `/api/cron/tick` every few minutes. The endpoint is idempotent, so extra calls never send a notification twice.

- **Recommended (free): Supabase pg_cron.** Open `supabase/setup/schedule-reminders.sql`, replace the app URL and `CRON_SECRET` placeholders, and run it once in the SQL editor. It calls the app every 5 minutes.
- **Also included: Vercel Cron.** `vercel.json` has a daily run at 03:30 UTC (09:00 IST). On the Hobby plan Vercel only allows daily crons, so this is just a backstop for daily items. On **Vercel Pro** you could change the schedule to `*/5 * * * *` and skip pg_cron.

Check it works by calling the endpoint once by hand:

```bash
curl -i -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-APP.vercel.app/api/cron/tick
```

The response is JSON like `{"ok":true,"users":1,"sent":0,"digests":0,"errors":0}`. A `401` means the secret doesn't match.

## 5. Phones & notifications

- **Android (Chrome):** open the site and use the in-app **Install** prompt (or Chrome menu → Install app).
- **iPhone (Safari):** Share → **Add to Home Screen**, then open Hearth *from the Home Screen icon*. iOS only allows web push for installed apps (iOS 16.4+).
- On each device: **Settings → Notifications → Turn on notifications**, then **Send a test**.

## 6. Wearable sync (optional)

In the app: **Wearables → Automatic sync → Create sync token**. Your automation (Tasker / a Health Connect exporter on Android, or an Apple Shortcuts automation on iPhone) then POSTs daily totals:

```bash
curl -X POST https://YOUR-APP.vercel.app/api/ingest/wearable -H "Authorization: Bearer hth_…" -H "Content-Type: application/json" -d '{"days":[{"date":"2026-11-01","steps":8123,"sleep_minutes":412,"resting_hr":61}]}'
```

Or skip automation and import the Zepp CSV export from time to time.

## 7. After going live

- **Gemini usage:** each household has a daily AI request cap (Settings → Household, default 50). You can also paste a household-specific Gemini key there; it's stored encrypted.
- **Backups:** Supabase Pro has daily backups and point-in-time recovery. On the free plan, export regularly with `npx supabase db dump`.
- **Security checklist:**
  - The service_role key exists only in Vercel env vars.
  - RLS is on for every table; check with `npm run test:db` locally.
  - The `medical-documents` bucket is private.
- **Updates:** push to the production branch and Vercel redeploys. For database changes, add a new file in `supabase/migrations/` and run `npx supabase db push`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sign-in link opens but you land back on `/login` | Redirect URL missing in Supabase Auth settings, or `NEXT_PUBLIC_SITE_URL` is wrong. |
| "AI isn't set up yet" | `GEMINI_API_KEY` missing; redeploy after adding it. |
| "Couldn't store the key" when saving a household Gemini key | `APP_ENCRYPTION_KEY` missing or not 32 bytes, or `SUPABASE_SERVICE_ROLE_KEY` missing. |
| "Turn on notifications" does nothing on iPhone | Open the installed Home Screen app, not Safari. |
| Test notification works but no reminders arrive | Scheduled job not set up (step 4). Check `cron.job_run_details` and `net._http_response` in Supabase. |
| Grocery list doesn't update live for your partner | Database → Replication: make sure `grocery_items` is in the `supabase_realtime` publication (the migration adds it). |
