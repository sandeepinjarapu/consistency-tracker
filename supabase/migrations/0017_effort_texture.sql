-- Effort texture (roadmap item 19): an optional, owner-private signal on a
-- *done* check-in for how fully the owner showed up — 'flow' (it clicked) or
-- 'light' (showed up, but below their own bar). Recognition, not a grade.
--
-- Deliberately NOT scored: a done with 'light' counts identically to a done
-- with null toward completion/streak/rings. The thing that must never count
-- ("marked done but did nothing") is still a skip. Owner-private: never
-- selected on the partner page or in the weekly email (those queries select
-- explicit columns, so this column cannot ride along).
--
-- Nullable; blank is the normal state for most done days. Skips never carry
-- it. Historical rows stay null — never backfilled, never inferred from notes.

alter table public.check_ins
  add column if not exists effort_texture text;

-- Constraint: only the two allowed values, or null.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_effort_texture_values'
  ) then
    alter table public.check_ins
      add constraint check_ins_effort_texture_values
      check (effort_texture is null or effort_texture in ('flow', 'light'));
  end if;
end $$;
