# Agent guide

Routing instructions for any coding agent (Claude, Codex, or otherwise)
working in this repo.

## Before you code: classify the change

A change is **domain-state** if it affects what the app believes happened,
what the user is asked to do, what counts toward a score, or what another
person sees. Examples:

- check-ins, and `done` / `skipped` / extra
- requiredness, weekly quota, over-quota
- night-owl / logical-day behavior
- skip / undo / note flows
- reflections and partner visibility
- partner-facing output and email summaries
- calendar / history interpretation
- goal status and goals-list rings
- any future pause / vacation / longer-cadence feature

**If the change is domain-state, read [docs/change-protocol.md](docs/change-protocol.md) before writing code.**

Low-risk changes skip the protocol: copy, spacing, icons, loading skeletons,
isolated non-state UI polish, and docs cleanup. Make the focused change.

## Decisions

Durable product decisions live in [docs/decisions/](docs/decisions/). Read the
relevant one before changing behavior it governs; add a new one when a change
sets or overturns a decision.
