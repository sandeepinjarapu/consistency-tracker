# Product roadmap notes

This is a decision backlog, not a committed build plan. Use it to keep product
ideas from turning into opportunistic PRs without first checking whether they
fit Consistency Tracker's philosophy: evidence over grades, calm over clever,
partners as a trust boundary, and a weekly rhythm as the core loop.

Each item is tagged: **Now**, **Next**, **Later**, or **Spec only**.

---

## Now: Small polish with high trust impact

Low-risk changes that improve clarity and craft without touching the data model
or scoring rules.

### 1. Reflection language: make the weekly prompt more human `Done — PR #130 · Deployed`

**Shipped:** Today card subcopy changed to `What helped, what got in the way,
what to try next.` Editor labels changed to `Keep`, `Let go`, `Try next`,
`Notes`. Partner reflection view and smoke checklist updated to match.

### 2. Reflection notes: attribution on second line `Done — PR #132 · Deployed`

**Shipped:** `ReflectionNotes` renders the quote on the first line and the
goal name / date on a smaller muted second line. The em-dash inline separator
pattern is gone.

**Still open (optional, defer until we see real usage):** mobile two-line clamp
per note item. The collapse toggle (`more` / `less` at item count 3) remains
unchanged.

### 3. Dropdown and overflow menu polish `Done — PR #134 · Deployed`

**Shipped:** Today Skip, goal-list overflow, goal-detail gear, and the delete
confirmation now share the calmer floating-layer vocabulary: `rounded-lg`
menus, 1px border, `shadow-sm`, `text-sm` menu labels, and a softened delete
dialog. Destructive behavior remains clear through the red action and
irreversible warning copy.

**Deferred decision:** Mobile Skip bottom sheet. The current four-reason menu is
fine for now, but a bottom sheet may fit the product better if Skip starts to
feel like a considered choice rather than a tiny dropdown action.

**Trigger to revisit:** real mobile use shows cramped tapping, accidental
selection, or skip reasons become longer / more nuanced.

### 11. Reflections page: visual structure and density `Done — PR #143 · Deployed`

**Shipped:** WeekGrid moved above stats in `WeekDetailBody`. Stats sentence
replaced with muted pill chips — each pill (`done`, `skipped`, `missed`,
`extra`, completion %) renders only when non-zero. `weekStart` prop threaded
through so WeekGrid tooltips include the date (`Tue, Jun 4 · Missed`).

**Still open (deferred):** Two-line note clamp on mobile. Observe real usage
before adding.

### 12. Time-of-day chart: tooltip clarity `Done — PR #130 · Deployed`

**Shipped:** Tooltip changed from `Afternoon · 3` to `3 check-ins in the
afternoon` (plain language, singular-aware). Late-night bucket copy fixed to
`N check-ins late into the night` in PR #140.

### 13. History and reflection tooltip polish `Done — PR #140 · Deployed`

**Shipped in #140:**
- `MonthCalGrid` and `YearStrip` converted from native `title` to the existing
  `useHoverTip`/`HoverTip` pattern. First hover is now near-instant (~120ms
  delay) instead of ~1s browser-controlled delay.
- Per-goal calendar cells produce semantic copy: `Jun 2 · Done`,
  `Jun 5 · Not done`, `Jun 3 · Skipped`, `Jun 6 · Extra check-in`,
  `May 15 · Before goal started`.
- `WeekGrid` (Reflections) now receives `weekStart` and produces date-aware
  tooltips: `Tue, Jun 4 · Missed` instead of `Tuesday · Missed`.
- `TimeHistogram` late-night copy: `N check-ins late into the night`.

---

## Next: Product payoff and scale improvements

More visible changes. Spec before implementation; they still fit the current
weekly model.

### 4. Goals list glanceable status `Done — PRs #135–#139, #142 · Deployed`

