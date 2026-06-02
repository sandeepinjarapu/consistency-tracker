-- =====================================================================
-- Consistency Tracker schema
-- Run this whole file in Supabase: Dashboard -> SQL Editor -> New query
-- =====================================================================

-- -----------------------------
-- Extensions
-- -----------------------------
create extension if not exists "pgcrypto";

-- =====================================================================
-- TABLES
-- =====================================================================

-- profiles: one row per signed-in user, auto-created on signup via trigger
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

-- categories: user-defined grouping (Health, Projects, etc.)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#22c55e',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists categories_user_id_idx on public.categories(user_id);

-- goals: a habit being tracked
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  -- "Why this matters" — optional motivation/meaning, added 0010
  motivation text,
  doc_url text,
  -- target_days: 0=Sun, 1=Mon, ..., 6=Sat. Default = every day.
  target_days smallint[] not null default array[0,1,2,3,4,5,6],
  -- Optional reminder time (HH:MM:SS, user's local timezone) — added 0003
  reminder_time time,
  -- Optional weekly-count cadence — added 0007. null = specific-day goal
  -- (scored against target_days). When set, target_days is the eligible
  -- window and the goal is "do it weekly_target times this week".
  weekly_target smallint check (weekly_target is null or (weekly_target between 1 and 7)),
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  -- weekly_target must fit within the eligible window — added 0008
  constraint goals_weekly_target_within_window check (
    weekly_target is null
    or weekly_target <= coalesce(array_length(target_days, 1), 0)
  )
);
create index if not exists goals_user_id_idx on public.goals(user_id);
create index if not exists goals_active_idx on public.goals(user_id, active);

-- check_ins: one row per (goal, date) that was done or skipped.
-- Absence of a row on a target day in the past = missed.
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  status text not null check (status in ('done','skipped')),
  skip_reason text check (skip_reason in ('travel','illness','mood','other')),
  -- Optional <=100 char comment — added 0003
  note text,
  created_at timestamptz not null default now(),
  unique (goal_id, date),
  constraint check_ins_note_length check (note is null or char_length(note) <= 100)
);
create index if not exists check_ins_user_date_idx on public.check_ins(user_id, date);
create index if not exists check_ins_goal_date_idx on public.check_ins(goal_id, date);

-- shares: per-goal read-only share with another user
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  -- When the viewer last "saw" this share (used by the in-app badge) — added 0004
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, viewer_id, goal_id),
  check (owner_id <> viewer_id)
);
create index if not exists shares_viewer_idx on public.shares(viewer_id);
create index if not exists shares_owner_idx on public.shares(owner_id);

-- partner_invites: pre-signup email invites with a token
create table if not exists public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);
create index if not exists invites_inviter_idx on public.partner_invites(inviter_id);
create index if not exists invites_email_idx on public.partner_invites(lower(invitee_email));
create index if not exists invites_accepted_by_idx on public.partner_invites(accepted_by);

-- weekly_reflections: one entry per (user, ISO-week)
create table if not exists public.weekly_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null, -- Monday of the ISO week
  continue_text text,
  stop_text text,
  improve_text text,
  notes text,
  visibility text not null default 'private' check (visibility in ('private','partner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);
create index if not exists reflections_user_idx on public.weekly_reflections(user_id, week_start_date desc);

-- reactions: gentle "Saw it" / "Proud" from a viewer on a shared goal — added 0011
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  reactor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('saw','proud')),
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (goal_id, reactor_id, kind),
  check (owner_id <> reactor_id)
);
create index if not exists reactions_owner_unseen_idx
  on public.reactions(owner_id) where seen_at is null;
create index if not exists reactions_reactor_idx on public.reactions(reactor_id);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Auto-create profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper for weekly_reflections
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists weekly_reflections_touch_updated_at on public.weekly_reflections;
create trigger weekly_reflections_touch_updated_at
  before update on public.weekly_reflections
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.goals               enable row level security;
alter table public.check_ins           enable row level security;
alter table public.shares              enable row level security;
alter table public.partner_invites     enable row level security;
alter table public.weekly_reflections  enable row level security;
alter table public.reactions           enable row level security;

