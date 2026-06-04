/**
 * Tap-target sizing convention — NOT a design system, just the 44px floor
 * (iOS HIG / Material) so interactive controls stay thumb-friendly and the
 * sizing doesn't drift per surface. Compose with each control's own styling:
 *
 *   className={`${tapTarget} text-xs border rounded-full px-3 …`}
 */

/** Text / pill buttons: enforce a 44px height, center the contents. */
export const tapTarget =
  "min-h-[44px] inline-flex items-center justify-center";

/** Square controls (overflow ⋯, steppers): 44px in both directions. */
export const tapTargetIcon =
  "min-h-[44px] min-w-[44px] inline-flex items-center justify-center";

/** Menu / list rows (skip reasons, overflow items): full-width 44px rows. */
export const tapTargetRow = "min-h-[44px] flex items-center";
