-- What the bookings pages need from the database.

-- Availability for moving a booking: the same times as for a new booking, except that the
-- booking being moved doesn't block its own new time (moving 10:00 to 10:15 must be possible).
-- Recreated rather than overloaded, so there is still exactly one available_slots.
drop function public.available_slots(uuid, date, date, uuid);

create function public.available_slots(
  target_service_id uuid,
  from_date date,
  to_date date,
  target_staff_id uuid default null,
  ignored_booking_id uuid default null
)
returns table (staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
set search_path = ''
as $$
begin
  if to_date < from_date or to_date - from_date >= 31 then
    raise exception 'Ask for at most 31 days at a time' using errcode = '22023';
  end if;
  return query
    select * from private.free_slots(
      target_service_id, from_date, to_date, target_staff_id, now(), ignored_booking_id
    );
end;
$$;

grant execute on function public.available_slots(uuid, date, date, uuid, uuid)
  to authenticated, service_role;

-- A business's bookings on one of its local days (cancelled ones included), in time order. The
-- day's start and end are converted to UTC here, with the business's time zone, so a booking at
-- 23:30 in Cairo lands on the right day whatever the season. Security invoker: it reads under
-- the caller's RLS.
create function public.day_bookings(target_business_id uuid, day date)
returns setof public.bookings
language sql
stable
set search_path = ''
as $$
  select booking.*
  from public.bookings booking
  join public.businesses business on business.id = booking.business_id
  where booking.business_id = target_business_id
    and booking.starts_at >= day::timestamp at time zone business.timezone
    and booking.starts_at < (day + 1)::timestamp at time zone business.timezone
  order by booking.starts_at, booking.created_at;
$$;

grant execute on function public.day_bookings(uuid, date) to authenticated;
