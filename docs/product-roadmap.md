# Product roadmap notes

This is a decision backlog, not a committed build plan. Use it to keep product
ideas from turning into opportunistic PRs without first checking whether they
fit Consistency Tracker's philosophy: evidence over grades, calm over clever,
partners as a trust boundary, and a weekly rhythm as the core loop.

Each item is tagged: **Now**, **Next**, **Later**, or **Spec only**.

## How to use this doc

For each idea, decide:

- **Customer problem:** what user pain or job does this solve?
- **Current workaround:** what does the app already let the user do?
- **Why now:** what signal says this deserves attention?
- **Why not yet:** what risk or complexity argues for waiting?
- **Surfaces affected:** which pages, emails, partner views, and metrics change?
- **Trigger to revisit:** what real usage or product decision should reopen it?

---

## Now: Small polish with high trust impact

Low-risk changes that improve clarity and craft without touching the data model
or scoring rules.

### 1. Reflection language: make the weekly prompt more human `Done — PR #130`

**Shipped:** Today card subcopy changed to `What helped, what got in the way,
what to try next.` Editor labels changed to `Keep`, `Let go`, `Try next`,
`Notes`. Partner reflection view and smoke checklist updated to match.

### 2. Reflection notes: attribution on second line `Done — PR #132`

**Shipped:** `ReflectionNotes` renders the quote on the first line and the
goal name / date on a smaller muted second line. The em-dash inline separator
pattern is gone.

**Still open (optional, defer until we see real usage):** mobile two-line clamp
per note item. The collapse toggle (`more` / `less` at item count 3) remains
unchanged.

### 3. Dropdown and overflow menu polish `Now`

**Problem:** The Skip dropdown, goal-list kebab menu, and goal-detail gear menu
still feel like generic boxy web controls. They appear on sensitive actions
such as Skip, Archive, Delete, and sharing/editing pathways.

**Current state:** Functional, but visually less refined than the calm logbook
surface.

**Possible direction:**

- Shared menu styling: `rounded-lg`, 1px border, restrained shadow only because
  the menu floats.
- 44px rows, left-aligned labels, clear separators.
- Destructive actions separated and red only for the actual destructive command.
- For Skip on mobile, consider a bottom-sheet style only if options become
  crowded.

**Why now:** Pure UI craft, high perceived quality, no metric risk.

**Risks:** Avoid over-designing menus into heavy cards. Menus should feel
transient.

**Surfaces affected:** Today Skip, goal-list overflow, goal-detail gear, delete
confirmation if the same menu system is touched.

**Recommendation:** Pick up immediately after the reflection polish PR.

### 11. Reflections page: visual structure and density `Next (structure)`

**Bugs fixed in PR #130:** stats line changed from `text-xs` to `text-sm`;
gap between notes toggle and stats line tightened from `mb-6` to `mb-3`.

**Structural improvements (spec before coding):**

1. **Move `WeekGrid` above the stats and notes.** The colored week cells are
   the best visual anchor on the page; they should appear immediately after the
   narrative, not after a scroll through prose. Order should be:
   narrative, grid, notes, stats, writing prompt.
2. **Stats as pills, not a run-on sentence.** `9 done · 1 skipped (other x 1)
   · 10 missed · 1 extra` is dense. Render each as a small muted pill/chip.
   Same data, visually chunked and scannable.
3. **Notes: attribution on second line.** Handled in PR #132 (see item 2 above).
4. **Two-line note clamp on mobile.** Long notes wrap to many lines; clamp each
   item to two lines with a per-item expand affordance, not a single "more" for
   the whole list. Deferred until #132 is merged and real usage is observed.

**Surfaces affected:** `src/app/consistencytracker/reflections/page.tsx`
(`WeekDetailBody` component), `src/components/reflection-notes.tsx`.

**Constraint:** The page must stay server-renderable for past weeks. `WeekGrid`
is already a server component. The notes toggle is the only client island;
keep it isolated.

**Recommendation:** Fix the two bugs in PR A. Stage the structural work as a
separate PR reviewed against real screenshots before merging.

### 12. Time-of-day chart: tooltip clarity `Done — PR #130`

**Shipped:** Tooltip changed from `Afternoon · 3` to `3 check-ins in the
afternoon` (plain language, singular-aware). Variables extracted for
readability.

