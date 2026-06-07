# Product

## Register

product

## Users

The owner and a small circle of **accountability partners** (1–3 people they
trust). Primary context: a quick daily check-in on a phone, plus a weekly sit
to reflect. They are not power users optimizing a quantified-self dashboard;
they are people trying to keep showing up at a few things that matter, and to
be gently seen doing it. The job on any given screen: "check in today fast", "fix a
day I forgot", "record something extra I did", "see whether I'm actually showing
up", "say a sentence about my week", or "notice how my partner is doing".

## Product Purpose

A calm, private habit tracker built around **evidence of showing up**, not
scoring. You define a few goals (and *why* each matters), check in daily, see
your record fill in, reflect once a week, and optionally share specific goals
with a partner who can react with a quiet "saw it / proud". Success is the user
coming back and feeling supported, not graded. A missed day is never a failure
state; it is something to notice and, if you want, catch up on. Going beyond
what you promised — an extra day, a higher-than-quota week — is recorded as
evidence and shown warmly, never inflating a score.

## Brand Personality

Calm, honest, supportive. Plain second-person voice ("your record of showing
up", "what got in the way this week?"). Warm without being cheerful-corporate;
truthful without being clinical. It never celebrates with confetti and never
scolds. If a sentence sounds like a productivity guru or a fitness app, it is
wrong.

## Anti-references

- **Gamified habit trackers** (streak-shaming, confetti, badges, XP,
  leaderboards). Accountability here is a person, not a points system.
- **Fitness-dashboard aesthetics** (activity rings, neon-on-dark, "you broke
  your streak!" red states).
- **Quantified-self / SaaS metric dashboards** (hero-metric cards, big numbers
  with gradient accents, charts for their own sake).
- **Anything that reads as a verdict on a missed day.** No red "failed",
  no guilt copy.

## Design Principles

1. **Evidence, not grades.** Show the record of showing up. A completion
   percentage only appears where the job is to *score* (Reflections on a
   finished week, the weekly email) — never where the job is to *notice* (the
   Today loop, the Partner view, the calendar history).
2. **Anti-shame by default.** A blank or partial week reads as "still time" or
   "fresh week", not failure. Copy stays encouraging and points at the next
   action.
3. **Shape follows job.** Each concept gets its own visual language: the current
   week is a headline, a progress **ring**, and an editable grid of weekday
   cells (the **"This week" rows**); past frequency weeks are **quota rows**;
   the **calendar history** is the long-term record. Never make one shape do
   another's job (the calendar history is a record, not a control).
4. **Calm over clever.** Restraint, whitespace, one quiet category accent at a
   time. Monochrome carries the structure; color carries meaning, never
   decoration.
5. **Partners are the trust boundary.** Sharing is per-goal, partner-only, and
   reversible. Privacy is the default; nothing is shared until you choose it. A
   shared goal also exposes its category name and color, so a partner sees how
   you've grouped it.

## Accessibility & Inclusion

- **44px minimum touch targets** (iOS HIG / Material) on primary actions and
  row controls, via the shared `tapTarget` convention (`src/lib/ui.ts`). A few
  low-risk inline text toggles (e.g. a "more" / "less" link) stay smaller and
  subordinate by design.
- **Color is never the only signal.** State always has a label or text (the
  "This week" cells carry `aria-label`s; the calendar history and progress
  visuals have spoken summaries).
- Semantic HTML, native `<details>` for collapsibles, real `<label>`/`htmlFor`
  associations, focus-visible borders. WCAG AA is the intent.