**Shipped across six PRs:**
- PR #135 (PR D): initial week rings on goal list rows.
- PR #136: 18px rings, hide `not-started` rings for new goals.
- PR #137: 28px rings, own row, Phi (Φ) vertical marker for extra check-in weeks.
- PR #138: rings moved to top-right of goal card, horizontal row, actions below.
- PR #139: tooltip shows raw check-in counts (`3 check-ins`, `1 extra check-in`)
  instead of a derived percentage. `only` removed from extra-only copy.
- PR #142: current in-progress week included as the rightmost ring (6 rings
  total: 5 completed past weeks + 1 current week).
- Extra check-in marker changed from Phi vertical bar to center dot.
- Mobile ring cap: 4 rings on mobile, 6 on desktop (CSS only).

**Semantics:** `met` = full arc, `partial` = partial arc, `extra` = full arc +
center dot, `skipped` = gray ring + horizontal bar, `empty` = gray outline,
`not-started` = hidden.

**Mobile ring cap shipped:** 4 rings on mobile (index ≥ 4 hidden below `sm:`),
6 on desktop. Pure CSS, no JS resize logic.

### 5. Aggregate calendar unlock for engaged single-goal users `Done — PR #131 · Deployed`

**Shipped:** The Goals-page calendar now unlocks for either `3+ active goals`
or a focused single-goal user with `8+ scored done check-ins` across `3+ ISO
weeks`. Copy adapts to `Recent activity` (one goal) or `Recent activity, all
goals` (multiple goals).

**Deferred: 2-goal engagement unlock.** One-line change in `calendar-unlock.ts`
(`activeGoalCount === 1` to `activeGoalCount <= 2`). Revisit when a real
2-goal user hits the wall.

### 6. Calendar month alignment and trimming `Not started`

**Problem:** `MonthCalGrid` trims rows entirely before goal start and entirely
after today. If a goal started in the last week of a past month, that month can
render as a one-row grid at the top, losing the visual truth that the row was
the final week of the month.

**Possible directions:**

- Keep current compact trim everywhere.
- Preserve calendar position in goal detail and partner pages; keep compact
  trim on the Goals overview.
- Preserve all calendar rows, using transparent cells for not-applicable time.

**Decision needed:** Is calendar-position truth more important than compactness
for recent history?

**Recommendation:** Revisit with real screenshots before changing. Visual
judgment, not a logic bug.

### 7. Partner reaction compression `Not started`

**Problem:** Goal detail renders every reaction summary line under the header.
A goal shared with many partners can grow to many lines, pushing check-ins and
history below the first viewport.

**Proposed direction:**

- Compact summary first: `Richa, Arjun, and 3 others noticed this` /
  `5 saw it · 2 proud` / `Latest this week`.
- Detailed partner-by-partner lines behind `View reactions`.
- Keep the emotional signal visible; move the ledger behind disclosure.

**Trigger to revisit:** Any goal shared with more than 3 partners, or reactions
pushing This Week/history below the first viewport.

### 13. Reflection visibility: replace pill toggle with inline glyph `Done — PR #144 · Deployed`

**Shipped:** Pill toggle replaced with a single tappable inline status suffix
on the Save row: `· Private` or `· Shared with partner`. Flips state on tap.
Conditional "no partner yet" explanation text retained as a muted sentence.
`aria-pressed` and `aria-label` added for accessibility.

**Follow-up shipped:** Visibility suffix now names the audience — `· Arjun` /
`· Arjun & Richa` / `· 3 partners` — and uses full foreground weight (not
muted) when shared. Toggling Private → Shared shows a 2s inline confirmation:
`Arjun will see this reflection · save to apply`. Toggling to Private stays
quiet (muted, no confirmation needed).

### 18. Reflection content in weekly email `Done · Deployed`

**Shipped:**
- **Partner email:** if the goal owner marked their reflection `shared` that
  week, the partner's weekly email includes an "In their own words" section
  with any filled fields (Keep / Let go / Try next / Notes). A private
  reflection never appears in the partner's email.
