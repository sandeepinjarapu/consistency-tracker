# Consistency Tracker

A minimal, timezone-aware habit tracker built around a GitHub-style consistency heatmap — with flexible weekly-count goals, weekly reflections, and partner accountability.

**Live demo → https://consistency-tracker-gamma.vercel.app** (sign in with Google)

Built with Next.js 15 (App Router), Supabase (Postgres + Auth + Row-Level Security), and TypeScript.

## Features

- **Goals, your way** — track a habit on **specific days** (e.g. weekdays) or as a **weekly count** ("3× a week, any day"). Group goals by category with colors and an optional reflection-doc link.
- **Fast daily check-ins** — mark a goal *done* or *skipped* (with a reason: travel / illness / mood / other) and jot a short note.
- **Consistency heatmap** — a GitHub-style year view per goal plus an aggregate across all goals. Click a day to **backfill** a missed check-in (within the current week + a short grace period).
- **Honest streaks & stats** — day streaks for specific-day goals, **week streaks** for weekly-count goals, completion rate, longest streak, and your "typical" time of day.
- **Weekly reflections** — a Continue / Stop / Improve journal with auto-computed weekly stats and highlights.
- **Partner accountability** — invite a friend by email, share individual goals read-only, and get an automatic **weekly summary email** of their progress.
- **Timezone-aware** — "today", streaks, and weekly boundaries are all computed in each user's own timezone.
- **Calendar reminders** — one-click "Add to Google Calendar" for specific-day goals.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Server Components & Server Actions), React 19 |
| Language | TypeScript |
| Database / Auth | Supabase — Postgres, Auth (Google OAuth), Row-Level Security |
| Styling | Tailwind CSS |
| Email | Resend |
| Tests | Vitest |
| Hosting | Vercel (+ Vercel Cron) |

## Getting started

### Prerequisites
- Node.js 20+
- A free [Supabase](https://supabase.com) project
- *(Optional)* a [Resend](https://resend.com) account for partner-invite and summary emails

### 1. Install
```bash
git clone https://github.com/sandeepinjarapu/consistency-tracker.git
cd consistency-tracker
npm install
```

### 2. Configure environment
```bash
cp .env.local.example .env.local
```
Fill in the values (each is documented in that file):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser Supabase client — public, protected by RLS |
| `SUPABASE_SECRET_KEY` | Server-only admin key (never shipped to the browser) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email |
| `NEXT_PUBLIC_SITE_URL` | Origin used to build links in emails |
| `CRON_SECRET` | Bearer secret authorizing the weekly-summary cron |

### 3. Set up the database
In the Supabase SQL Editor, run `supabase/schema.sql`, then apply the files in `supabase/migrations/` in numeric order. Under **Authentication → Providers**, enable **Google**.

### 4. Run
```bash
npm run dev
```
Open http://localhost:3000.

## Scripts
- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — ESLint
- `npm run test` / `npm run test:run` — Vitest (watch / run once)

## Testing
The pure logic — timezone date math, streak/completion scoring, weekly-count cadence, link safety, and heatmap-backfill rules — is unit-tested with Vitest:
```bash
npm run test:run
```

## Architecture notes
- **Server-first** — pages are Server Components; mutations are Server Actions in `src/lib/actions/`.
- **Security** — Supabase Row-Level Security is the authorization backbone: every table has owner-scoped policies, and the service-role key is used only server-side, never in the browser. Baseline security headers are set in `next.config.mjs`.
- **Pure, testable core** — date and stats helpers in `src/lib/` are framework-free and unit-tested; ISO-week math drives the weekly-count scoring.
- **Schema as code** — the full schema lives in `supabase/schema.sql`, evolved by ordered files in `supabase/migrations/`.

## Deployment
Deployed on Vercel. Set the same environment variables in the Vercel project; the weekly partner-summary cron is configured in `vercel.json` (it calls `/api/cron/weekly-partner-summary`, authorized by `CRON_SECRET`).

## License
[MIT](./LICENSE) © 2026 Sandeep Injarapu
