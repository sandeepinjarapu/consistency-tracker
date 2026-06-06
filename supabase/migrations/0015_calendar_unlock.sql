-- Progressive calendar unlock flag on the user profile.
-- Set to true the first time the user has 3+ active goals.
-- Once true it stays true as long as the user has active goals; the app never
-- writes it back to false.
alter table profiles
  add column if not exists calendar_unlocked boolean not null default false;