- **Self-summary email:** the owner's own reflection always appears in their
  weekly self-summary (no sharing restriction — it's their own words). Section
  heading: "Your reflection".
- XSS: all reflection text is HTML-escaped before rendering in the email body.
- Tests: `email.test.ts` covers both headings, all four fields, null/blank
  omission, empty reflection, and XSS escaping (16 tests).

**Surfaces affected:** `src/lib/email.ts` (`weeklyHtml`, `weeklyText`,
`sendWeeklySummary`), `src/app/api/cron/weekly-partner-summary/route.ts`.

### 16. Archive: archived goal row UI `Not started`

**Problem:** Archived goals (`active = false`) are invisible. There is no way
to review, recall, or unarchive a goal without knowing it exists somewhere. A
user who archives an old goal loses access to its history and context.

**Proposed design for archived goal rows:**

- Show archived goals in a collapsed `Archived` section below active goals, or
  on a separate `Archived` tab/route.
- Each row shows: goal name (muted), last active date (`Archived Jun 2`),
  cadence line, motivation snippet if present.
- No rings — archived goals have no current-week activity to pattern.
- Unarchive CTA inline: a quiet `Unarchive` text button or kebab action.
- No reaction dot, no share icon — archived goals are private at rest.

**Surfaces affected:** `src/app/consistencytracker/goals/(overview)/page.tsx`,
goal list query (currently filters `active = true` only).

**Decision needed:** Separate tab vs. collapsed section vs. same list with a
visual break. Separate tab is cleanest if archived goals accumulate; collapsed
section is simpler if most users have 0–2 archived goals.

**Recommendation:** Mock the shape before coding. Tab vs. section is a product
call, not a code call.

### 17. Archive: partner notification copy `Done — PR #141 · Deployed`

**Shipped:** Archive confirmation dialog in `goal-row-menu.tsx` shows
*"Partners will no longer see this goal."* when `isShared` is true. The
`isShared` prop is threaded from the goals list query.

---

## Later: Bigger product-model changes

These need a spec because they touch scoring, partner trust, weekly email, and
reflection semantics.

### 8. Planned break / vacation mode `Later`

**Problem:** Users will travel, fall sick, or have life events. The current
model offers skips and catch-up, but not a clean way to say "these promises do
not apply for this date range."

**Possible direction:**

- A planned break flow: choose date range, pause all goals or select goals.
  Paused days are neutral: not missed, not skipped, not extra.
- Partner view can say `Paused for travel` if the goal is shared.

**Surfaces affected:** Today, goal detail, Goals list, Reflections, Partner
view, weekly email, stats/scoring, schema.

**Decision needed:** Is pause a neutral system state or a user-authored note?
Can a paused day be overridden with a done check-in?

**Trigger to revisit:** First real vacation/travel pain, or before inviting
users whose routines frequently vary.

### 9. Longer cadences: every N weeks, monthly, quarterly `Later`

**Problem:** Some real commitments do not fit a weekly schedule.

**Why not now:** Risks turning the app into a generic goals/reminders tool. The
current product strength is its weekly rhythm and evidence loop.

**Trigger to revisit:** Multiple real users create awkward weekly workarounds
for non-weekly commitments.

### 21. Today over-quota classification: quota-met weekly goals `Done — PR #145 · Deployed`

**Bug (original-design gap from the e42abcf "N times per week" commit):** A
weekly-count goal ("N×/week, any day") stores all seven weekdays in
`target_days`, so the Today list demanded a check-in every day even after the
weekly promise was met. A goal could simultaneously read `✓ 5 of 5 this week`
and be counted as `1 left` — a direct trust break, not polish.

**Shipped:** `classifyTodayGoal` (`src/lib/today-required.ts`, unit-tested)
splits today's eligible goals into three buckets keyed on the quota, not the
weekday:
- **required** — specific-day goals on a target day; weekly goals still under
  quota (`scoredDoneBeforeToday < weeklyTarget`) OR already checked in today
  (so a card that *completed* the quota today stays visible as done, not
  vanishing on tap).
- **over_quota** — weekly goal met *before* today, today still open: offered as
  an optional chip in "Did anything else today?", never counted as "left".
- **not_today** — off the target weekday (unchanged).

Header denominator and the required-card list now use `requiredGoals`, not the
raw eligible set. Over-quota chips log through `markDone`/`unmark` (eligible
weekday), NOT `markExtraDone` — whose `isExtraLoggable` guard rejects eligible
days. Over-quota chips are scoped to the daytime list (night-owl extras belong
to yesterday, so the two reference days aren't mixed). 6 classifier tests.

**Header copy resolved:** the summary string was extracted to a pure,
unit-tested `todaySummary` (`src/lib/today-summary.ts`). When nothing is
required because today's goals are all met for the week, it reads
`You're all caught up for the week` (warm, names the win) rather than the flat
`Nothing scheduled today.`, which is now reserved for a genuinely empty day.
8 summary tests cover both. Daytime-only, so night-owl copy is unchanged.

**Deliberate scope — revisit with item 9:** this fix reasons only about
**weekly** quotas. When longer cadences (every-N-weeks / monthly / quarterly,
item 9) land, the "quota met for the period" logic and the
`scoredDoneBeforeToday` window will need to generalize beyond the ISO week.
Re-examine `classifyTodayGoal` and `scoredDoneBeforeToday` then rather than
extending them speculatively now.

### 22. `buildTodayModel`: one Today-page state model `Spec only`

**Context:** Item 21 fixed the daytime over-quota bug; a follow-up
(`fix/night-owl-quota-classification`) extended the SAME requiredness decision
to the night-owl "Still open from last night" list via a shared
`classifyGoalForLogicalDay` + `scoredDoneBefore` (`src/lib/today-required.ts`).
That closed the duplicated-quota-rule drift — daytime and night-owl now share
one classifier. But the Today route (`page.tsx`) still assembles the rest of
its product state across several local branches: `requiredGoals` /
`overQuotaGoals`, `lastNightGoals`, `offTodayGoals` / `overQuotaExtras`, and
`todaySummary` inputs.

**Idea:** a single pure `buildTodayModel({ goals, checkIns, today, hour,
timezone })` returning `{ requiredGoals, lastNightGoals, extraGoals,
summaryInput }`, so the page fetches data and renders, and the whole logical-day
state becomes unit-testable as one unit (rather than a classifier in isolation
plus page wiring). Deliberately deferred out of the night-owl fix to keep that
PR a focused correctness change, not a page rewrite.

**Scope guard:** state assembly only. Must NOT touch scoring (`computeStats`,
`classifyWeek`, `computeTimePattern`), Goal detail / `WeekRows`, history,
reflections, partner pages, weekly email, or server-action write semantics.

**Trigger to revisit:** the next change that has to touch Today-page state in
more than one of those branches at once, or another drift bug from the split.

### 19. Check-in feel / session quality (discovery only) `Spec only`

**Idea:** Distinguish "showed up but it was rough" from "showed up and it
was strong" — a signal richer than done/skipped/extra. Notes already cover
this, but they're free-text, optional, and the `+ Add note` affordance is
easy to miss.

**Philosophy fit:** In tension with Design Principle 1 (evidence, not
grades) if built as a numeric scale or anything evaluative like "Good /
Alright / Can do better" — that reads as a performance review, not a
personal record. Only acceptable as reflection texture: optional, three
qualitative non-ranked states (e.g. `strong` / `okay` / `rough`), never
averaged into a number, never affecting completion/streak scoring, never
shared with partners or in email in V1.

**Open questions before any code:**

1. Is the gap real, or is the existing note affordance just under-used
   because it's visually buried?
2. Capture grain — **not yet decided, and the schema differs by choice**:
   - **Weekly, per goal:** one `Strong · Okay · Rough` prompt per goal per
     week inside Reflections. Field would live on the reflection/week row
     (something like `weekly_goal_feel`), not on `check_ins`.
   - **Daily, per check-in:** one optional prompt after Mark done. Field
     would live on `check_ins` (something like `session_feel`).
   - These are different data models, not two UI skins on one field. Do not
     pick a field name until the grain is chosen.
3. Historical rows: whichever grain is chosen, the field is simply `null`
   — not backfilled, not inferred from notes, never shown as a gap.
4. Privacy leak guard: if prototyped inside Reflections, this field must be
   excluded from the shared-reflection payload regardless of the reflection's
   own Private/Shared toggle — that toggle governs Keep/Let go/Try
   next/Notes today, and this field must not silently ride along with it.

**Recommended sequencing:** Do not build yet. If revisited, prototype the
weekly-reflection grain first — it adds meaning without daily friction and
stays inside a surface that's already allowed to summarize. Only promote to
the per-check-in grain if the weekly version proves useful and raising the
note affordance's visibility still isn't enough.

**Trigger to revisit:** Repeated personal use shows notes aren't capturing
this, or check-in notes are observed to be rare because the affordance is
missed.

### 14. Earlier weeks navigation: month grouping and status badges `Spec only`

**Problem:** The "Earlier weeks" flat list becomes hard to navigate beyond
12+ weeks. No visual layer to scan which weeks had reflections, were strong,
or are worth jumping to.

**Proposed direction (simplest first):**

1. Month groupings as section headers in the existing list.
2. Reflected / shared / no-activity status badge in each week row.
3. Only if those are insufficient: a week-resolution calendar layer.

**Surfaces affected:** `src/app/consistencytracker/reflections/page.tsx`.
No data model changes.

**Recommendation:** Build only after the list is observed to be a real
navigation problem.

---

## Infrastructure

### 20. Frontend architecture hygiene `Spec only`

**Source:** prompted by an X architecture-checklist thread (typed client/server
boundary, state machines, design-system drift, Suspense/error boundaries,
TanStack Query, type-safe query params, offline/WebSocket sync, SPA-vs-Next
choice). Most of that checklist doesn't apply — this app is server-rendered
App Router with Server Actions, not a client-fetching SPA, so TanStack Query,
XState, offline sync, and query-param libraries are explicitly **not**
warranted by anything in the current codebase. Two items hold up under
inspection and are worth doing; one is a discipline habit, not a library.

**1. Untyped Supabase boundary — real, worth doing.**
Confirmed: `createClient()` in `src/lib/supabase/server.ts` and `client.ts` is
untyped (`@supabase/supabase-js` v2, no `Database` generic), there's no
generated types file in the repo, and there are ~108 `.from(...)` call sites
across `src/app`, `src/lib`, `src/components` relying on hand-written row
types (`Goal`, `CheckIn`, reflection rows, etc.) staying in sync with
`supabase/schema.sql` by hand. This is exactly the kind of drift that caused
past schema/doc mismatches.
- Generate types via the Supabase CLI from `supabase/schema.sql` /
  migrations, type `createClient<Database>()` in both `server.ts` and
  `client.ts`.
- Don't replace product-concept types like `WeeklyGoalStats` — only the raw
  DB row shapes that already duplicate the schema.
- Gradual migration, not a single sweeping PR — one table/feature area at a
  time so it rides along with otherwise-unrelated touches to that area.

**2. Missing route-level error boundaries — real, small, worth doing.**
Confirmed: `loading.tsx` exists for six routes under `/consistencytracker`,
but no `error.tsx` exists anywhere in `src/app`. A Server Component
render/data-loading failure on a route currently falls through to Next's
default error UI instead of a calm, on-brand recovery screen.

`error.tsx` only catches that — render-time and data-loading throws within
its route segment. It does **not** catch a failed Server Action invoked from
a client component (e.g. `markDone`, `updateCheckInNote` in
`today-goal-card.tsx`): those reject back to the caller's own
`try`/`catch`, same as today. Adding `error.tsx` is a route-loading safety
net, not a substitute for each interactive component's own mutation-failure
handling — don't assume it covers both when implementing this.
- Add `error.tsx` to `/consistencytracker`, `/goals`, `/goals/[id]`,
  `/reflections`, `/partners`, `/partners/[id]`.
- Copy stays in voice: "Couldn't load this. Try again." — no stack traces,
  no alarm-red, consistent with the anti-shame/calm tone elsewhere.

**3. Inline Tailwind / primitive drift — real, lower priority.**
Confirmed: `src/lib/ui.ts` is 19 lines (three tap-target constants), not a
primitives layer. `skeleton.tsx` and `tooltip.tsx` exist as one-off
components, but most buttons/menus/dialogs still carry their own inline
Tailwind strings per call site — consistent with the repeated polish PRs
already in this roadmap (dropdown/menu polish, tooltip latency, ring sizing).
- Don't build a general design system.
- If touching this, extract only what's been independently polished more
  than once: button variants, menu panel/item, dialog shell, form field,
  section heading — app-specific, not generic.
- Lower priority than items 1–2; revisit opportunistically when the next
  polish PR touches one of these controls again, not as a standalone effort.

**4. Complex client component state — review habit, not a library.**
The late check-in card bug (`TodayGoalCard`, fixed across PRs leading to
commit `b3bf2a8`/`d773796`) is the concrete example: the bug came from an
unmodeled chain (server prop → optimistic state → durable local state →
server revalidation → client refresh → reconciliation), patched piecemeal
across three attempts before the full chain was traced. The fix was not a
new library — it was modeling the states explicitly.
- Going forward: any component juggling 3+ overlapping state sources
  (optimistic, durable-local, server-prop, in-flight) gets its state
  transitions written out before patching, not after a bug report.
- `useReducer` is the right escalation for a component if it grows past
  that; XState is not warranted anywhere in this app today and shouldn't be
  added speculatively.

**Explicitly not doing, and why:**
- TanStack Query — app fetches via Server Components/Server Actions, not
  client REST/GraphQL; nothing here needs request caching or pagination yet.
- XState — no multi-step workflow (offline sync, complex onboarding,
  realtime collab) exists in this app.
- Type-safe query params (`nuqs` etc.) — current params (`next`, `weeks`,
  `archived`, Google Calendar params) are few and low-stakes.
- Offline mode / WebSockets / SSE — no realtime or offline requirement
  exists; partner reactions and weekly email don't need it.

**Recommended sequencing:** items 1 and 2 first (typed Supabase client,
error boundaries) — both are bounded, mechanical, and reduce real risk
without touching product scope. Item 3 (UI primitives) only opportunistically
alongside other polish work. Item 4 is a standing review habit, not a ticket.

**Trigger to revisit item 3:** the same control gets a fourth ad-hoc polish
PR, or a new control visibly drifts from an already-polished sibling.

### 10. Vercel Speed Insights and Web Analytics quota `Done — PR #133 · Deployed`

**Shipped:** `VERCEL_ENV === "production"` guard added to `layout.tsx`. Local
dev and preview deployments are now excluded; only production traffic is
measured.

**Trigger to revisit:** Speed Insights hits 7K/10K in a single period.

### 15. Partner page: goal count scaling and performance `Next`

**Current behavior:**

- `MAX_SHARES_PER_GOAL = 10` caps partners per goal. No cap on goals per partner.
- Archived goals are filtered from the partner page query — correct, but silent
  (see item 17).
- No pagination: fetches all shared goals + one year of check-ins in two queries.
  At 10-15 shared goals this is noticeably slow; at 20+ it is a real perf problem.

**Proposed directions:**

1. **Archive notification copy** — covered in item 17 above.
2. **Goal anchor list (low effort):** Compact name + color dot anchor list at
   the top of the page for partners with 4+ goals. Jump links, no new data.
3. **Lazy calendar loading (medium effort):** Defer check-in fetch per goal
   until scroll. Intersection Observer + client island.
4. **Pagination (medium effort):** First N goals (e.g. 5), `?show=all` param.

**Decisions needed:**

- Should the partner see archived goals with a clear "archived" label, or is
  silent removal correct for privacy?
- What is the right initial render cap?

---

## Infrastructure observations

### Weekly email: Resend rate-limit handling `Done · Deployed`

**Problem:** The Monday cron sends one email per owner/partner pair in a tight
sequential loop. Resend's free tier enforces a rate limit; back-to-back sends
triggered 429 responses. The SDK (v4) returns `{ data, error }` rather than
throwing, so the original `try/catch` pattern silently returned `ok: true` on
failed sends — 429s were swallowed without retry.

**Shipped:**
- `src/lib/send-with-retry.ts`: `sendWithRetry` wraps any send function with
  up to 3 attempts, exponential backoff (2s / 4s), and retry only on
  rate-limit errors (`rate_limit_exceeded` / `429` / `too many requests`).
  Non-rate-limit errors (403, invalid_api_key) fail immediately.
- Both `sendInviteEmail` and `sendWeeklySummary` in `email.ts` now check
  `result.error` instead of relying on a try/catch that Resend v4 bypasses.
- Cron route: 1s sleep between sends to pace the burst; structured per-send
  result logging (`{ key, ok, attempts, error? }` per email).
- Tests: `send-with-retry.test.ts` covers all retry/no-retry branches and
  exponential backoff timing (8 tests).

### Weekly email CC: owner CTA lands on wrong page `Deferred`

**Observation:** The partner-summary email is sent TO the viewer and CC'd to
the owner so both can reply on the same thread. The "See their tracker" CTA
links to `/partners/ownerId` — correct for the viewer, but wrong for the
owner: clicking it as the CC'd recipient shows "Not your partner" since you
cannot view your own goals via the partner route.

**Intent to preserve:** The CC is deliberate — a shared email thread lets
partners have a quick conversation without leaving their email client.

**Possible directions (not yet evaluated):**
- Two CTAs in the email body: one for the viewer (`/partners/ownerId`), one
  for the owner (`/consistencytracker`). Both in the same email; both correct.
- Remove CC and accept that the shared-thread intent is lost.
- Send a separate copy to the owner with a different CTA (not a CC).

**Trigger to revisit:** A real partner conversation starts on the email thread,
or the dead CTA generates confusion or support noise.

---

## Sequencing

### Shipped and deployed
1. PR #130 — Reflections polish (labels, stats, tooltip)
2. PR #132 — Note attribution on second line
3. PR #131 — Aggregate calendar engagement unlock
4. PR #134 — Dropdown / menu polish
5. PR #133 — Vercel quota guard
6. PRs #135–#139 — Goals-list week rings (initial, size, Phi, placement, tooltip copy)
7. PR #140 — Tooltip latency + semantic copy (item 13 / PR C.1)
8. PR #141 — Archive partner notification copy (item 17 / PR F)
9. PR #142 — Current week included in goal rings (item 4 extension)
10. PR #143 — Reflections structure: WeekGrid above stats, stats as pills (item 11 / PR G)
11. PR #144 — Reflection visibility: inline `· Private / · Shared with partner` suffix (item 13 / PR G.1)
12. G.1 follow-up — Named audience label (`· Arjun` / `· Arjun & Richa` / `· N partners`) + 2s confirmation on share toggle
13. Infrastructure — Resend rate-limit fix: v4 error handling, `sendWithRetry`, 1s pacing, structured logging
14. Item 18 — Reflection content in weekly email (partner "In their own words", self "Your reflection")
15. PR #145 (item 21) — Today over-quota classification: quota-met weekly goals drop from the required list into optional over-quota chips; warmer "all caught up" header copy

### Not started — ordered by effort and dependency
16. **PR H (item 16):** Archived goal row UI — mock tab vs. section shape
    before coding.
17. **PR E (item 7):** Partner reaction compression — defer until a goal is
    shared with 3+ partners.
18. **Item 6:** Calendar month alignment — revisit with real screenshots first.
19. **Item 15:** Partner page scaling — spec lazy loading before real usage hits.

### Spec only / Later
- Item 8: Planned break / vacation mode
- Item 9: Longer cadences
- Item 14: Earlier weeks navigation (month grouping + status badges)
- Item 19: Check-in feel / session quality — discovery only, do not build yet
- Item 20: Frontend architecture hygiene — typed Supabase client + error
  boundaries are real and bounded; UI primitives only opportunistically;
  no TanStack Query / XState / offline sync / query-param libs warranted yet

**Rule:** Do not combine model changes with polish PRs. Planned breaks and
longer cadences must not ride along with UI cleanup.
