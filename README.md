# Hearth: household lifestyle PWA

An installable web app (phone and laptop) for tracking household and partner life: health, food, routines and more. Personal data is private by default, and each person chooses which features their partner can see or edit. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full plan.

**Status: all roadmap phases (0–4) built.** To go live: **[`docs/SETUP-IN-BROWSER.md`](docs/SETUP-IN-BROWSER.md)** (browser only, no terminal) or [`docs/DEPLOY.md`](docs/DEPLOY.md) (with the CLI).

## What's included

- **Sign in** with an email magic link or Google (Supabase Auth).
- **Households and partners:** create a household, invite your partner with a one-time code or link (valid 7 days), and remove or leave members.
- **Features on/off** per household (Settings → Household). Planned features are listed with their phase.
- **Sharing:** for each personal feature, choose Private, Can view or Can edit per partner, enforced by Postgres row-level security. An audit log shows when your partner viewed your shared data.
- **Personal / Partner switch** in the header. Every screen shows either your data or what your partner shared with you.
- **Home widgets:** add, remove, reorder and resize them (`/customize`).
- **Medical records**
  - **Health profile:** DOB, sex, blood group, height, and free-text notes for the AI.
  - **Timeline** of conditions, illnesses, symptoms, injuries, surgeries, procedures, hospital stays, medications (dose, frequency, "taken for"), allergies, vaccinations, tests and visits. Includes summary cards for allergies, ongoing conditions and current medicines.
  - **Papers & reports:** upload blood work, check-ups, discharge summaries, prescriptions, scans, ECGs and more (PDF or photo, camera on phones) to a private bucket. **"Read with AI"** summarises the document, proposes timeline entries and pulls out every lab value; you tick which ones to keep.
  - **Blood work & labs:** structured results (value, unit, reference range, low/high flag) from AI extraction or manual entry with a catalogue of common markers. Shows out-of-range markers first, latest vs previous per panel, and a trend chart per marker with the reference band.
- **Medicines:** prescriptions and courses with daily schedules (times + weekdays, start/end), Take / Skip per dose, as-needed doses, stock that counts down automatically with refill warnings, 7/30-day adherence and a 14-day grid. A new medicine can also be added to the medical timeline.
- **Supplement stack:** a daily checklist grouped by time of day that starts fresh each morning (history is kept), optional stock, and a 30-day adherence view.
- **Bladder diary:** one-tap logging of leaks (amount, urgency, what you were doing, pad change), urges, bathroom visits and drinks (type, ml, caffeine), with a day-by-day view.
  - **Trends & triggers:** leaks per day with a 7-day average, circumstances, time of day, and how much of it looks stress-type vs urge-type. Also simple comparisons (caffeine, Kegel days, fluids, alcohol, sleep), leaks within 2 h of caffeine, and whether it's improving.
  - **Doctor report:** a printable / Save-as-PDF report for 3, 7 or 30 days in the standard bladder-diary layout, with current medicines.
- **Pelvic floor trainer:** guided squeeze/relax timer (sets, reps, hold, rest, quick flicks) with vibration and sound cues and the screen kept awake. Shows sessions, streaks and a 4-week calendar.
- **Daily check-in:** sleep, mood, energy and stress (1–5, one tap each), plus hours slept and notes.
- **Habits:** weekly targets, tap-to-tick for the last 7 days, streaks.
- **Grocery list (shared, offline-first):** changes save to the device first and sync when back online. Partners see updates live (Supabase Realtime). Items are grouped by aisle (category guessed from the name), with a "who added / picked up" note and a cart you can clear.
- **Food diary:** describe a meal, say it (voice) or snap a photo, and AI estimates calories and macros for you to check before saving. Manual entry, "have it again", and daily progress against calorie, macro, fibre and water goals.
  - **Goals:** goal, diet type, activity, cooking style, cuisines and dislikes. AI suggests targets from weight, height, age, labs and conditions, and explains why; a maintenance estimate is shown alongside.
  - **Meal ideas:** 3 suggestions for a meal from what's in the pantry, what's expiring, or anything. Each fits the remaining calories and the person's health data and marks which ingredients you already have. Save as recipe, add missing items to the grocery list, or log it as eaten.