---

## Next: Product payoff and scale improvements

More visible changes. Spec before implementation; they still fit the current
weekly model.

### 4. Goals list glanceable status `Next`

**Problem:** The Goals page list is mostly textual. A user cannot quickly tell
which goals are done today, behind this week, or carrying extra evidence
without opening detail pages.

**Current workaround:** Open a goal detail page, read the ring and This Week
rows, or infer from Today.

**Possible direction:**

- Add a compact status phrase to each row:
  - `Done today`
  - `Not yet today`
  - `2 of 3 this week`
  - `+1 extra`
  - `3 day streak`
- Optionally add a tiny current-week dot row, not a mini calendar.

**Why now:** Helps users triage at a glance and makes the Goals page more
useful without turning it into a dashboard.

**Why not yet:** It needs careful hierarchy. The row already carries category,
cadence, description, sharing, reaction dot, and menu.

**Surfaces affected:** Goals overview rows, possibly helper functions that
compute Today/this-week status.

**Decision needed:** Should the row optimize for today's action, this week's
quota, or long-term status? Do not try to show all three equally.

**Recommendation:** Start with a text-first status, then add a micro-visual
only if text alone is not scannable enough.

### 5. Aggregate calendar unlock for engaged single-goal users `Next`

**Problem:** The Goals-page aggregate calendar currently unlocks only with
`3+ active goals` plus check-in history, or if `calendar_unlocked` was already
persisted. A focused user with one goal and weeks of evidence has to go several
clicks deep from Today to see history.

**Current state:** An earlier PR briefly implemented a secondary path:
`8+ done check-ins across 3+ ISO weeks` for any single goal. Codex review
removed it before merge because the aggregate calendar was considered noisy for
fewer than three goals. Since then, the old heatmap has been replaced by a
more legible calendar view.

**Possible direction:**

- Reintroduce a narrow engagement unlock:
  - `3+ active goals`, or
  - `1 active goal with 8+ scored check-ins across 3+ ISO weeks`.
- Use scored check-ins for the threshold. Extra check-ins can enrich the
  calendar once visible, but should not be the reason it unlocks.
- Adapt the section copy:
  - One goal: `Recent activity`
  - Three or more goals: `Recent activity - all goals`

**Why now:** The calendar is now easier to understand, and the current unlock
may hide the product's evidence payoff from focused users. This affects
new-user payoff more directly than most polish items.

**Why not yet:** With one goal, this is not truly an aggregate view. The copy
and title must avoid overclaiming.

**Surfaces affected:** `calendar-unlock`, Goals overview calendar copy,
README/metrics glossary if the rule changes.

