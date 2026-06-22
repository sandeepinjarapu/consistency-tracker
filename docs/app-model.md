# App model

The current mental model of Consistency Tracker. **Slow-changing product and
domain truth only.** Read this first; it points to the docs that define the
details. If you are an agent (or a returning human) about to change behavior,
this is your re-entry point — the thing that lets you reason about a change
without replaying months of history.

## 0. What this doc defers to

- State / metric definitions → [metrics-glossary.md](metrics-glossary.md)
- Why a rule exists → [decisions/](decisions/) (ADRs)
- What might change next → [product-roadmap.md](product-roadmap.md)
- Product principles / tone → [../PRODUCT.md](../PRODUCT.md), [../DESIGN.md](../DESIGN.md)
- Feature mechanics → [extra-check-ins-spec.md](extra-check-ins-spec.md)
- Implementation details → code and tests

This doc holds only the connective tissue none of those hold: surface
ownership, trust boundaries, invariants, and known seams. It does **not**
redefine anything the glossary or an ADR already owns.

## 1. Product loop

Today → check in → goal detail / history → weekly reflection →
partner / email accountability.

A few goals, checked in daily, reflected on weekly, witnessed by 1–3 trusted
partners. The unit of rhythm is the **ISO week** (Monday-anchored).

Excludes: component tree, exact routes, styling.

## 2. Surfaces and ownership

Axis: each surface → the job it exists to do.

| Surface | Primary job | Owns | Must not own |
|---|---|---|---|
| Today | Prompt what needs attention now | requiredness, fast check-in, over-quota chips | diagnosis, history, scoring |
| Goals list | Glanceable "am I showing up" | week rings, streak/count signal | a completion % (no grades here) |
| Goal detail | Edit and inspect one goal | week status, week rows, history, editing | partner-private framing |
| Reflections | Private weekly sensemaking | narrative, missed / shortfall diagnosis, notes | a partner-safe summary by default |
| Partner page | Accountability / witness | shared evidence: done/skipped, streak, shared reflection, reactions | the owner's daily check-in notes; unshared reflections |
| Weekly email | Async weekly summary | scored progress, shared reflection | the full private diary |

## 3. Core domain concepts

One sentence each, meaning only — no formulas, schema, or file references
(those live in the glossary / specs).

- **Goal** — a thing the owner intends to show up for, on a cadence, optionally
  with a "why" and a shared document.
- **Check-in** — one day's record for a goal: `done` or `skipped`, optionally
  with a private note.
- **Weekly reflection** — the owner's sentences about a week (Keep / Let go /
  Try next / Notes), private unless explicitly shared.
- **Partner share** — a per-goal grant letting a trusted partner witness that
  goal's evidence.
- **Reaction** — a partner's per-week acknowledgement of a shared goal
  (👀 saw it / 👏 proud).
- **Email summary** — the Monday async digest of the week just ended.

## 4. State distinctions not owned by the glossary

This section does **not** redefine `done`, `skipped`, `extra`, `scoredDone`, or
`completionRate` — those live in [metrics-glossary.md](metrics-glossary.md). It
records only the cross-surface traps:

- **missed is date-level; count-goal shortfall is week-level.** A specific-day
  goal not done on an eligible day is a *missed date*. A frequency goal that
  ends the week under quota is a *weekly shortfall*, not a set of missed dates.
  Conflating them mis-frames the Reflections diagnosis.
- **required vs over-quota is a Today framing, not a stored field.** It is
  derived from the logical day's entry state, not read from the check-in row.
- **partner-visible reflection ≠ daily check-in notes.** They are different
  objects with different visibility (see §6).

## 5. Quota and logical-day invariants

Rules an agent must not silently violate. **Each invariant links to its
canonical source. An unlinked invariant is not accepted truth — mark it open
or write an ADR/test.**

| Invariant | Canonical source |
|---|---|
| Weekly-quota requiredness is entry-state based (`scoredDoneBeforeDay < weeklyTarget`), never same-day check-in presence | [ADR 0001](decisions/0001-weekly-quota-requiredness.md) + `today-required.test.ts`, `today-model.test.ts` |
| Night-owl logical day (12–5 AM) writes to *yesterday*, keyed on `isoWeekStart(yesterday)`, but renders on today's surface | `today-model.test.ts` |
| Extras are seen, not scored — no extra ever moves a metric | [metrics-glossary.md](metrics-glossary.md) "Founding principle" |
| Today prompts obligations; Goal detail edits / diagnoses | this doc §2 + `today-model.test.ts` |
| Longer cadences (every-N-weeks / monthly) will force re-deriving the quota window | [ADR 0001](decisions/0001-weekly-quota-requiredness.md) "Revisit when" |

