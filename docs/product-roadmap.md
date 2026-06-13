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

### Not started — ordered by effort and dependency
11. **PR G.1 follow-up (item 13 visibility):** Shipped — named audience label +
    2s inline confirmation on share action.
12. **PR H (item 16):** Archived goal row UI — mock tab vs. section shape
    before coding.
13. **PR E (item 7):** Partner reaction compression — defer until a goal is
    shared with 3+ partners.
14. **Item 6:** Calendar month alignment — revisit with real screenshots first.
15. **Item 15:** Partner page scaling — spec lazy loading before real usage hits.

### Spec only / Later
- Item 8: Planned break / vacation mode
- Item 9: Longer cadences
- Item 14: Earlier weeks navigation (month grouping + status badges)

**Rule:** Do not combine model changes with polish PRs. Planned breaks and
longer cadences must not ride along with UI cleanup.
