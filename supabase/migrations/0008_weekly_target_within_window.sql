-- Phase 6 follow-up: the weekly count must fit within the eligible window
-- (weekly_target <= number of target_days). Mirrors the app-side validation
-- in src/lib/actions/goals.ts at the database layer.
-- Run this once in Supabase SQL Editor.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'goals_weekly_target_within_window'
  ) then
    alter table public.goals
      add constraint goals_weekly_target_within_window
      check (
        weekly_target is null
        or weekly_target <= coalesce(array_length(target_days, 1), 0)
      );
  end if;
end $$;