## 6. Privacy and trust boundaries

> **Owner-reviewed 2026-06-22.** Seeded from current code and confirmed as
> intended. Re-confirm on any change to what a partner can see.

A partner of a goal **can see** (RLS-enforced, current code):

- goal name, **description / "why this matters"**, and **goal document URL**
- cadence (target days / weekly target)
- `done` / `skipped` check-ins (date + status) for the shared goal
- streak and check-in counts; reactions
- a weekly reflection **only if** the owner marked it shared that week

A partner **cannot see**:

- the owner's **daily check-in notes** (never queried on the partner page)
- any reflection the owner did not share
- goals not shared with that partner

The weekly **email** includes scored progress and, for partners, the shared
reflection's filled fields ("In their own words"); a private reflection never
appears in a partner's email. The owner's own self-summary email always
includes their own reflection.

> **Accepted (owner sign-off, 2026-06-22):** a shared goal's motivation
> (`description`) and goal document URL are intentionally partner-visible —
> they are context for the witness, not private diary. Daily check-in notes
> stay owner-private.

## 7. Surface matrix

Axis: each UX/domain concept → how each surface renders it. Rows are
UX-level concepts, **not** the metric rows already in the glossary.

| Concept | Today | Goals list | Goal detail | Reflections | Partner | Email |
|---|---|---|---|---|---|---|
| Required check-in | prompts action | ring | editable, week row | summarized | evidence | scored line |
| Over-quota extra | optional chip | center dot on ring | history | evidence, not score | evidence if shared | `+N extra` |
| Off-target extra | optional chip | ring marker | history | evidence, not score | evidence if shared | `+N extra` |
| Missed (date) | not framed | gray ring + bar | calendar / status | private diagnostic | — | not failure-framed |
| Shortfall (week) | not framed | partial ring | week status | private diagnostic | — | `done / target` |
| Daily note | entered with check-in | — | owner-only (view/history) | owner-only | not shared | not emailed |
| Weekly reflection | — | — | — | owner-only edit | shared only | shared only |
| Reaction | — | new-reaction dot | summary line | — | partner leaves it | — |
| Archived goal | — | hidden (today) | — | — | — | — |

Goals-list ring vocabulary (full / partial / dot / bar / gray) is defined in
[product-roadmap.md](product-roadmap.md) item 4 — this matrix only says *which*
ring a concept maps to, not what each ring looks like. The matrix is a partial
map of the most trap-prone concepts, not an exhaustive surface spec.

## 8. Known seams / high-risk zones

Each comes from a real bug, decision, or confusion — not invented.

- **Today model vs Goal detail model** — two renderings of one goal's state
  (`buildTodayModel` extraction, PR #147).
- **`hasCheckInOnDay` surplus bug** — same-day check-in was conflated with
  entry-state requiredness ([ADR 0001](decisions/0001-weekly-quota-requiredness.md)
  superseded shortcut).
- **Night-owl logical-day boundary** — write target ≠ render surface.
- **Reflection stats vs weekly email** — Reflections is a private diagnostic
  surface with `missed`, shortfall, notes, and narrative; weekly email is a
  partner-safe scored summary. Count-goal shortfall is week-level, not a set of
  missed dates, so do not force the two surfaces to expose the same categories
  (glossary: "don't compare or unify these").
- **Daily notes vs shared weekly reflection** — different objects, different
  visibility; easy to leak one as the other.
- **Partner reactions at scale** — the reaction summary grows per partner
  (roadmap item 7, not yet hit).
- **Archive / share interactions** — archived goals are invisible today
  (roadmap item 16); their share/visibility behavior is undecided.
- **Weekly quota vs future longer cadences** — the ISO-week window assumption
  breaks for monthly/quarterly (roadmap item 9).

## 9. How to use this doc

Before a domain-state change:

1. Read this doc.
2. Read [change-protocol.md](change-protocol.md).
3. Read the relevant glossary / ADR / spec.
4. Inspect the code and tests.
5. In the PR body, state whether the change alters this doc.

If a change alters a §5 invariant, a §6 trust boundary, a §7 surface behavior,
or a §8 seam, **update this doc or add an ADR in the same PR.** If it does not,
state **"no app-model change"** in the PR body.

**Validation test:** a cold reader of §5 plus
[ADR 0001](decisions/0001-weekly-quota-requiredness.md) should be able to catch
a `hasCheckInOnDay`-style quota regression. If they couldn't, this doc isn't
doing its job.
