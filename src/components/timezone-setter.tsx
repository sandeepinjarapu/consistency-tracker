"use client";

import { useEffect } from "react";
import { saveTimezone } from "@/lib/profile";

/**
 * Detects the browser's IANA timezone and persists it on the user's profile.
 * Rendered once in the tracker layout; runs once per mount.
 */
export default function TimezoneSetter({ current }: { current: string }) {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) {
      saveTimezone(tz).catch(() => {
        /* no-op — best-effort */
      });
    }
  }, [current]);

  return null;
}