**Decision made (PR #131):** Engagement unlock is 1-goal only. Two-goal users
still need 3 goals or a persisted flag. The copy and title adapt per goal count.

**Deferred: 2-goal engagement unlock.** If a 2-goal user has 8+ scored done
check-ins across 3+ weeks on at least one goal, the current code does not unlock
the calendar. The change is one line in `calendar-unlock.ts`:
`activeGoalCount === 1` to `activeGoalCount <= 2`. Copy would stay "Recent
activity, all goals" since it genuinely covers two goals. Revisit when a real
2-goal user hits the wall.

**Recommendation:** Worth picking up before dropdown polish. If implemented,
keep it scored-only and copy-aware. If shown for one goal, avoid aggregate
language: use "Recent activity", not "All goals".

### 6. Calendar month alignment and trimming `Next`

**Problem:** `MonthCalGrid` trims rows entirely before goal start and entirely
after today. If a goal started in the last week of a past month, that month can
render as a one-row grid at the top. This is compact, but it loses the visual
truth that the row was the final week of the month.

**Current workaround:** Individual pre-start/future cells are transparent, and
irrelevant rows are removed to reduce empty space.

**Possible directions:**

- Keep current compact trim everywhere.
- Preserve calendar position in goal detail and partner pages; keep compact
  trim on the Goals overview.
- Preserve all calendar rows, using transparent cells for not-applicable time.

**Why now:** Calendar history is now a core visual language. If it feels
spatially odd, it weakens trust in the record.

**Why not yet:** More whitespace may make the recent history feel sparse again,
which was the original problem.

**Surfaces affected:** `MonthCalGrid`, `GoalHistoryView`, Goals aggregate,
partner history, screenshots/smoke checklist.

**Decision needed:** Is calendar-position truth more important than compactness
for recent history?

**Recommendation:** Revisit with real screenshots before changing. This is a
visual judgment, not a logic bug.

### 7. Partner reaction compression `Next`

**Problem:** Goal detail renders every reaction summary line under the header.
Reactions are aggregated by partner and reaction kind across weeks. A goal can
be shared with up to 10 partners, so the owner page can grow to many lines if
several partners react.

**Current state:** `MAX_SHARES_PER_GOAL = 10`. `getGoalReactions` returns one
summary per `(reactor, kind)`, and the goal page maps each summary to a line.

**Possible direction:**

- Render a compact summary first:
  - `Richa, Arjun, and 3 others noticed this`
  - `5 saw it · 2 proud`
  - `Latest this week`
- Put detailed partner-by-partner lines behind `View reactions`.
- Keep the emotional signal visible; move the ledger behind disclosure.

**Why now:** This can become clunky before the product has many users, and it
sits above check-ins/history on the goal detail page.

**Why not yet:** If most users only have 1-2 partners, the current explicit
sentences may feel warmer.

**Surfaces affected:** Owner goal detail reaction block, reaction summary
helpers/tests, possibly copy in partner docs.

**Trigger to revisit:** Any goal shared with more than 3 partners, or any
screen where reactions push This Week/history below the first viewport.

**Recommendation:** Consider after aggregate calendar unlock. Only urgent if
partner sharing expands quickly.

### 13. Reflection visibility: replace pill toggle with the sharing glyph pattern `Next`

**Problem:** The reflection editor shows a `Private | Partner` pill toggle as
the visibility control. It works, but it is visually heavier than its job:
two large rounded pills, one filled black, occupying their own row above Save.
The goal detail page already solved this: a single tappable status line
(`GoalSharing`) that reads "Private" or "Shared with Richa" at rest and opens
a sheet on tap. Reflections have a simpler version of the same binary, so the
same mental model should apply.

**Current state:** `ReflectionEditor` renders two `<button>` pill toggles
(`Private` / `Partner`) side by side, plus visibility-conditional explanatory
text below them. The pills are the only client-interactive element in the
editor besides Save.

**Proposed direction:**

- Replace the pill row with a single tappable inline status: `· Private` or
  `· Shared with partner`. Same typographic register as the goal sharing badge,
  muted at rest, tap to toggle.
- Position it as a quiet suffix on the Save row: `[Save reflection]  · Private`.
  The status sits to the left of the Save button (or below it on mobile), not
  in its own row.
- On tap, flip the state directly (no sheet needed; there is no partner
  selection, just a binary). Confirm with a brief visual state update.
- The conditional "no partner yet" explanation text stays; it replaces the
  pills with a muted sentence, same as now.

**Surfaces affected:** `src/components/reflection-editor.tsx` only. No data
model changes; the `visibility` state and save action are unchanged.

**Decision needed:** Direct flip (tap changes state in place) or a small
confirmation step? Given reflection visibility is easy to change and
reversible, direct flip is fine.

**Recommendation:** Natural companion to the reflections structure PR.

---

## Later: Bigger product-model changes

These need a spec because they touch scoring, partner trust, weekly email, and
reflection semantics.

### 8. Planned break / vacation mode `Later`

**Problem:** Users will travel, fall sick, or have life events. The current
model offers skips and catch-up, but not a clean way to say "these promises do
not apply for this date range."

**Possible direction:**

- A planned break flow: choose date range, pause all goals or select goals,
  keep some goals active if they still apply. Paused days are neutral: not
  missed, not skipped, not extra.
- Partner view can say `Paused for travel` if the goal is shared.

**Why not now:** It is not just a UI shortcut. It affects streaks, missed days,
weekly reflection, partner surfaces, email, and history.

**Surfaces affected:** Today, goal detail, Goals list, Reflections, Partner
view, weekly email, stats/scoring, schema.

**Decision needed:** Is pause a neutral system state, or a user-authored note?
Can a paused day be overridden with a done check-in?

**Trigger to revisit:** The first real vacation/travel pain, or before inviting
users whose routines frequently vary.

**Recommendation:** Roadmap, not immediate. Spec before code.

### 9. Longer cadences: every N weeks, monthly, quarterly `Later`

**Problem:** Some real commitments do not fit a weekly schedule: therapy every
other week, monthly deep clean, quarterly review, periodic admin work.

**Current model:** Everything resolves to a week. Today, goal detail, partner
reactions, weekly reflection, and weekly email all assume weekly promises.

**Possible direction:**

- First explore `every 2 weeks` only if it still fits weekly reflection.
- Treat monthly/quarterly commitments as a different object type later, not as
  a quick extension of weekly goals.
- Consider "This week's focus" separately from recurring habits.

**Why not now:** It risks turning the app into a generic goals/reminders tool.
The current product strength is its weekly rhythm and evidence loop.

**Surfaces affected:** Goal form, Today due logic, check-in eligibility,
completion math, reflections, weekly email, partner reactions, calendar
history, docs.

**Decision needed:** What is a miss for a monthly goal? End of month? Grace
period? Does a weekly reflection score it before it is due?

**Trigger to revisit:** Multiple real users create awkward weekly workarounds
for non-weekly commitments.

**Recommendation:** Keep parked until the weekly model has more usage evidence.

### 14. Earlier weeks navigation: scaling and simpler grouping first `Spec only`

**Problem:** The "Earlier weeks" section is a flat list of `<details>` rows.
With one past week it looks fine. With 6-12 weeks it becomes a long scroll of
collapsed accordions. With months of history, the user cannot tell at a glance
which weeks have reflections written, which were strong or weak, or jump
directly to a week they remember.

**Current state:** Each past week renders as a `<details>` row with date range
+ summary stats on the right (`6 done · 25% ▾`). The list is linear, newest
first, paginated by a "Show earlier weeks" link at the bottom (+12 weeks per
click). There is no visual navigation layer above the list.

**How it scales:**

- 4-8 weeks: readable but list-heavy
- 12+ weeks: significant scrolling; "Show earlier weeks" is the only navigation
- 26+ weeks: unusable without a higher-level view

**Proposed direction (simplest first):**

Start with the list before adding a calendar layer:

1. Add month groupings as section headers in the existing list. "May 2026",
   then the week rows under it. Low effort, no new visual grammar.
2. Show reflected / shared / no-activity status in each week row so the user
   can scan without expanding. This is already available from `reflectionByWeek`.
3. Only after that, if the list is still hard to navigate, consider a
   week-resolution calendar layer above the list as a supplement (not a
   replacement). Each row in the calendar represents one ISO week. States:
   reflected, not reflected, shared with partner, no activity. Visible only
   after 8+ past weeks.

**Why the calendar-first design is too heavy now:** A week-per-row calendar
is a new visual grammar not used elsewhere in the app. Month grouping and
status badges in the existing list are simpler, reuse familiar patterns, and
may fully solve the navigation problem without adding a new concept.

**Surfaces affected:** `src/app/consistencytracker/reflections/page.tsx`
(the `Earlier weeks` section). No data model changes.

**Recommendation:** Spec only. Build only after the list is observed to be a
real navigation problem. Start with month grouping and status badges; only
add the calendar layer if those are insufficient.

---

## Infrastructure

### 10. Vercel Speed Insights and Web Analytics quota `Ops hygiene`

**Problem:** The personal project is approaching Vercel free-tier limits:
Speed Insights (2.8K of 10K, 30-day window) and Web Analytics (3K of 50K).
Speed Insights is the tighter constraint at 28% used; development sessions
with frequent reloads are the likely driver.

**Current state:** Both are loaded via first-party Vercel scripts in
`src/app/layout.tsx` (not via the npm packages):

- `/_vercel/speed-insights/script.js`
- `/_vercel/insights/script.js`

The npm packages (`@vercel/speed-insights`, `@vercel/analytics`) are not used
because of a peer-dep conflict with the Vitest/Vite toolchain. This means
package-level props like `sampleRate` are not available without first switching
back to the npm package.

**Options (script-level controls available today):**

| Lever | What it does | How to apply |
|---|---|---|
| **Vercel project settings** | Speed Insights has a sampling rate control in the Vercel dashboard (Settings, Speed Insights). Check there before touching code. | Dashboard only, no code change. |
| **Disable in dev via script condition** | Conditionally render the `<Script>` tags only when `process.env.NODE_ENV === 'production'`. Dev reloads are likely the largest source of hits. | One-line conditional in `layout.tsx`. |
| **Switch to npm package + sampleRate** | Resolves peer-dep conflict, then add `sampleRate={0.5}`. | Requires resolving toolchain conflict first; higher effort. |

**Decision needed:**

1. Check the Vercel dashboard first: does Speed Insights already offer a
   project-level sampling setting? If yes, set it there.
2. If not, add the `NODE_ENV` production guard in `layout.tsx`. That alone
   likely keeps the quota flat.
3. Only consider switching to the npm package if the dashboard setting and
   NODE_ENV guard are insufficient.

**Surfaces affected:** `src/app/layout.tsx`. No data model changes.

**Trigger to revisit:** Speed Insights hits 7K/10K in a single period.

### 15. Partner page: goal count scaling and performance `Next`

**Current behavior (from code):**

- `MAX_SHARES_PER_GOAL = 10` in `src/lib/actions/partners.ts` caps how many
  *partners* can see a single goal. There is no cap on how many goals a
  partner can see; all active shared goals render as a flat sequential list.
- Archived goals (`active = false`) are filtered out via `.eq("active", true)`
  in the partner page query. A partner never sees a goal you archived. This is
  correct but not surfaced: if a partner is watching a goal and you archive it,
  it silently disappears from their view.
- No pagination: the page fetches all shared goals in one query, then fetches
  one year of check-ins across all of them in a second query. The check-in
  query is date-bounded but unbounded by goal count and row count. At 10-15
  shared goals this is noticeably slow; at 20+ it is a meaningful perf problem.

**Problem at scale:**

With 1-3 shared goals the current design is clear and warm. With 8+ shared
goals, the partner page becomes a very long scroll with no navigation layer.
Each goal block is taller than a reflection row, making this the harder
scaling problem of the two.

**Proposed directions:**

1. **Archive copy in the archive action flow (low effort):** When archiving a
   goal that is currently shared, mention it in the archive confirmation or
   menu action: "Partners will no longer see this goal." No persistent
   tombstone needed; the message appears only at the moment of action. (Verify
   whether archive currently uses a confirmation modal or a direct menu action
   before assuming a dialog exists.)

2. **Goal anchor list (low effort):** If a partner has 4+ shared goals, render
   a compact anchor list (goal name + category color dot) at the top of the
   page before the goal blocks. Same pattern as a table of contents. No new
   data, just jump links. Works with the current server-rendered flat list.

3. **Lazy calendar loading (medium effort, perf):** The full-year calendar is
   the heaviest part of each goal block. Defer the check-in fetch per goal
   until the user scrolls to it (Intersection Observer + client island, or a
   separate RSC segment per goal).

4. **Pagination (medium effort):** Limit the initial render to the first N
   shared goals (e.g. 5), ordered by most recently active, with a "Show all N
   goals" link. Simplest version: a `?show=all` query param the server reads.

**Decisions needed:**

- Should the partner see archived goals with a clear "archived" label? Current
  silent removal is defensible for privacy but could confuse a partner who was
  actively watching a goal.
- What is the right default cap for initial render? 5 feels right given each
  goal block is tall, but may feel stingy for a partner with 3 real goals.

**Recommendation:** Add archive copy in the archive action flow (item 1) as a
one-liner. Spec lazy calendar loading before any real partner uses the app
with 5+ shared goals.

---

## Sequencing

1. **PR #130 (done): Reflections polish** — labels, stats size, gap, tooltip
2. **PR #132 (done): PR A.1** — note attribution on second line
3. **PR #131 (open): PR B** — aggregate calendar engagement unlock
4. **PR C:** dropdown/menu polish (item 3)
5. **PR D:** Goals list glanceable status (item 4)
6. **PR E:** partner reaction compression (item 7, if partner sharing expands)
7. **Spec only:** planned breaks, longer cadences, earlier-weeks navigation

**Ops hygiene (anytime):** Vercel quota guard. Check dashboard settings first;
if no sampling control exists there, add the `NODE_ENV` production guard to
`layout.tsx`. Not urgent at current usage levels but worth doing before the
next heavy development sprint.

Do not combine model changes with polish PRs. Planned breaks and longer
cadences should not ride along with UI cleanup.
