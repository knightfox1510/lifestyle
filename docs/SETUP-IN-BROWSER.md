# Going live using only a web browser

No terminal, no desktop apps. Everything below happens on websites, and a phone browser works (a tablet or laptop browser is easier for the copy/paste steps).

**Time:** about 45 minutes. **Cost:** free plans of Supabase, Vercel and Google AI Studio are enough.

You'll collect a handful of values along the way. Paste them into a private note as you go and delete the note at the end.

**What you'll need:** a GitHub account (you already have one), an email address, and a Google account for the AI key.

**The order:** Supabase (database) → Google AI key → Vercel (website) → generate the last keys → link Supabase back to the site → turn on reminders → sign in. Each part lists exactly what to tap.

| Your note should end up with | From |
|---|---|
| Supabase database password | B1 |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | B3 |
| `GEMINI_API_KEY` (and optionally `FDC_API_KEY`) | C |
| YOUR-URL (e.g. `hearth-home.vercel.app`) | D1 |
| `CRON_SECRET` | D2 |

---

## Part A · Check the code is on GitHub

Open **github.com/knightfox1510/lifestyle**. The app lives on the branch `claude/blissful-hawking-v4uppl`. It's currently the repo's only (and therefore default) branch, so Vercel will deploy it automatically and the file links below open it by default. **Nothing to do here.**

> If you later add a `main` branch, merge into it with **Pull requests → New pull request** (base `main`, compare `claude/blissful-hawking-v4uppl`) → **Create** → **Merge**, and make `main` the production branch in Vercel → Settings → Git.

---

## Part B · Database and login (Supabase)

### B1. Create the project
1. Go to **supabase.com** → **Start your project** → sign in with GitHub.
2. Tap **New project**:
   - **Name:** `hearth`
   - **Database password:** tap **Generate a password** and save it in your note.
   - **Region:** **South Asia (Mumbai)**
3. Tap **Create new project** and wait 1–2 minutes until the dashboard loads.

### B2. Create all the tables (one paste)
1. In a new tab, open the repo on GitHub → **supabase → setup → all-in-one.sql**.
2. Tap **Raw** (top right of the file). You'll see plain text.
   - On a laptop, the **copy** icon next to Raw copies the whole file.
   - On a phone, long-press the text → **Select All** → **Copy**.
3. Back in Supabase, open **SQL Editor** in the left menu (the `>_` icon) → **New query** → paste → **Run**.
4. You should see **"Success. No rows returned."** If Supabase warns about "destructive operations", tap **Run this query**. This is a new, empty project, so nothing is lost.
5. Check it worked:
   - **Table Editor** lists tables like `profiles`, `households`, `medicines`, `bladder_events`.
   - **Storage** has a bucket called `medical-documents`.

> Run this file **only once**. If it fails halfway (e.g. the paste was cut off), the simplest fix is to delete the project (Settings → General → Delete project) and start B1 again.

### B3. Copy the three keys
The quickest way: tap **Connect** at the top of the project. It shows the **Project URL** and the **publishable key**. For the secret key, open **Project Settings** (gear icon) → **API Keys**.

Use the new-style keys (`sb_publishable_…` and `sb_secret_…`). Supabase is retiring the old "anon" and "service_role" keys in late 2026. If the API Keys page only shows a **Legacy API keys** tab and a **Create new API keys** button, tap that button first.

