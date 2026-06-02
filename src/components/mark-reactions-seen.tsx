"use client";

import { useEffect } from "react";
import { markGoalReactionsSeen } from "@/lib/actions/reactions";

/**
 * Fires once on mount to mark reactions on this goal as seen by the owner.
 * Visiting your own goal detail = acknowledgement; clears the nav badge.
 */
export default function MarkReactionsSeen({ goalId }: { goalId: string }) {
  useEffect(() => {
    markGoalReactionsSeen(goalId).catch(() => {
      /* best-effort */
    });
  }, [goalId]);
  return null;
}
