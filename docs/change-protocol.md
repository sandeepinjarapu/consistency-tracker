# Change protocol

How to make a change safely in this repo. Routed here from
[AGENTS.md](../AGENTS.md). The point is to **review the state model before the
code**, not only the diff after the model has been silently chosen — that is
the discipline that was missing when a quota-met goal was twice classified as
required work (see [decisions/0001](decisions/0001-weekly-quota-requiredness.md)).

## 1. Classify the change

**Low-risk** — copy, spacing, icons, loading skeletons, isolated non-state UI
polish, docs cleanup. Make the focused change, run build/tests if relevant,
done. The rest of this document does not apply.

**Domain-state** — anything that changes what the app believes happened, what
the user is asked to do, what counts toward a score, or what another person
sees (the list in [AGENTS.md](../AGENTS.md)). Follow the steps below.

## 2. Write the state-transition table first

Before code, write the table for the behavior you are changing. One row per
meaningful entry state × action:

| Entry state | User action | Server write | Immediate UI | Post-refresh UI | Reload / navigation UI |
|---|---|---|---|---|---|
| … | … | … | … | … | … |

Then state explicitly, below the table:

- **What must not count** (toward a score, denominator, or quota).
- **What must not move surfaces** after refresh.
- **What must not leak** to a partner or email.

The table is the contract. If you cannot fill a cell, the behavior is
undecided — resolve it (or ask) before coding, do not let the code decide it.

## 3. List impacted surfaces

Name every surface that renders the affected concept, and what each owns:
Today, Goal detail / history, reflections, partner page, weekly email,
calendar. A domain-state change is rarely confined to one surface — the
recurring bug class here is fixing one surface and leaving another with the
old rule.

## 4. Encode the table as model-level tests, first

Add or extend the **pure model tests** (e.g. `src/lib/today-model.test.ts`,
`src/lib/today-required.test.ts`) so each row of the table is an assertion.
Tests before implementation: the contract must be executable, not prose that
drifts. Helper-only tests are not enough — test the user-visible transitions.

## 5. Implement, then verify no drift

Implement against the now-failing tests. Before opening the PR, confirm the
change did **not** alter scoring (`computeStats`, `classifyWeek`,
`computeTimePattern`), write semantics, or visibility unless that was the
explicit intent.

## 6. PR body and decision records

- Put the **state-transition table** in the PR body so review is against the
  contract, not just the diff.
- If the change set or overturned a product decision, add or update an ADR in
  [decisions/](decisions/).

## On-demand documentation

Do **not** pre-build a full doc system. Add structure when a change forces it:

- Touching a surface whose behavior isn't yet written down → add
  `docs/surfaces/<surface>.md` for that surface as part of the PR.
- Changing a domain concept's meaning (scoring, cadence) → start
  `docs/domain-model.md` with that concept.
- An existing spec becomes confusing → clarify it then.

Write the doc the first time you need it, not speculatively.
