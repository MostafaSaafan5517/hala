-- Simultaneous requests for one staff member's time now queue instead of racing.
--
-- The exclusion constraint checks a new booking against the others after writing it, so two
-- requests writing overlapping bookings at the same instant can each find the other's
-- uncommitted row and wait for it. Postgres breaks that deadlock by cancelling one of them with
-- a deadlock error (40P01) instead of the "already booked" refusal (HB001) callers expect: CI
-- saw it in a burst of twenty requests for one slot. So the booking functions first take a
-- transaction lock on the staff member's schedule. The next request for that staff member
-- waits for the first to commit or roll back, then writes and is refused by the constraint as
-- usual. The constraint stays what guarantees no double bookings; the lock only puts requests
-- in line. Requests for different staff members don't wait for each other, and a request takes
-- one staff member's lock at a time (an attempt refused by the constraint gives its lock back),
-- so the locks can't deadlock either.

create or replace function public.book_appointment(
  target_service_id uuid,
  requested_start timestamptz,
  customer_name text,
  customer_phone text,
  idempotency_key text,
  target_staff_id uuid default null,
  customer_email text default null,
  customer_language public.language default null,
  booking_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  service public.services;
  business public.businesses;
  earlier_booking_id uuid;
  booking_customer_id uuid;
  candidate record;
  booked public.bookings;
begin
  select * into service from public.services where id = target_service_id;
  if not found then
    raise exception 'That service can''t be booked' using errcode = 'HB005';
  end if;
  perform private.acting_for_customer(service.business_id);
  if not service.active then
    raise exception 'That service can''t be booked' using errcode = 'HB005';
  end if;
  select * into business from public.businesses where id = service.business_id;

  earlier_booking_id := private.claim_idempotency_key(
    business.id,
    idempotency_key,
    jsonb_build_object(
      'action', 'book', 'service_id', target_service_id, 'starts_at', requested_start,
      'staff_id', target_staff_id, 'customer_name', customer_name,
      'customer_phone', customer_phone, 'customer_email', customer_email,
      'customer_language', customer_language, 'notes', booking_notes
    )
  );
  if earlier_booking_id is not null then
    select * into booked from public.bookings where id = earlier_booking_id;
    return booked;
  end if;

  perform private.check_booking_window(business.id, requested_start);

  insert into public.customers (business_id, name, phone, email, language)
  values (
    business.id, btrim(customer_name), customer_phone, nullif(btrim(customer_email), ''),
    coalesce(customer_language, business.default_language)
  )
  on conflict (business_id, phone) do nothing
  returning id into booking_customer_id;
  if booking_customer_id is null then
    select id into booking_customer_id
    from public.customers
    where business_id = business.id and phone = customer_phone;
  end if;

  for candidate in
    select slot.staff_id
    from private.free_slots(
      service.id,
      (requested_start at time zone business.timezone)::date,
      (requested_start at time zone business.timezone)::date,
      target_staff_id,
      now()
    ) as slot
    join public.staff staff on staff.id = slot.staff_id
    where slot.starts_at = requested_start
    order by staff.created_at, staff.id
  loop
    begin
      -- Wait for any other request writing this staff member's bookings (see the top).
      perform pg_advisory_xact_lock(hashtextextended(candidate.staff_id::text, 0));
      insert into public.bookings (
        business_id, customer_id, service_id, staff_id, starts_at, ends_at, blocked_until,
        price, currency, notes
      )
      values (
        business.id, booking_customer_id, service.id, candidate.staff_id, requested_start,
        requested_start + make_interval(mins => service.duration_minutes),
        requested_start
          + make_interval(mins => service.duration_minutes + service.buffer_minutes),
        service.price, service.currency, nullif(btrim(booking_notes), '')
      )
      returning * into booked;
      exit;
    exception when exclusion_violation then
      -- Another request booked this staff member's time a moment ago: try the next one.
    end;
  end loop;

  if booked.id is null then
    perform private.raise_unavailable(service.id, requested_start, target_staff_id);
  end if;

  update private.idempotency_keys
  set booking_id = booked.id
  where business_id = business.id and key = idempotency_key;
  return booked;
end;
$$;

create or replace function public.reschedule_booking(
  target_booking_id uuid,
  new_start timestamptz,
  idempotency_key text,
  target_staff_id uuid default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings;
  business public.businesses;
  service public.services;
  for_customer boolean;
  new_staff_id uuid;
begin
  select * into booking from public.bookings where id = target_booking_id for update;
  if not found then
    raise exception 'That booking can''t be changed' using errcode = 'HB008';
  end if;
  for_customer := private.acting_for_customer(booking.business_id);
  select * into business from public.businesses where id = booking.business_id;

  if private.claim_idempotency_key(
    business.id,
    idempotency_key,
    jsonb_build_object(
      'action', 'reschedule', 'booking_id', target_booking_id, 'starts_at', new_start,
      'staff_id', target_staff_id
    ),
    target_booking_id
  ) is not null then
    return booking;
  end if;

  if booking.status <> 'confirmed' or booking.starts_at <= now() then
    raise exception 'That booking can''t be changed' using errcode = 'HB008';
  end if;
  if for_customer and booking.starts_at
      < now() + make_interval(hours => business.cancellation_notice_hours) then
    raise exception 'It''s too late to cancel or move this booking' using errcode = 'HB007';
  end if;
  perform private.check_booking_window(business.id, new_start);

  select * into service from public.services where id = booking.service_id and active;
  if not found then
    raise exception 'That service can''t be booked' using errcode = 'HB005';
  end if;
  new_staff_id := coalesce(target_staff_id, booking.staff_id);
  if not exists (
    select 1
    from private.free_slots(
      service.id,
      (new_start at time zone business.timezone)::date,
      (new_start at time zone business.timezone)::date,
      new_staff_id,
      now(),
      booking.id
    ) as slot
    where slot.starts_at = new_start
  ) then
    perform private.raise_unavailable(service.id, new_start, new_staff_id, booking.id);
  end if;

  begin
    -- Wait for any other request writing this staff member's bookings (see the top).
    perform pg_advisory_xact_lock(hashtextextended(new_staff_id::text, 0));
    update public.bookings
    set staff_id = new_staff_id,
      starts_at = new_start,
      ends_at = new_start + make_interval(mins => service.duration_minutes),
      blocked_until = new_start
        + make_interval(mins => service.duration_minutes + service.buffer_minutes)
    where id = booking.id
    returning * into booking;
  exception when exclusion_violation then
    raise exception 'That time is already booked' using errcode = 'HB001';
  end;
  return booking;
end;
$$;
