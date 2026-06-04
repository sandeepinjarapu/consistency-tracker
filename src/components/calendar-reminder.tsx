"use client";

import { useState, useTransition } from "react";
import { markCalendarAdded } from "@/lib/actions/goals";

/**
 * Shows a goal's reminder time alongside a one-time "Add to Google Calendar"
 * export link. Once the owner has added it, the affordance becomes a calm
 * "Added ✓ · Add again" state so it doesn't read like an unfinished task.
 *
 * Honest by design: we record that the user *clicked*, not that the event is
 * still on their calendar — there's no calendar sync, hence "Add again".
 */
export default function CalendarReminder({
  goalId,
  gcalUrl,
  reminderLabel,
  addedAt,
}: {
  goalId: string;
  gcalUrl: string;
  reminderLabel: string;
  addedAt: string | null;
}) {
  const [added, setAdded] = useState(Boolean(addedAt));
  const [, startTransition] = useTransition();

  function handleAdd() {
    setAdded(true);
    startTransition(async () => {
      try {
        await markCalendarAdded(goalId);
      } catch {
        // The link still opened the calendar; only the marker failed to save.
        // Leave the optimistic "Added" state — re-adding is harmless.
      }
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      <span>{added ? `Added ${reminderLabel} to your calendar ✓` : `Reminder ${reminderLabel}`}</span>
      <span aria-hidden>·</span>
      <a
        href={gcalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleAdd}
        className="underline hover:text-black"
      >
        {added ? "Add again" : "Add to Google Calendar ↗"}
      </a>
    </span>
  );
}