-- profiles: any authenticated user can read any profile (just name + avatar).
-- Users can only modify their own row.
drop policy if exists "profiles: read all (authenticated)" on public.profiles;
create policy "profiles: read all (authenticated)" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- categories: full CRUD on own rows only
drop policy if exists "categories: all own" on public.categories;
create policy "categories: all own" on public.categories
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- goals: own + read if shared with you
drop policy if exists "goals: read own or shared" on public.goals;
create policy "goals: read own or shared" on public.goals
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shares s
      where s.goal_id = goals.id and s.viewer_id = auth.uid()
    )
  );

drop policy if exists "goals: insert own" on public.goals;
create policy "goals: insert own" on public.goals
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "goals: update own" on public.goals;
create policy "goals: update own" on public.goals
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals: delete own" on public.goals;
create policy "goals: delete own" on public.goals
  for delete to authenticated using (auth.uid() = user_id);

-- check_ins: own + read if the goal is shared with you
drop policy if exists "check_ins: read own or shared" on public.check_ins;
create policy "check_ins: read own or shared" on public.check_ins
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shares s
      where s.goal_id = check_ins.goal_id and s.viewer_id = auth.uid()
    )
  );

-- Tightened in migration 0005: user_id must also match goal.user_id,
-- so a partner viewing your shared goal can't insert a check-in for it.
drop policy if exists "check_ins: write own" on public.check_ins;
drop policy if exists "check_ins: write own goal" on public.check_ins;
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

-- shares: owner manages, viewer can read what's shared with them
drop policy if exists "shares: read mine (owner or viewer)" on public.shares;
create policy "shares: read mine (owner or viewer)" on public.shares
  for select to authenticated
  using (auth.uid() = owner_id or auth.uid() = viewer_id);

-- Tightened in migration 0006: goal_id must belong to the share owner,
-- so a partner viewing your shared goal can't re-share it to a third user.
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

drop policy if exists "shares: owner delete" on public.shares;
create policy "shares: owner delete" on public.shares
  for delete to authenticated using (auth.uid() = owner_id);

-- partner_invites: inviter and accepted_by can both read their own rows.
-- Token-based acceptance happens server-side via the service role key.
-- (Widened from inviter-only in migration 0002 — needed for the "who
-- invited me" lookup on the partner's side.)
drop policy if exists "invites: inviter read" on public.partner_invites;
drop policy if exists "invites: read involved" on public.partner_invites;
create policy "invites: read involved" on public.partner_invites
  for select to authenticated
  using (auth.uid() = inviter_id or auth.uid() = accepted_by);

drop policy if exists "invites: inviter insert" on public.partner_invites;
create policy "invites: inviter insert" on public.partner_invites
  for insert to authenticated with check (auth.uid() = inviter_id);

drop policy if exists "invites: inviter delete" on public.partner_invites;
create policy "invites: inviter delete" on public.partner_invites
  for delete to authenticated using (auth.uid() = inviter_id);

-- weekly_reflections: own + read if visibility='partner' and you share at least one goal with the owner
drop policy if exists "reflections: read own or partner" on public.weekly_reflections;
create policy "reflections: read own or partner" on public.weekly_reflections
  for select to authenticated
  using (
    auth.uid() = user_id
    or (
      visibility = 'partner'
      and exists (
        select 1 from public.shares s
        where s.owner_id = weekly_reflections.user_id
          and s.viewer_id = auth.uid()
      )
    )
  );

drop policy if exists "reflections: write own" on public.weekly_reflections;
create policy "reflections: write own" on public.weekly_reflections
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- reactions: owner + reactor can read; reactor inserts only on goals shared
-- with them; reactor deletes own; owner updates (to mark seen). See 0011.
drop policy if exists "reactions: read involved" on public.reactions;
create policy "reactions: read involved" on public.reactions
  for select to authenticated
  using (auth.uid() = owner_id or auth.uid() = reactor_id);

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

drop policy if exists "reactions: reactor delete" on public.reactions;
create policy "reactions: reactor delete" on public.reactions
  for delete to authenticated using (auth.uid() = reactor_id);

drop policy if exists "reactions: owner mark seen" on public.reactions;
create policy "reactions: owner mark seen" on public.reactions
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
