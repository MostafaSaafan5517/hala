begin;
select plan(25);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('owner-b@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Nour Salon', 'nour-salon', 'Africa/Cairo', 'ar');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Cedar Clinic', 'cedar-clinic', 'Asia/Riyadh', 'en');
select tests.act_as_database();

insert into public.business_members (business_id, user_id, role)
values (tests.business_id('nour-salon'), tests.get_user_id('staff-a@test.local'), 'staff');

-- Nour Salon: appointments every 15 minutes (the default), at least an hour's notice (default).
-- A haircut takes 45 minutes plus a 15-minute buffer. Its id is fixed so the API checks below
-- can name it while acting as someone who can't see it.
insert into public.services (id, business_id, name_en, duration_minutes, buffer_minutes, price, currency)
values
  ('30000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'Haircut', 45, 15, 25000, 'EGP'),
  (gen_random_uuid(), tests.business_id('nour-salon'), 'Old service', 30, 0, 10000, 'EGP');
update public.services set active = false where name_en = 'Old service';

insert into public.staff (business_id, name) values
  (tests.business_id('nour-salon'), 'Layla'),
  (tests.business_id('nour-salon'), 'Omar'),
  (tests.business_id('nour-salon'), 'Sara'),
  (tests.business_id('nour-salon'), 'Hana');
update public.staff set active = false where name = 'Hana';
-- Sara doesn't do haircuts.
insert into public.staff_services (business_id, staff_id, service_id)
select staff.business_id, staff.id, service.id
from public.staff staff
join public.services service on service.business_id = staff.business_id
where (staff.name in ('Layla', 'Omar', 'Hana') and service.name_en = 'Haircut')
  or (staff.name = 'Layla' and service.name_en = 'Old service');

-- The business's hours: Sunday to Thursday 09:00-13:00 and 14:00-17:00, closed on Friday,
-- and on Saturday 09:10-11:00 and late 22:00-24:00 (to check the grid and midnight).
insert into public.working_hours (business_id, weekday, opens_at, closes_at)
select tests.business_id('nour-salon'), weekday, span.opens_at, span.closes_at
from generate_series(0, 4) as weekday,
  (values ('09:00'::time, '13:00'::time), ('14:00', '17:00')) as span(opens_at, closes_at)
union all
select tests.business_id('nour-salon'), 6, span.opens_at, span.closes_at
from (values ('09:10'::time, '11:00'::time), ('22:00', '24:00')) as span(opens_at, closes_at);
-- Omar works his own hours: Monday 12:00-14:00, and a night shift 00:00-02:00 on Friday.
insert into public.working_hours (business_id, staff_id, weekday, opens_at, closes_at)
select tests.business_id('nour-salon'), staff.id, span.weekday, span.opens_at, span.closes_at
from public.staff staff,
  (values (1, '12:00'::time, '14:00'::time), (5, '00:00', '02:00')) as span(weekday, opens_at, closes_at)
where staff.name = 'Omar';

-- "Now" is Sunday 25 October 2026, 08:00 in Cairo (UTC+3 until the night of 29 October).

-- One staff member's start times on one local day, as local "HH:MM".
create function pg_temp.starts(
  staff_name text,
  day date,
  now_at timestamptz default '2026-10-25 08:00+03',
  ignored_booking_id uuid default null,
  service_name text default 'Haircut'
)
returns text[]
language sql
as $$
  select coalesce(
    array_agg(to_char(slot.starts_at at time zone 'Africa/Cairo', 'HH24:MI') order by slot.starts_at),
    '{}'
  )
  from private.free_slots(
    (select id from public.services where name_en = service_name), day, day,
    (select id from public.staff where name = staff_name), now_at, ignored_booking_id
  ) as slot;
$$;

-- The grid --------------------------------------------------------------------------------------

select is(
  pg_temp.starts('Layla', '2026-10-26'),
  '{09:00,09:15,09:30,09:45,10:00,10:15,10:30,10:45,11:00,11:15,11:30,11:45,12:00,12:15,14:00,14:15,14:30,14:45,15:00,15:15,15:30,15:45,16:00,16:15}',
  'every 15 minutes, as long as the appointment ends by closing, around the lunch break'
);
select is(
  pg_temp.starts('Layla', '2026-10-31'),
  '{09:15,09:30,09:45,10:00,10:15,22:00,22:15,22:30,22:45,23:00,23:15}',
  'start times stay on the clock''s grid when opening is off it, and a day can end at midnight'
);
select is(
  pg_temp.starts('Layla', '2026-10-30'),
  '{}',
  'nothing on a day the business is closed every week'
);
select is(
  (select array_agg(slot.ends_at - slot.starts_at)
   from private.free_slots(
     (select id from public.services where name_en = 'Haircut'), '2026-10-26', '2026-10-26',
     (select id from public.staff where name = 'Layla'), '2026-10-25 08:00+03'
   ) as slot
   where slot.starts_at = '2026-10-26 09:00+03'),
  array[interval '45 minutes'],
  'a slot lasts as long as the appointment (the buffer only keeps the time after it free)'
);

-- Daylight saving ---------------------------------------------------------------------------------

select is(
  (select min(slot.starts_at)
   from private.free_slots(
     (select id from public.services where name_en = 'Haircut'), '2026-10-29', '2026-10-29',
     null, '2026-10-25 08:00+03'
   ) as slot),
  '2026-10-29 06:00Z'::timestamptz,
  'on the last day of summer time, 09:00 in Cairo is 06:00 UTC'
);
select is(
  (select min(slot.starts_at)
   from private.free_slots(
     (select id from public.services where name_en = 'Haircut'), '2026-11-01', '2026-11-01',
     null, '2026-10-25 08:00+03'
   ) as slot),
  '2026-11-01 07:00Z'::timestamptz,
  'and after the clocks go back it is 07:00 UTC'
);
-- Cairo's clocks jump from 00:00 to 01:00 on Friday 24 April 2026, so Omar's 00:00-02:00 shift
-- lasts one real hour that night: room for two 45-minute appointments, each offered once.
select is(
  pg_temp.starts('Omar', '2026-04-24', '2026-04-20 08:00+02'),
  '{01:00,01:15}',
  'on the night clocks go forward, only real times are offered, each once'
);

-- Notice and horizon ----------------------------------------------------------------------------

select is(
  (pg_temp.starts('Layla', '2026-10-25', '2026-10-25 09:20+03'))[1],
  '10:30',
  'the first start is at least an hour from now, on the grid'
);
select is(
  (select min((slot.starts_at at time zone 'Africa/Cairo')::date)
   from private.free_slots(
     (select id from public.services where name_en = 'Haircut'), '2026-10-01', '2026-10-31',
     (select id from public.staff where name = 'Layla'), '2026-10-25 08:00+03'
   ) as slot),
  '2026-10-25'::date,
  'past days are never offered'
);
update public.businesses set booking_horizon_days = 7 where slug = 'nour-salon';
select is(
  (select max((slot.starts_at at time zone 'Africa/Cairo')::date)
   from private.free_slots(
     (select id from public.services where name_en = 'Haircut'), '2026-10-25', '2026-11-20',
     (select id from public.staff where name = 'Layla'), '2026-10-25 08:00+03'
   ) as slot),
  '2026-11-01'::date,
  'nor days beyond the booking horizon'
);
update public.businesses set booking_horizon_days = 60 where slug = 'nour-salon';

-- Closures, time off and bookings --------------------------------------------------------------

insert into public.closures (business_id, starts_on, ends_on)
values (tests.business_id('nour-salon'), '2026-10-27', '2026-10-28');
select is(
  pg_temp.starts('Layla', '2026-10-27') || pg_temp.starts('Layla', '2026-10-28'),
  '{}',
  'nothing while the business is closed, first and last day included'
);

-- Layla is away 10:00-11:00 on Monday, booked 14:00-14:45 (busy until 15:00 with the buffer),
-- and had a 09:00 booking that was cancelled.
insert into public.time_off (business_id, staff_id, starts_at, ends_at)
select business_id, id, '2026-10-26 10:00+03', '2026-10-26 11:00+03'
from public.staff where name = 'Layla';
insert into public.customers (business_id, name, phone, language)
values (tests.business_id('nour-salon'), 'Mona Adel', '+201012345678', 'ar');
insert into public.bookings (
  business_id, customer_id, service_id, staff_id, starts_at, ends_at, blocked_until, price,
  currency, status, cancelled_at
)
select staff.business_id, customer.id, service.id, staff.id, starts, starts + interval '45 minutes',
  starts + interval '60 minutes', 25000, 'EGP', status::public.booking_status,
  case when status = 'cancelled' then now() end
from public.staff staff, public.customers customer, public.services service,
  (values ('2026-10-26 14:00+03'::timestamptz, 'confirmed'), ('2026-10-26 09:00+03', 'cancelled'))
    as booking(starts, status)
where staff.name = 'Layla' and service.name_en = 'Haircut';

select is(
  pg_temp.starts('Layla', '2026-10-26'),
  '{09:00,11:00,11:15,11:30,11:45,12:00,12:15,15:00,15:15,15:30,15:45,16:00,16:15}',
  'time off and confirmed bookings (with both buffers) are kept free; cancelled ones are not'
);
select is(
  pg_temp.starts(
    'Layla', '2026-10-26', ignored_booking_id => (
      select id from public.bookings where status = 'confirmed'
    )
  ),
  '{09:00,11:00,11:15,11:30,11:45,12:00,12:15,14:00,14:15,14:30,14:45,15:00,15:15,15:30,15:45,16:00,16:15}',
  'a booking being moved does not block its own new time'
);

-- Who can be booked ------------------------------------------------------------------------------

select is(
  pg_temp.starts('Omar', '2026-10-26'),
  '{12:00,12:15,12:30,12:45,13:00,13:15}',
  'staff with their own hours work those, even when the business is closed for lunch'
);
select is(
  pg_temp.starts('Omar', '2026-10-25'),
  '{}',
  'and nothing else, even when the business is open'
);
select is(pg_temp.starts('Sara', '2026-10-26'), '{}', 'only staff who perform the service');
select is(pg_temp.starts('Hana', '2026-10-26'), '{}', 'only active staff');
select is(
  pg_temp.starts('Layla', '2026-10-26', service_name => 'Old service'),
  '{}',
  'only active services'
);
select results_eq(
  $$
    select staff.name, count(*)::int
    from private.free_slots(
      (select id from public.services where name_en = 'Haircut'), '2026-10-26', '2026-10-26',
      null, '2026-10-25 08:00+03'
    ) as slot
    join public.staff staff on staff.id = slot.staff_id
    group by staff.name
    order by staff.name
  $$,
  $$ values ('Layla', 13), ('Omar', 6) $$,
  'without a staff member, everyone who performs the service'
);

-- The API -----------------------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select isnt_empty(
  $$
    select * from public.available_slots(
      '30000000-0000-0000-0000-000000000001', current_date, current_date + 7
    )
  $$,
  'members see their business''s availability, from now'
);
select is_empty(
  $$
    select * from public.available_slots(
      '30000000-0000-0000-0000-000000000001', current_date - 30, current_date - 1
    )
  $$,
  'and never in the past'
);
select throws_ok(
  $$
    select * from public.available_slots(
      '30000000-0000-0000-0000-000000000001', current_date, current_date + 31
    )
  $$,
  '22023', 'Ask for at most 31 days at a time',
  'a request covers at most 31 days'
);
select tests.authenticate_as('owner-b@test.local');
select is_empty(
  $$
    select * from public.available_slots(
      '30000000-0000-0000-0000-000000000001', current_date, current_date + 7
    )
  $$,
  'other businesses see nothing'
);
select tests.authenticate_as_service_role();
select isnt_empty(
  $$
    select * from public.available_slots(
      '30000000-0000-0000-0000-000000000001', current_date, current_date + 7
    )
  $$,
  'server code can check availability'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select * from public.available_slots(gen_random_uuid(), current_date, current_date) $$,
  '42501', 'permission denied for function available_slots',
  'visitors cannot'
);

select * from finish();
rollback;
