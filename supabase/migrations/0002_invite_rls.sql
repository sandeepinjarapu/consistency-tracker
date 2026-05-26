-- Phase 4 migration: allow accepted_by to read their own accepted invites.
-- Run this once in Supabase SQL Editor.

drop policy if exists "invites: inviter read" on public.partner_invites;
drop policy if exists "invites: read involved" on public.partner_invites;

create policy "invites: read involved" on public.partner_invites
  for select to authenticated
  using (auth.uid() = inviter_id or auth.uid() = accepted_by);
