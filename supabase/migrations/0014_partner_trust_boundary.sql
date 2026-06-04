-- PR B SECURITY: make partners the trust boundary at the database layer.
--
-- Two tightenings before opening to outsiders. Both mirror checks the app
-- already enforces in code (isPartner / setGoalShared); this moves them into
-- RLS so a direct Supabase client can't bypass them.
--
-- 1) profiles: was readable by ANY authenticated user (name, avatar, timezone
--    globally visible). Fine for a tiny trusted circle, wrong for a pilot.
--    Now: own profile + accepted partners only. A partnership is an accepted
--    invite in either direction — identical to isPartner()/listPartners().
--    Service-role paths (invite-token lookup, weekly cron) bypass RLS and are
--    unaffected. Every in-app RLS read of another user's profile is a
--    partner's (partner page, partner list, reaction owner/reactors), so this
--    breaks none of them.
--
-- 2) shares insert: previously only checked that you own the goal, so a
--    tampered client could share your own goal with an ARBITRARY user id.
--    Low blast radius (you can only expose your own data), but it violates the
--    contract that sharing is partner-based. Now the viewer must be an
--    accepted partner — the same guard setGoalShared already runs in code.
--
-- The exists() subqueries read partner_invites, whose own SELECT policy lets
-- either side of an invite read rows involving them; in both branches
-- auth.uid() is the inviter or the accepted_by, so every needed row is visible
-- (no nested-RLS dead end). This is the same pattern the weekly_reflections
-- "read own or partner" policy already uses against shares.

-- 1) Profile visibility: own + accepted partner.
drop policy if exists "profiles: read all (authenticated)" on public.profiles;
drop policy if exists "profiles: read own or partner" on public.profiles;
create policy "profiles: read own or partner" on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1 from public.partner_invites pi
      where pi.accepted_at is not null
        and (
          (pi.inviter_id = auth.uid() and pi.accepted_by = profiles.id)
          or (pi.accepted_by = auth.uid() and pi.inviter_id = profiles.id)
        )
    )
  );

-- 2) Share only with an accepted partner (in addition to owning the goal).
drop policy if exists "shares: owner insert" on public.shares;
create policy "shares: owner insert" on public.shares
  for insert to authenticated
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.goals g
      where g.id = shares.goal_id and g.user_id = auth.uid()
    )
    and exists (
      select 1 from public.partner_invites pi
      where pi.accepted_at is not null
        and (
          (pi.inviter_id = auth.uid() and pi.accepted_by = shares.viewer_id)
          or (pi.accepted_by = auth.uid() and pi.inviter_id = shares.viewer_id)
        )
    )
  );
