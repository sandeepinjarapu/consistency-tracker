-- Phase 6 migration: optional weekly-count cadence for goals.
-- weekly_target null  = specific-day goal (scored against target_days).
-- weekly_target set   = "N times per week" goal; target_days is the
--                       eligible window (which days count toward the quota).
-- Run this once in Supabase SQL Editor.

alter table public.goals
  add column if not exists weekly_target smallint;

-- Constraint: when set, must be between 1 and 7
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'goals_weekly_target_range'
  ) then
    alter table public.goals
      add constraint goals_weekly_target_range
      check (weekly_target is null or (weekly_target between 1 and 7));
  end if;
end $$;
