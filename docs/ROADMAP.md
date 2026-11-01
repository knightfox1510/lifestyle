# Household Lifestyle PWA: Review, Extra Ideas and Roadmap

## Context
You want a mobile and laptop PWA that a couple, and later other households, can use to track health, food, groceries, family logistics and leisure. It would have Gemini-powered suggestions, partner sharing with per-module visibility, modules that can be turned on or off, and home-screen widgets. Decisions so far: Next.js + Supabase; the Gemini key stays on the server, with an optional bring-your-own key per household; the MVP is health-first.


---

## 1. Review of your ideas (what to change or watch for)

| Idea | Verdict / adjustment |
|---|---|
| **Gemini key in the app** | Never put it in client code, because anyone can extract it. Call Gemini from a Next.js route handler. Add per-household daily token or call caps, plus a household setting for BYO keys stored encrypted (Supabase Vault / pgsodium). Use Gemini **structured output (JSON schema)** for every parse (receipts, fridge photos, meal plans) so results go straight into tables. |
| **Incontinence tracking** | Make it a proper **bladder diary**, the format urologists and pelvic-floor physios already use. Each event: time, type (leak / void / urge only), amount (drops/small/medium/large), urgency 1–5, activity at the time (cough, sneeze, lifting, yoga pose, running, laughing), pad change Y/N. Fluids (water, tea, coffee, alcohol, in ml) are logged in the same module. Add a **"Doctor report" PDF export** (3-day and 30-day views). Make this module **private by default**. |
| **Trigger correlation** | Start with simple, honest stats: leaks per day (7-day rolling), leaks on gym or yoga days vs. rest days, and leaks within 2 hours of caffeine. Show them as charts. Gemini can summarise patterns, but the numbers should come from SQL, not the model. |
| **Supplement stack vs. medicines** | Agreed that these should be separate. Add **stock count + refill alert** to both modules, and adherence % over time. Supplements are a daily checklist that resets at local midnight, stored as dated rows rather than a "reset" flag so history is kept. |
| **Wearable (Amazfit Helio Strap)** | The biggest risk. Zepp has no open public API for third parties, Google Fit APIs are being shut down, and a web PWA **cannot read Health Connect or Apple Health directly**. Realistic paths: (a) Zepp → Health Connect → a small open-source Android exporter or automation app (e.g. Tasker / an "HC webhook" app) that POSTs to a `/api/ingest/wearable` webhook with a per-user token; (b) manual CSV import from a Zepp export. Plan for (a) in a later phase and don't block anything else on it. |
| **Pantry OCR + expiry** | Good fit for Gemini vision. Three capture modes: **receipt**, **fridge/shelf photo**, **single barcode/label**. The AI proposes items + estimated expiry, and the user confirms on a review sheet before saving, because Gemini will sometimes guess wrong. |
| **Supabase RLS** | Correct choice. Use one generic sharing model rather than ad-hoc policies per table (see §3). |
| **Upstash QStash for notifications** | Works, but **Supabase `pg_cron` + an Edge Function** sending Web Push (VAPID) covers this with one fewer vendor. Keep QStash as an option if you need retries or fan-out at scale. Note that **iOS only delivers web push to PWAs installed on the Home Screen** (iOS 16.4+), so onboarding must prompt "Add to Home Screen" on iPhone. |
| **Offline-first** | Do it per module, not everywhere. Grocery list, supplements checklist, bladder diary quick-log and packing lists must work offline. Use IndexedDB (Dexie) + an outbox queue that syncs on reconnect, with last-write-wins per row (`updated_at`). AI features stay online-only. |
| **Child routine tracker** | Add the **vaccination schedule** (IAP schedule for India) with due-date reminders, a growth chart (weight/height percentiles) and a dose calculator guard: show the last dose time to prevent double-dosing between partners. |
| **Document expiry / subscriptions** | Good. Store document *metadata + expiry*, not scans of passports by default. If scans are added, use a private Storage bucket and signed URLs. Subscriptions: add renewal date + cost and a "who pays" field, with ChillarFlow kept for real accounting. |
| **Watchlist / dining vault / travel / packing** | All good, and they can share a generic "list with items" engine (see §3). The dining vault + calorie goal → "what to order tonight" is a strong AI feature. |
| **Module toggles + widgets** | Store a module registry in code and `household_modules` (enabled) + `user_widgets` (layout, order, size) in the DB. Each module exports a `QuickLogWidget` component. |

## 2. Additional ideas worth considering

**Health**
- **Pelvic floor (Kegel) trainer** with a guided hold/relax timer, streaks and reminders. It is directly tied to improving incontinence, and its progress can be charted against leak frequency.
- **Cycle tracking (optional, private)**, since leak frequency often varies with the menstrual cycle. Useful as a correlation variable.
- **Daily check-in widget**: sleep quality, energy, mood, stress (1–5). It takes about 10 seconds and is a valuable correlation input for everything else.
- **Doctor visits log**: appointments, a "questions to ask" list built up over time, visit notes, prescriptions linked to the medicines module.
- **Emergency card**: blood group, allergies, current meds and emergency contacts, available offline and shareable via link/QR.

