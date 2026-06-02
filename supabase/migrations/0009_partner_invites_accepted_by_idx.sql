-- listPartners() and isPartner() resolve accepted partnerships by filtering
-- partner_invites on accepted_by (= the current user, or a candidate partner).
-- The other invite lookups already have inviter_id / lower(invitee_email)
-- indexes; accepted_by had none. Negligible at current scale, but it's the
-- one common read without index coverage.
-- Run this once in Supabase SQL Editor.

create index if not exists invites_accepted_by_idx on public.partner_invites(accepted_by);
