-- Move reactions from once-per-goal to once-per-goal-per-ISO-week, so a partner
-- can say "proud of your week" and each week is a fresh slate. Existing rows are
-- bucketed to their created_at week. Postgres date_trunc('week') is Monday-based,
-- matching the app's isoWeekStart.
alter table public.reactions add column if not exists week_start_date date;

update public.reactions
  set week_start_date = date_trunc('week', created_at)::date
  where week_start_date is null;

alter table public.reactions alter column week_start_date set not null;

-- Swap the uniqueness key to include the week.
alter table public.reactions
  drop constraint if exists reactions_goal_id_reactor_id_kind_key;
alter table public.reactions
  add constraint reactions_goal_reactor_kind_week_key
  unique (goal_id, reactor_id, kind, week_start_date);
