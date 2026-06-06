-- Progressive calendar unlock flag on the user profile.
-- Set to true the first time the user meets the "earned calendar" criteria
-- (3+ active goals, or any single goal with 8+ done check-ins over 3+ ISO weeks).
-- Once true it stays true as long as the user has active goals; the app never
-- writes it back to false.
alter table profiles
  add column if not exists calendar_unlocked boolean not null default false;