| Note it as | Where it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL**, like `https://abcd1234.supabase.co` (Connect dialog, or Settings → Data API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **publishable** key (`sb_publishable_…`). Yes, it goes in the variable named "ANON". |
| `SUPABASE_SERVICE_ROLE_KEY` | a **secret** key (`sb_secret_…`) under **Secret keys**. Tap the eye icon to reveal it, then copy it. **Never share this one.** |

---

## Part C · AI key (Google AI Studio)

1. Go to **aistudio.google.com** → sign in with Google.
2. Tap **Get API key → Create API key** (choose or create any Google Cloud project when asked).
3. Copy it into your note as **`GEMINI_API_KEY`**.

### C2. Food database key (optional, 2 minutes, recommended)
1. Open **fdc.nal.usda.gov/api-key-signup**, enter your name and email, and submit.
2. The key arrives by email. Save it as **`FDC_API_KEY`**.

This makes ingredient search (USDA FoodData Central) reliable. Without it, a shared demo key is used, which runs out quickly. The built-in Indian staples work either way.

---

## Part D · Put the app online (Vercel)

### D1. First deploy
1. Go to **vercel.com** → **Sign up** → **Continue with GitHub** → choose the **Hobby** (free) plan.
2. Tap **Add New… → Project**. Find **lifestyle** and tap **Import**.
   - If it isn't listed, tap **Adjust GitHub App Permissions** and give Vercel access to the `lifestyle` repository.
3. Leave the framework (**Next.js**) and build settings as they are.
4. Open **Environment Variables** and add these four, one at a time (name, value, **Add**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `FDC_API_KEY` (if you got one in C2)
5. Tap **Deploy** and wait about 2 minutes for the confetti.
6. Tap **Continue to Dashboard**. Your app address is shown under **Domains**, e.g. `lifestyle-abc.vercel.app`. Save it in your note as **YOUR-URL**.
   - Want a nicer address? Go to Settings → Domains → **Edit** to change it to something like `hearth-home.vercel.app` (if it's free), then save the new one in your note.

### D2. Generate the remaining keys (in your browser)
1. Open **`https://YOUR-URL/setup-keys.html`**. This page creates the keys inside your browser; nothing is sent anywhere.
2. Keep the page open. For each of the 4 values, tap **Copy** and add it in **Vercel → your project → Settings → Environment Variables**:
   - `APP_ENCRYPTION_KEY`
   - `CRON_SECRET` (**also save this one in your note**, you'll need it in Part F)
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
3. Add two more variables:
   - `NEXT_PUBLIC_SITE_URL` = `https://YOUR-URL` (no slash at the end)
   - `VAPID_SUBJECT` = `mailto:your-email@example.com`

### D3. Redeploy so the new values take effect
**Deployments** tab → tap the newest deployment → **⋯ (three dots) → Redeploy → Redeploy**. Wait about 2 minutes.

> Only generate keys once. Reloading `setup-keys.html` makes new random values; that's fine before you've saved them, but don't replace them later.

---

## Part E · Let Supabase send people back to your app

In Supabase: **Authentication → URL Configuration**
1. **Site URL:** `https://YOUR-URL` → **Save**.
2. **Redirect URLs → Add URL:** `https://YOUR-URL/auth/callback` → **Save**.

Sign-in emails work straight away with Supabase's built-in email, which is limited to a few emails per hour. That's fine for the two of you.

---

## Part F · Turn on reminders (every 5 minutes)

1. On GitHub open **supabase → setup → schedule-reminders.sql** → **Raw** → copy everything.
2. Supabase → **SQL Editor → New query** → paste.
3. Change two values in the pasted text:
   - `https://YOUR-APP.vercel.app` → your real `https://YOUR-URL`
   - `PASTE-THE-SAME-CRON_SECRET-AS-IN-VERCEL` → your `CRON_SECRET`
4. Tap **Run**.
   - If it complains about `pg_cron` or `pg_net`, open **Database → Extensions**, switch on **pg_cron** and **pg_net**, and run it again.
   - If it says the secret already exists, you've run it before; it's already set up.
5. After 5–10 minutes, check it in a new query:
   ```sql
   select status_code, content from net._http_response order by created desc limit 3;
   ```
   You want `200` and `{"ok":true,…}`. A `401` means the CRON_SECRET in the script doesn't match the one in Vercel.

---

## Part G · Start using it

1. On your phone, open **`https://YOUR-URL`** → enter your email → open the sign-in link from your inbox **on the same phone**.
2. Enter your name, name the household and pick the features you want → **Create household**.
   - **हिन्दी / मराठी:** go to **Settings → You → App language** and choose Hindi or Marathi → **Save**. Menus, reminders and AI answers switch language. Each person picks their own.
3. Install it:
   - **iPhone:** in Safari tap **Share → Add to Home Screen**, then open Hearth **from the new icon**.
   - **Android:** Chrome menu **⋮ → Install app** (or tap the *Install* banner).
4. In the installed app go to **Settings → Notifications → Turn on notifications → Send a test**.
5. Invite your partner: **Settings → Household → + Invite partner → Share**. They open the link, sign in with their own email and join.
6. Each of you chooses what the other can see in **Settings → Sharing** (everything personal starts private).
7. Follow the **Getting started** card on Home.
8. Worth doing early:
   - **Medical records → Health profile** and add any **allergies** to the timeline. The medicine safety checks and the doctor visit summary use them.
   - **Medicines → Medicines**: add what you take, then open **Safety checks**.
   - **Settings → Notifications → 💧 Water reminders**, if you want them.

🎉 You're live.

---

## Optional extras

**Sign in with Google**
1. At **console.cloud.google.com**, go to APIs & Services → **OAuth consent screen**: External, add your app name and email, then save.
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**. Under **Authorised redirect URIs**, add `https://YOUR-SUPABASE-PROJECT.supabase.co/auth/v1/callback` (your Project URL + `/auth/v1/callback`). Create, then copy the Client ID and Secret.
3. In Supabase, go to **Authentication → Sign In / Providers → Google**, switch it on, paste the ID and secret, and save.

**Your own domain:** in Vercel go to Settings → Domains → Add, and follow the DNS instructions from your domain seller. Then update `NEXT_PUBLIC_SITE_URL` (Vercel), the Site URL and Redirect URL (Supabase, Part E) and the URL in the reminders job:
```sql
select vault.update_secret((select id from vault.secrets where name = 'hearth_app_url'), 'https://your-domain');
```
Then redeploy.

**More sign-in emails:** set up Custom SMTP under Supabase → Authentication → Emails. For example, a free Resend or Brevo account works.

---

## When the app gets updated later

- **Code changes** deploy automatically when they're pushed to the production branch on GitHub.
- **Database changes** come as a new file in `supabase/migrations/`. Open that one new file on GitHub → Raw → copy → Supabase SQL Editor → Run. **Don't** re-run `all-in-one.sql` on a live database; it's only for brand-new projects.
  - **Setting up for the first time? Skip this.** `all-in-one.sql` (Part B2) already includes every change so far.
  - For reference, the most recent ones are, in order: `20261106000001_menus.sql` (restaurant menus), `20261107000001_nutrition.sql` (ingredient nutrition, micronutrients, leftovers), `20261108000001_water.sql` (water reminders) `20261109000001_language.sql` (Hindi/Marathi) and `20261110000001_engagement.sql` (streaks, cheers, milestones, Home view). If you set up before any of these, paste each missing one once, in that order.

## If something goes wrong

| What you see | What to do |
|---|---|
| The sign-in link opens the app but you end up back at the login page | Part E: check both URLs exactly (https, no typo). Open the link on the same device and browser you requested it from. |
| "Email rate limit exceeded" | Wait an hour, or set up Custom SMTP (Optional extras). |
| "AI isn't set up yet" | `GEMINI_API_KEY` missing in Vercel. Add it, then redeploy (D3). |
| "Couldn't store the key" when saving a household Gemini key | `APP_ENCRYPTION_KEY` or `SUPABASE_SERVICE_ROLE_KEY` missing. Add it, then redeploy. |
| Notifications button does nothing on iPhone | Use the **installed** Home Screen app, not Safari. |
| "Push isn't configured on the server" | The VAPID values are missing. Re-check D2 and redeploy. |
| Test notification works but reminders never arrive | Part F not done, or the CRON_SECRET doesn't match (check the query in F5). |
| Vercel build failed | Deployments → open the failed one → **Build Logs**. A missing environment variable is the usual cause. |
| "Invalid API key" on the sign-in page | The Supabase keys in Vercel are wrong or swapped: the **publishable** key goes in `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the **secret** key in `SUPABASE_SERVICE_ROLE_KEY`. Fix and redeploy. |
| Saving the language setting says "Couldn't save." | The database is missing the language change. Paste `20261109000001_language.sql` (see above). |
| Anything else | Vercel → your project → **Logs** shows server errors as they happen. |
