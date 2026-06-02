-- Gentle partner reactions: a viewer can leave a lightweight "Saw it" / "Proud"
-- on a goal that's been shared with them. Owner sees them on the goal detail
-- page; seen_at null = unseen (drives the partners nav badge).
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,   -- goal owner
  reactor_id uuid not null references auth.users(id) on delete cascade, -- partner reacting
  kind text not null check (kind in ('saw','proud')),
  seen_at timestamptz, -- when the owner saw it; null = unseen
  created_at timestamptz not null default now(),
  unique (goal_id, reactor_id, kind), -- one of each kind per reactor per goal (toggle)
  check (owner_id <> reactor_id)
);
create index if not exists reactions_owner_unseen_idx
  on public.reactions(owner_id) where seen_at is null;
create index if not exists reactions_reactor_idx on public.reactions(reactor_id);

alter table public.reactions enable row level security;

-- Read: the goal owner and the reactor can each see the reaction.
drop policy if exists "reactions: read involved" on public.reactions;
create policy "reactions: read involved" on public.reactions
  for select to authenticated
  using (auth.uid() = owner_id or auth.uid() = reactor_id);

-- Insert: you may only react as yourself, only to a goal that is actually
-- shared with you, and owner_id must be that goal's real owner.
drop policy if exists "reactions: reactor insert" on public.reactions;
create policy "reactions: reactor insert" on public.reactions
  for insert to authenticated
  with check (
    auth.uid() = reactor_id
    and exists (
      select 1 from public.goals g
      where g.id = reactions.goal_id and g.user_id = reactions.owner_id
    )
    and exists (
      select 1 from public.shares s
      where s.goal_id = reactions.goal_id
        and s.owner_id = reactions.owner_id
        and s.viewer_id = auth.uid()
    )
  );

-- Delete: a reactor can remove their own reaction (un-react / toggle off).
drop policy if exists "reactions: reactor delete" on public.reactions;
create policy "reactions: reactor delete" on public.reactions
  for delete to authenticated using (auth.uid() = reactor_id);

-- Update: only the owner, to mark their reactions seen.
drop policy if exists "reactions: owner mark seen" on public.reactions;
create policy "reactions: owner mark seen" on public.reactions
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
