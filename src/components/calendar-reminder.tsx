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
    // Stacked so it never wraps mid-phrase in the narrow connections column:
    // "Reminder 8:00pm" on top, the action (or the added state) below it.
    <span className="flex flex-col gap-0.5">
      <span>Reminder {reminderLabel}</span>
      {added ? (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden>✓ Added</span>
          <span aria-hidden>·</span>
          <a
            href={gcalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleAdd}
            className="underline hover:text-black"
          >
            Add again
          </a>
        </span>
      ) : (
        <a
          href={gcalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleAdd}
          className="w-max underline hover:text-black"
        >
          Add to calendar ↗
        </a>
      )}
    </span>
  );
}
