# Hearth: household lifestyle PWA

An installable web app (phone and laptop) for tracking household and partner life: health, food, routines and more. Personal data is private by default, and each person chooses which features their partner can see or edit. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full plan.

**Status: Phase 0 (foundation) + medical records.**

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
  - **Hospital papers:** upload a PDF or photo (camera on phones) to a private bucket. **"Read with AI"** summarises it and proposes timeline entries; you tick which ones to add.
- **AI (Gemini):** the key stays on the server. A household can optionally bring its own key, which is stored AES-256-GCM encrypted. There's a per-household daily request cap and usage logging. **Every AI request gets the person's medical history** (allergies first, then conditions, current medicines, timeline and document summaries), with three levels of override:
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

Deploy on Vercel with the same environment variables.

## Checks

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm run build
```

`npm run test:db` applies the migrations to a throwaway local PostgreSQL 15+ instance and runs the RLS tests, covering owner, partner and stranger access, read versus write grants, and revocation on leaving.

```bash
npm run test:db
```