- **Body recomposition:** weigh-ins, body fat and measurements. Shows progress to the target weight with milestones (e.g. every 1 kg to 60 kg), a weight trend line with the target, and weekly average calories next to weekly weight change. **Vitals:** blood pressure, resting heart rate and blood sugar, with charts.
- **Pantry:** fridge / freezer / cupboard with expiry dates, opened state, "used up" and "used up + rebuy". Items expiring soon link to "cook something with these".
- **Camera scan:** photograph a receipt or order screen, a fridge shelf, or a handwritten list or empty packet. AI lists the items with estimated (or printed) expiry; you confirm and send them to the pantry or the grocery list.
- **Recipes & meal plan:** household recipe vault (manual or saved from AI ideas) with servings scaling, pantry check, log-as-eaten and add-to-plan. A weekly planner sends the rest of the week's missing ingredients to the grocery list.
- **Quick log:** type or speak one sentence ("2 coffees, poha for breakfast, small leak during squats at 7:40, weighed 63.8"); AI splits it into food, drinks, bladder diary and weight entries for you to confirm.
- **Fitness:** weekly class schedule (gym, yoga… with days, time, place) with reminders before each class, Done/Skipped per session, ad-hoc workouts and weekly minutes. The bladder diary now compares leaks on workout, gym and yoga days against rest days.
- **Child routine** (opt-in): shared feed / sleep / nappy / medicine / temperature / milestone log. Warns with the last dose time and who gave it, to prevent double-dosing. IAP vaccination schedule from date of birth, and growth records.
- **Home maintenance:** recurring tasks (AC filters, RO service, pest control, car service, insurance…) with quick-add templates, due/overdue states, "Done" with cost, and history.
- **Document vault:** passports, visas, IDs, insurance and warranties with expiry dates and reminders from 60 days out. Only the last 4 characters of any number are stored. Each document is personal (shareable) or household-wide.
- **Subscriptions:** what the household pays for, who pays, monthly total and renewal reminders.
- **Notifications:** Web Push on Android, desktop and installed iOS apps, covering medicine doses, classes, expiring food, documents, subscriptions, maintenance and vaccinations. Per-type switches, a daily reminder hour and quiet hours. A scheduled job calls `/api/cron/tick`, and every notification is sent at most once.
- **Weekly summary:** a Sunday-evening AI recap (wins, things to watch, what's coming up), also available on demand.
- **Couples' watchlist:** shows and movies with each person's season/episode, a warning when someone is ahead on a show you watch together, ratings, and a backlog.
- **Takeout & dining vault:** favourite places with their **menus imported from Zomato/Swiggy screenshots, a paper-menu photo or pasted text**. AI reads dishes, prices, veg/non-veg and sections and estimates per-person calories and macros; you review before saving, and re-importing updates the menu. You can search each menu, **log any dish** to the food diary with a portion (whole, half, shared), and use **"Suggest from here"** for per-person picks from one restaurant. The food diary has a "From a restaurant menu" picker, and Quick log uses saved dishes' numbers. On Android, screenshots can be shared straight into Hearth from the share sheet. (Zomato has no public menu API; Swiggy's partner program is noted in the roadmap.)
- **Travel:** trips from idea to booked, a day-by-day itinerary with links, bookings and costs vs budget. Packing lists with built-in templates (international flight, weekend, drone & camera gear, beach) and your own saved ones. An AI planner suggests an itinerary, packing list and tips.
- **Occasions & gifts:** birthdays and anniversaries with ages and years, plus reminders. **Gift ideas are private to their author**, enforced in the database, so surprises stay surprises.
- **Wearables:** import Zepp/Amazfit CSV exports (activity, sleep, heart rate) or any CSV with a date column, or sync automatically. A per-user token webhook (`POST /api/ingest/wearable`) works with Health Connect / Apple Health automations. Shows steps, sleep and resting HR charts and feeds AI context.
- **Privacy & data:**
  - Device app lock with a passkey (fingerprint, face or device PIN) or a Hearth PIN, with an auto-lock timeout.
  - Full JSON export.
  - Account deletion that hands household ownership to your partner.
