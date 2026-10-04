-- Booking, moving and cancelling appointments. These three functions are the only way to write a
-- booking (the API roles, server code included, have no write access to the table). Each one
-- runs in a single transaction and:
--   1. checks who is asking: a member of the business (staff working in the dashboard) or server
--      code, which acts for customers (the assistant's tools);
--   2. claims an idempotency key, so a retried or duplicated request returns the first result
--      instead of acting twice;
--   3. applies the business's rules, using the same availability function the slot pickers use;
--   4. writes, leaving the final word on double bookings to the exclusion constraint.
--
-- Refusals have their own error codes, so callers (the dashboard, the assistant) can explain them
-- in the customer's language. Class HB is ours ("Hala booking"):
--   HB001  that time is already booked          HB005  that service or staff member can't be booked
--   HB002  that time isn't open for booking     HB006  idempotency key reused for another request
--   HB003  too soon (inside the notice period)  HB007  too late for a customer to cancel or move
--   HB004  too far ahead (past the horizon)     HB008  that booking can't be changed any more

-- Idempotency keys, with the request each was first used for. Private: only these functions
-- read or write it. Keys are kept, so a replay months later still can't act twice.
create table private.idempotency_keys (
  business_id uuid not null references public.businesses (id) on delete cascade,
  key text not null,
  -- The action and its arguments, to refuse a key reused for a different request.
  request jsonb not null,
  -- The booking the request created or changed.
  booking_id uuid references public.bookings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_id, key)
);

alter table private.idempotency_keys enable row level security;

-- Who is asking: true for server code (acting for a customer), false for a member of the business
-- (owner, admin or staff); anyone else is refused. Server code is told apart by its API role,
-- which comes from the signed key, so a signed-in user can't claim it.
create function private.acting_for_customer(target_business_id uuid)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return true;
  end if;
  if private.has_business_role(target_business_id, '{owner,admin,staff}') then
    return false;
  end if;
  raise exception 'Only members of this business can manage its bookings' using errcode = '42501';
end;
$$;

-- Claims an idempotency key for a request. Returns null when the request is new (the caller acts,
-- then records its booking on the key), or the booking an identical earlier request produced (the
-- caller returns it without acting again). If an identical request is running right now, the
-- insert waits for it to finish, so two copies of a request never both act.
create function private.claim_idempotency_key(
  target_business_id uuid,
  idempotency_key text,
  request jsonb,
  target_booking_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  earlier private.idempotency_keys;
begin
  if idempotency_key is null or char_length(idempotency_key) not between 16 and 100 then
    raise exception 'An idempotency key of 16 to 100 characters is required'
      using errcode = '22023';
  end if;

  insert into private.idempotency_keys (business_id, key, request, booking_id)
  values (target_business_id, idempotency_key, request, target_booking_id)
  on conflict do nothing;
  if found then
    return null;
  end if;

  select * into earlier
  from private.idempotency_keys
  where business_id = target_business_id and key = idempotency_key;
  if earlier.request is distinct from request then
    raise exception 'This request was already made with different details' using errcode = 'HB006';
  end if;
  return earlier.booking_id;
end;
$$;

-- Refuses a start time outside the booking window: past or inside the notice period (HB003), or
-- beyond the horizon (HB004).
create function private.check_booking_window(target_business_id uuid, requested_start timestamptz)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  business public.businesses;
begin
  select * into business from public.businesses where id = target_business_id;
  if requested_start < now() + make_interval(mins => business.booking_notice_minutes) then
    raise exception 'That''s too soon to book' using errcode = 'HB003';
  end if;
  if (requested_start at time zone business.timezone)::date
      > (now() at time zone business.timezone)::date + business.booking_horizon_days then
    raise exception 'That''s too far ahead to book' using errcode = 'HB004';
  end if;
end;
$$;

-- Says why a start time inside the booking window can't be booked: the staff member doesn't
-- offer the service (HB005), someone is already booked then (HB001), or it isn't open (HB002).
create function private.raise_unavailable(
  target_service_id uuid,
  requested_start timestamptz,
  target_staff_id uuid,
  ignored_booking_id uuid default null
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  service public.services;
begin
  select * into service from public.services where id = target_service_id;
  if target_staff_id is not null and not exists (
    select 1
    from public.staff_services link
    join public.staff staff on staff.id = link.staff_id
    where link.service_id = target_service_id and staff.id = target_staff_id and staff.active
  ) then
    raise exception 'That staff member doesn''t offer this service' using errcode = 'HB005';
  end if;
  if exists (
    select 1
    from public.bookings booking
    join public.staff_services link
      on link.staff_id = booking.staff_id and link.service_id = target_service_id
    where booking.status = 'confirmed'
      and booking.id is distinct from ignored_booking_id
      and (target_staff_id is null or booking.staff_id = target_staff_id)
      and tstzrange(booking.starts_at, booking.blocked_until) && tstzrange(
        requested_start,
        requested_start
          + make_interval(mins => service.duration_minutes + service.buffer_minutes)
      )
  ) then
    raise exception 'That time is already booked' using errcode = 'HB001';
  end if;
  raise exception 'That time isn''t available' using errcode = 'HB002';
end;
$$;

-- Books a service at a start time, with a given staff member or (target_staff_id left out) the
-- first one free, in a fixed order. The customer is found by phone number in the business, or
-- created; an existing customer's details aren't changed by booking. Returns the booking.
create function public.book_appointment(
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

-- Moves a confirmed, upcoming booking to a new start time, with the same staff member or
-- another one. The booking keeps its id, reference and price; its length comes from the service
-- as it is now, like any other slot. Customers can't move it inside the cancellation window.
create function public.reschedule_booking(
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

-- Cancels a confirmed, upcoming booking, which frees its time. Customers can't cancel inside the
-- cancellation window; the business's own staff always can.
create function public.cancel_booking(target_booking_id uuid, idempotency_key text)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings;
  business public.businesses;
  for_customer boolean;
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
    jsonb_build_object('action', 'cancel', 'booking_id', target_booking_id),
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

  update public.bookings
  set status = 'cancelled', cancelled_at = now()
  where id = booking.id
  returning * into booking;
  return booking;
end;
$$;

grant execute on function public.book_appointment(
  uuid, timestamptz, text, text, text, uuid, text, public.language, text
) to authenticated, service_role;
grant execute on function public.reschedule_booking(uuid, timestamptz, text, uuid)
  to authenticated, service_role;
grant execute on function public.cancel_booking(uuid, text) to authenticated, service_role;
