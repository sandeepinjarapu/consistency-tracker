-- 0013: record when the owner clicked "Add to Google Calendar" for a goal.
-- This is a one-time export marker, NOT calendar sync — we never observe the
-- user's calendar, so this only captures that the action was taken (so the UI
-- can show "Added ✓ · Add again" instead of a permanent "Add" affordance).
alter table public.goals
  add column if not exists calendar_added_at timestamptz;
