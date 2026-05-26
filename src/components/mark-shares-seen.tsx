"use client";

import { useEffect } from "react";
import { markSharesSeen } from "@/lib/actions/partners";

/**
 * Fires once on mount to mark all of this owner's shares as seen by the
 * current viewer. Visiting the partner page = acknowledgement.
 */
export default function MarkSharesSeen({ ownerId }: { ownerId: string }) {
  useEffect(() => {
    markSharesSeen(ownerId).catch(() => {
      /* best-effort */
    });
  }, [ownerId]);
  return null;
}
