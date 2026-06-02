-- "Why this matters": optional motivation/meaning captured per goal, used to
-- give later weekly reflection emotional context. Distinct from description
-- (the "what"). Nullable; length is capped in the app form like description.
alter table public.goals add column if not exists motivation text;
