-- Each business's booking rules: availability and the assistant's tools enforce them on the
-- server, whatever a customer asks for.

alter table public.businesses
  -- How long before an appointment it can still be booked.
  add column booking_notice_minutes integer not null default 60
    check (booking_notice_minutes between 0 and 10080),
  -- How far ahead appointments can be booked.
  add column booking_horizon_days integer not null default 60
    check (booking_horizon_days between 1 and 365),
  -- How often appointments can start (every 15 minutes: 09:00, 09:15, ...).
  add column slot_interval_minutes integer not null default 15
    check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  -- How late a booking can still be cancelled or moved by the customer.
  add column cancellation_notice_hours integer not null default 24
    check (cancellation_notice_hours between 0 and 168);

-- Owners and admins already edit their business through the update policy; these columns join
-- the ones they may change.
grant update (
  booking_notice_minutes, booking_horizon_days, slot_interval_minutes, cancellation_notice_hours
) on public.businesses to authenticated;
