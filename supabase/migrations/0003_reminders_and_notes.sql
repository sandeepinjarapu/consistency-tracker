-- Phase 5 migration: per-goal reminder time + per-check-in notes.
-- Run this once in Supabase SQL Editor.

alter table public.goals
  add column if not exists reminder_time time;

alter table public.check_ins
  add column if not exists note text;

-- Constraint: note must be 100 chars or less
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_note_length'
  ) then
    alter table public.check_ins
      add constraint check_ins_note_length check (note is null or char_length(note) <= 100);
  end if;
end $$;
