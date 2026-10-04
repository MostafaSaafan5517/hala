-- Availability: the times a service can be booked, per staff member. One SQL function computes
-- it, and both the slot pickers and the booking functions use it, so what customers are offered
-- and what the booking check accepts can never disagree.
--
-- A start time is offered when:
--   - it's on the business's grid (every slot_interval_minutes, counted from local midnight, so
--     09:00, 09:15, ...), on a day that isn't a closure, between today and the booking horizon;
--   - the appointment fits inside one of the staff member's working spans that day (their own
--     hours if they have any, otherwise the business's). The buffer after it may run past
--     closing: tidying up after the last client is normal;
--   - the appointment and its buffer don't overlap the staff member's time off or confirmed
--     bookings (whose own buffers count too);
--   - it's at least booking_notice_minutes from now.
--
-- Times are generated as local wall-clock times and converted to UTC with the business's time
-- zone day by day, so each day uses that day's offset: a business opening at 09:00 in Cairo opens
-- at 06:00 UTC in summer and 07:00 UTC in winter.

-- The clock is a parameter (now_at), so tests can pin "now" and check fixed dates (daylight
-- saving days, say) forever. ignored_booking_id leaves one booking out, so a booking being moved
-- doesn't block its own new time. Security invoker: it reads under the caller's RLS.
create function private.free_slots(
  target_service_id uuid,
  from_date date,
  to_date date,
  target_staff_id uuid,
  now_at timestamptz,
  ignored_booking_id uuid default null
)
returns table (staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
set search_path = ''
as $$
  with settings as (
    select service.id as service_id, service.business_id, service.duration_minutes,
      service.buffer_minutes, business.timezone, business.booking_notice_minutes,
      business.slot_interval_minutes,
      (now_at at time zone business.timezone)::date as today,
      (now_at at time zone business.timezone)::date + business.booking_horizon_days as last_day
    from public.services service
    join public.businesses business on business.id = service.business_id
    where service.id = target_service_id and service.active
  ),
  performers as (
    select staff.id,
      exists (select 1 from public.working_hours own where own.staff_id = staff.id)
        as has_own_hours
    from settings
    join public.staff_services link on link.service_id = settings.service_id
    join public.staff staff on staff.id = link.staff_id
    where staff.active and (target_staff_id is null or staff.id = target_staff_id)
  ),
  days as (
    select day::date as day
    from settings,
      generate_series(
        greatest(from_date, settings.today), least(to_date, settings.last_day), interval '1 day'
      ) as day
    where not exists (
      select 1 from public.closures closure
      where closure.business_id = settings.business_id
        and day::date between closure.starts_on and closure.ends_on
    )
  ),
  spans as (
    select performers.id as staff_id, days.day, hours.opens_at, hours.closes_at
    from performers
    cross join days
    cross join settings
    join public.working_hours hours
      on hours.business_id = settings.business_id
      and hours.weekday = extract(dow from days.day)
      and hours.staff_id is not distinct from
        (case when performers.has_own_hours then performers.id end)
  ),
  candidates as (
    select spans.staff_id,
      (spans.day + make_interval(mins => minute)) at time zone settings.timezone as starts_at,
      (spans.day + spans.opens_at) at time zone settings.timezone as span_starts_at,
      (spans.day + spans.closes_at) at time zone settings.timezone as span_ends_at
    from spans
    cross join settings
    cross join generate_series(
      -- The first grid time at or after opening, up to the last start that still fits.
      ceil(extract(epoch from spans.opens_at) / 60 / settings.slot_interval_minutes)::integer
        * settings.slot_interval_minutes,
      (extract(epoch from spans.closes_at) / 60)::integer - settings.duration_minutes,
      settings.slot_interval_minutes
    ) as minute
  )
  -- distinct: on the night clocks go forward, a time that doesn't exist locally converts to the
  -- same moment as the one after it.
  select distinct candidate.staff_id, candidate.starts_at,
    candidate.starts_at + make_interval(mins => settings.duration_minutes)
  from candidates candidate
  cross join settings
  where candidate.starts_at >= candidate.span_starts_at
    and candidate.starts_at + make_interval(mins => settings.duration_minutes)
      <= candidate.span_ends_at
    and candidate.starts_at >= now_at + make_interval(mins => settings.booking_notice_minutes)
    and not exists (
      select 1 from public.time_off away
      where away.staff_id = candidate.staff_id
        and tstzrange(away.starts_at, away.ends_at) && tstzrange(
          candidate.starts_at,
          candidate.starts_at
            + make_interval(mins => settings.duration_minutes + settings.buffer_minutes)
        )
    )
    and not exists (
      select 1 from public.bookings booking
      where booking.staff_id = candidate.staff_id
        and booking.status = 'confirmed'
        and booking.id is distinct from ignored_booking_id
        and tstzrange(booking.starts_at, booking.blocked_until) && tstzrange(
          candidate.starts_at,
          candidate.starts_at
            + make_interval(mins => settings.duration_minutes + settings.buffer_minutes)
        )
    )
  order by candidate.starts_at, candidate.staff_id;
$$;

-- The times a service can be booked between two of the business's local dates (inclusive), for
-- one staff member or, when target_staff_id is left out, everyone who performs it. Security
-- invoker: members see their own business's availability, and nobody else's.
create function public.available_slots(
  target_service_id uuid,
  from_date date,
  to_date date,
  target_staff_id uuid default null
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
    select * from private.free_slots(target_service_id, from_date, to_date, target_staff_id, now());
end;
$$;

-- Server code (the assistant's tools) checks availability through the same functions.
grant usage on schema private to service_role;
grant execute on function private.free_slots(uuid, date, date, uuid, timestamptz, uuid)
  to authenticated, service_role;
grant execute on function public.available_slots(uuid, date, date, uuid)
  to authenticated, service_role;
