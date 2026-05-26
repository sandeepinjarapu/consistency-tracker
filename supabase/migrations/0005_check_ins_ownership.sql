-- Phase 7 SECURITY: ensure check_ins.user_id always matches goals.user_id.
--
-- Previous policy allowed any authenticated user to insert a check_in
-- as long as user_id = auth.uid(). That meant a partner viewing your
-- shared goal could create a check-in (with their user_id, your goal_id),
-- and your heatmap would show it because the heatmap queries by goal_id.
--
-- New policy additionally requires that the goal_id belongs to the same
-- user — i.e., you can only check in on your own goals.

drop policy if exists "check_ins: write own" on public.check_ins;

create policy "check_ins: write own goal" on public.check_ins
  for all to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.goals g
      where g.id = check_ins.goal_id and g.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.goals g
      where g.id = check_ins.goal_id and g.user_id = auth.uid()
    )
  );

-- One-time cleanup: delete any historical check_ins where user_id and
-- goal.user_id don't agree (this is the bogus data created during the bug).
delete from public.check_ins ci
using public.goals g
where ci.goal_id = g.id
  and ci.user_id <> g.user_id;