**Food & home**
- **Recipe vault + weekly meal planner → auto-generated grocery list** (ingredients minus what's already in the pantry).
- **"Use it before it expires" suggestions**: Gemini proposes meals from items expiring in the next 3 days.
- **Water intake quick-tap widget** (+250 ml), which also feeds the bladder diary.
- **Chores rotation** with fair-share tracking between partners.

**AI & UX**
- **Natural-language / voice quick log**: "2 coffees, small leak during squats at 7:40". The Web Speech API turns it into text, Gemini parses it into structured entries, and you confirm.
- **Weekly AI digest** (Sunday push): adherence, leak trend, weight trend, upcoming expiries and renewals.
- **Unified "Today" timeline** on home: meds due, classes, child naps, expiring items, renewals.

**Family & life**
- **Occasions & gift ideas**: birthdays, anniversaries, a running gift-idea list per person.
- **Pet care** module (vaccines, vet, food) using the same engine as the child tracker if needed.

**Platform / trust (important if others will use it)**
- **Per-module, per-partner visibility** with an audit trail ("Partner viewed bladder diary").
- **Data export (JSON/CSV/PDF) + account deletion**, needed for India's DPDP Act and generally good practice for health data.
- **App lock** (passkey / device biometric via WebAuthn) for sensitive modules on a shared device.
- **AI cost guardrails**: per-household monthly cap, and responses cached for repeated identical prompts.

## 3. Architecture

- **Frontend**: Next.js (App Router, TypeScript), Tailwind + shadcn/ui, Serwist (service worker), Dexie (offline store + outbox), Recharts for trends, installable manifest, responsive layout (bottom tabs on mobile, sidebar on desktop).
- **Backend**: Supabase Auth (email magic link + Google), Postgres + RLS, Storage (private buckets), Vault for BYO Gemini keys, `pg_cron` + Edge Function for push. Hosted on Vercel.
- **AI**: `@google/genai` called only from `app/api/ai/*` route handlers. Each feature has a typed JSON schema, usage is logged to an `ai_usage` table, and caps are enforced before the call.

**Core data model (generic, reused by every module)**
- `profiles`, `households`, `household_members (role: owner/member/dependent)`, `invites`
- `dependents` (child, pet): not a login user, but owned by the household
- `household_modules (household_id, module_key, enabled, settings jsonb)`
- `user_widgets (user_id, module_key, position, size, config)`
- `module_shares (owner_id, grantee_id, module_key, level: none/read/write)`: the single source of truth for partner visibility
- Every module table has `owner_id`, `household_id`, `scope ('personal'|'household')`, `created_at`, `updated_at`, `deleted_at`

**RLS pattern** (a single SQL helper, `can_read(owner_id, household_id, scope, module_key)`):
- `scope='household'` → any household member can read and write (groceries, maintenance, watchlist, child).
- `scope='personal'` → the owner, plus anyone with a `module_shares` read/write grant for that module.
- Sensitive modules (bladder diary, cycle, medicines) default to *no share*.

**Personal vs. Partner view**: a top-level switch filters every screen by `owner_id = me` or `owner_id = partner`, where partner data is only what RLS allows. Household-scoped items appear in both.

**Module engine**: most features fit three shapes, so build three reusable engines:
1. **Event log** (bladder diary, fluids, food diary, child feeds/naps, check-ins, workouts)
2. **Checklist/list** (grocery, supplements, habits, packing, watchlist, dining vault, itineraries)
3. **Dated asset with expiry/recurrence** (medicines stock, documents, maintenance, subscriptions, pantry, vaccinations)

Each module is then mostly config + a form + a widget. This keeps 20+ modules manageable.

## 4. Phased roadmap

- **Phase 0 – Foundation**: auth, households, partner invite, module registry + toggles, `module_shares` + RLS helper, Personal/Partner switch, PWA shell (manifest, service worker, install prompt), customizable home widgets, settings (timezone, units, Gemini BYO key).
- **Phase 1 – Health-first MVP**: medicines (schedule, stock, adherence), supplement stack (daily checklist), bladder diary + fluids + activity tags + trend charts + doctor PDF export, Kegel trainer, daily check-in, habit tracker, offline grocery list (household scope).
- **Phase 2 – Food + AI**: food diary + calorie/macro goals, body recomposition dashboard (weight, milestones such as 60 kg, trend vs. intake), Gemini meal suggestions (goal, cooking style, pantry), camera → grocery/pantry (receipt, shelf, label) with a confirm sheet, pantry expiry, recipe vault + meal planner → grocery list, voice/NL quick log.
- **Phase 3 – Reminders & logistics**: Web Push + `pg_cron` (meds, classes such as 7:30 gym, expiries, renewals 60 days ahead), fitness classes schedule, child routine + vaccinations + growth, household maintenance matrix, document vault, subscriptions roster, weekly AI digest.
- **Phase 4 – Leisure & integrations**: couples' watchlist, dining vault + "what to order" AI, travel itineraries, packing templates, occasions & gifts, wearable webhook ingest + Zepp CSV import, data export/deletion, WebAuthn app lock, multi-household onboarding polish.

## 5. Critical files (when the build starts)
- `docs/ROADMAP.md`: this document
- Later: `supabase/migrations/*` (core schema + RLS helper), `src/modules/registry.ts` (module definitions), `src/lib/ai/*` (Gemini client + schemas), `src/lib/offline/*` (Dexie + outbox), `app/api/ai/*`, `app/api/ingest/wearable/route.ts`

## 6. Verification
- Each phase gets its own plan, with tests: RLS policy tests via `supabase test db`, and Playwright for the offline grocery list and install flow.
