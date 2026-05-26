-- Phase 6 migration: track when each share has been notified to the viewer.
-- Run this once in Supabase SQL Editor.

alter table public.shares
  add column if not exists notified_at timestamptz;

-- Mark all existing shares as already-notified so we don't retroactively
-- spam users about shares that happened before this feature went live.
update public.shares
  set notified_at = now()
  where notified_at is null;
