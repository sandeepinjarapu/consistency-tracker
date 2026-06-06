-- Allow partners to read each other's categories so that the partner detail
-- page can resolve the category name/color on a shared goal via the FK join.
-- The existing "categories: all own" policy covers full CRUD on own rows.
drop policy if exists "categories: read partner" on public.categories;
create policy "categories: read partner" on public.categories
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.partner_invites pi
      where pi.accepted_at is not null
        and (
          (pi.inviter_id = auth.uid() and pi.accepted_by = categories.user_id)
          or (pi.accepted_by = auth.uid() and pi.inviter_id = categories.user_id)
        )
    )
  );
