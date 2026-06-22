import type { EffortTexture } from "@/lib/actions/check-ins";

/**
 * Toggle semantics for the effort chip on a done check-in (roadmap item 19):
 * tapping the active texture clears it, tapping the other replaces it. Pure so
 * the Today card's transitions are testable without the optimistic/server
 * plumbing. This is the done-row half of the item-19 state table.
 */
export function nextEffort(
  current: EffortTexture | null,
  tapped: EffortTexture
): EffortTexture | null {
  return current === tapped ? null : tapped;
}
