-- Phase 7 SECURITY: ensure shares.owner_id always matches goals.user_id.
--
-- Previous policy allowed any authenticated user to insert a share row
-- as long as owner_id = auth.uid(). That meant if Alice shared her goal
-- with Bob, Bob could insert his own share row
--   {owner_id: Bob, viewer_id: Charlie, goal_id: <AliceGoal>}
-- and Charlie would then see Alice's goal via the
-- "goals: read own or shared" policy — which only checks that *some*
-- share row exists for that (goal_id, viewer_id), never that the share
-- owner actually owns the goal.
--
-- New policy additionally requires that goal_id belongs to the same
-- user — i.e., you can only share goals you own.

drop policy if exists "shares: owner insert" on public.shares;

create policy "shares: owner insert" on public.shares
  for insert to authenticated
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.goals g
      where g.id = shares.goal_id and g.user_id = auth.uid()
    )
  );

-- One-time cleanup: delete any historical share rows where owner_id
-- and goals.user_id don't agree (the bogus rows the bug could create).
delete from public.shares s
using public.goals g
where s.goal_id = g.id
  and s.owner_id <> g.user_id;