- **Households:** belong to several households and switch between them. Onboarding lets you pick which features to turn on, and Home shows a "Getting started" checklist.
- **AI (Gemini):** the key stays on the server. A household can optionally bring its own key, which is stored AES-256-GCM encrypted. There's a per-household daily request cap and usage logging. **Every AI request gets the person's health data**: medical history (allergies first, then conditions, current medicines, timeline and document summaries) plus lab results (out-of-range first, with previous values) and recent tracking (medicines and adherence, supplements, a 14-day bladder diary summary, pelvic floor sessions, check-ins, habits, 7-day food averages vs goals, weight trend and target, latest vitals). There are three levels of override:
  1. A default in Settings ("Use my medical history in AI suggestions").
  2. A per-question switch on the Ask AI screen, plus "What will AI see?", which shows the exact context that will be sent.
  3. "Hide from AI" on any single timeline entry, document or the health profile.
- **PWA:** manifest, icons, install prompt (with Add to Home Screen steps on iOS) and a service worker that keeps an offline copy of recently visited pages. Signing out clears that copy.

## Stack

Next.js 16 (App Router, server actions, `proxy.ts`), Tailwind CSS 4, Supabase (Auth, Postgres + RLS, Storage) and `@google/genai`.

```
supabase/migrations/   schema, RLS helpers, medical tables, storage bucket + policies
supabase/tests/        RLS test suite (runs on plain Postgres with auth/storage stubs)
src/proxy.ts           session refresh + auth gate
src/lib/session.ts     per-request context: household, members, partner, shares, view mode
src/lib/ai/            Gemini client, quota, context builder (medical history), JSON schemas
src/modules/           feature registry, widget registry, medical helpers
src/app/(app)/         signed-in screens (home, medical, assistant, settings, customize)
public/sw.js           service worker
```

### Adding a feature module

1. Add the module's tables in a new migration. Give each table `owner_id`, `household_id`, and `scope` if it's mixed, and write its policies with `public.has_module_access(owner_id, '<key>', 'read'|'write')`, or `public.can_access_row(...)` for household-shared rows.
2. Flip its entry in `src/modules/registry.ts` to `status: "available"` with an `href`.
3. Add its widgets to `src/modules/widgets.ts` and `src/components/widgets.tsx`.
4. Add its data to `buildAiContext` in `src/lib/ai/context.ts` so AI suggestions see it.

## Setup

1. Create a Supabase project. Apply the migrations with `supabase db push` (Supabase CLI), or paste the files from `supabase/migrations/` into the SQL editor in order.
2. In Supabase → Authentication → URL configuration, set the Site URL and add `<your-url>/auth/callback` as a redirect URL. Optionally enable the Google provider.
3. Copy `.env.example` to `.env.local` and fill it in. Generate `APP_ENCRYPTION_KEY` with `openssl rand -base64 32`.
4. Run:

```bash
npm install
```

```bash
npm run dev
```

Deploy on Vercel: see [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full checklist (Supabase setup, env vars, reminders job, phones).

## Checks

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm run build
```

`npm test` runs the unit tests (scheduling, adherence, diary analysis, dates, categories, pantry matching, lab flags, nutrition helpers). `npm run test:db` applies the migrations to a throwaway local PostgreSQL 15+ instance and runs the RLS tests, covering owner, partner and stranger access, read versus write grants, revocation on leaving, and stock updates when a dose is logged.

```bash
npm run test:db
```
