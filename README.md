# Consistency Tracker

A private, timezone-aware habit tracker for keeping a few goals visible: check in each day, reflect once a week, and optionally share a goal with an accountability partner.

**Live demo → https://consistency-tracker-demo.vercel.app/consistencytracker** (sign in with Google)

Built with Next.js 15 (App Router), Supabase (Postgres + Auth + Row-Level Security), and TypeScript.

## Features

- **Goals, your way** — track a habit on **specific days** (e.g. weekdays) or as a **weekly count** ("3× a week, any day"). Group goals by category with colors, an optional goal document link, and a "why this matters" note that gives later reflection some context.
- **Fast daily check-ins** — mark a goal *done* or *skipped* (with a reason: travel / illness / mood / other) and jot a short note. Cards take on a calm done/skipped tint so the day is scannable at a glance.
- **Extra check-ins, seen not scored** — did something on an unscheduled day? A quiet "Did anything else today?" chip row lets you add it as extra evidence. If you go beyond a weekly quota on eligible days, the surplus is also shown as extra. Extras appear in your history, partner view, and reflection narrative as evidence of showing up, but never inflate streaks, completion rates, or weekly-met scoring.
- **Calendar history** — goal pages show recent months as calendar grids and older months as a compact strip. The Goals page unlocks an aggregate calendar across all goals after 3+ active goals with some check-in history. The history is read-only; recent days are edited in the "This week" rows on a goal page (the current week plus a short grace period).
- **Streaks and progress, not grades** — day streaks for specific-day goals, **week streaks** and quota progress for weekly-count goals, plus longest streak, this week's progress, and your typical time of day ("you usually do this in the morning"). Completion percentages are reserved for finished weekly reflections and the summary email.
- **Weekly reflections** — a Keep / Let go / Try next journal with auto-computed weekly stats, highlights, and a plain-language recap of how the week actually went. Reflections can be marked private (default) or shared with partners; the visibility toggle names the exact audience before you save.
- **Weekly summary email** — every Monday you get a recap of the past week across all your goals, your own reflection included. Partners get a summary of just the shared goals; if you marked your reflection shared that week, it appears in their email under "In their own words."
- **Partner accountability** — invite a friend by email and share individual goals read-only. A shared goal exposes its name, description, goal document link, cadence, category, and check-in history; your "why this matters" note and check-in notes stay private. A quiet "shared with…" badge keeps it clear what's shared (everything is private by default), the partners list shows when each partner last showed up, and they get a weekly summary of just the shared goals, CC'd to you so you share the same view.
- **Gentle reactions** — on a shared goal a partner can leave a lightweight, per-week 👀 *Saw it* / 👏 *Proud* — a quiet "I noticed," never a nudge. You see a warm history of how often and how recently ("Wendy has been proud of this for 3 weeks").
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
The pure logic — timezone date math, streak/completion scoring, weekly-count cadence, extra check-in classification (scored vs. extra, off-target vs. over-quota), link safety, catch-up editable-window rules, email content and reflection rendering, and Resend error handling and retry backoff — is unit-tested with Vitest (349 tests):
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
