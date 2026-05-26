/**
 * Build a Google Calendar "create event" URL that pre-fills a recurring
 * reminder for a goal. The user clicks once, GCal opens with everything
 * filled, they hit Save. No Google API integration needed.
 */

const GCAL_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Returns YYYYMMDDTHHMMSS format expected by Google Calendar TEMPLATE URL. */
function fmt(date: Date, hh: number, mm: number): string {
  const yyyy = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hour = String(hh).padStart(2, "0");
  const min = String(mm).padStart(2, "0");
  return `${yyyy}${mo}${dd}T${hour}${min}00`;
}

/** Find the next date (today or later, server-local) that matches one of targetDays. */
function nextOccurrence(targetDays: number[]): Date {
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    if (targetDays.includes(d.getDay())) return d;
  }
  return now;
}

export function buildGCalUrl({
  name,
  description,
  reminderTime,
  targetDays,
  timezone,
}: {
  name: string;
  description: string | null;
  reminderTime: string; // "HH:MM" or "HH:MM:SS"
  targetDays: number[];
  timezone: string;
}): string {
  const [hh, mm] = reminderTime.split(":").map(Number);
  const start = nextOccurrence(targetDays);
  const endMinutesTotal = hh * 60 + mm + 15;
  const endHh = Math.floor(endMinutesTotal / 60) % 24;
  const endMm = endMinutesTotal % 60;

  const dates = `${fmt(start, hh, mm)}/${fmt(start, endHh, endMm)}`;

  const rrule =
    targetDays.length === 7
      ? "RRULE:FREQ=DAILY"
      : `RRULE:FREQ=WEEKLY;BYDAY=${targetDays
          .map((d) => GCAL_DAYS[d])
          .join(",")}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: name,
    details: description ?? "Reminder from Consistency Tracker — sixthsense.works",
    dates,
    recur: rrule,
    ctz: timezone,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
