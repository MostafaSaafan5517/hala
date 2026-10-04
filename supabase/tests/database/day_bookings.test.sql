begin;
select plan(6);
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

insert into public.services (id, business_id, name_en, duration_minutes, buffer_minutes, price, currency)
values ('50000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'Haircut', 45, 15, 25000, 'EGP');
insert into public.staff (id, business_id, name)
values ('51000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'Layla');
insert into public.staff_services (business_id, staff_id, service_id)
values (tests.business_id('nour-salon'), '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001');
insert into public.working_hours (business_id, weekday, opens_at, closes_at)
select tests.business_id('nour-salon'), weekday, '09:00', '17:00'
from generate_series(0, 6) as weekday;
insert into public.customers (business_id, name, phone, language)
values (tests.business_id('nour-salon'), 'Mona Adel', '+201012345678', 'ar');

-- Late on 2 November and just after midnight (Cairo is UTC+2 then, so both are on 2 November in
-- UTC), a cancelled morning booking, and one tomorrow at 10:00 for the availability check.
insert into public.bookings (
  business_id, customer_id, service_id, staff_id, starts_at, ends_at, blocked_until, price,
  currency, status, cancelled_at, notes
)
select tests.business_id('nour-salon'), customer.id, '50000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001', starts, starts + interval '45 minutes',
  starts + interval '60 minutes', 25000, 'EGP', status::public.booking_status,
  case when status = 'cancelled' then now() end, tag
from public.customers customer,
  (values
    ('2026-11-02 23:30+02'::timestamptz, 'confirmed', 'late'),
    ('2026-11-03 00:30+02', 'confirmed', 'after midnight'),
    ('2026-11-02 10:00+02', 'cancelled', 'cancelled'),
    ((((now() at time zone 'Africa/Cairo')::date + 1) + time '10:00') at time zone 'Africa/Cairo',
      'confirmed', 'tomorrow')
  ) as booking(starts, status, tag);

select tests.authenticate_as('staff-a@test.local');
select results_eq(
  $$
    select notes, status::text
    from public.day_bookings(tests.business_id('nour-salon'), '2026-11-02')
  $$,
  $$ values ('cancelled', 'cancelled'), ('late', 'confirmed') $$,
  'a day''s bookings are those starting on that local day, cancelled ones included, in order'
);
select results_eq(
  $$ select notes from public.day_bookings(tests.business_id('nour-salon'), '2026-11-03') $$,
  $$ values ('after midnight') $$,
  'a booking just after local midnight belongs to the next day, though it is the same UTC day'
);

select ok(
  not exists (
    select 1
    from public.available_slots(
      '50000000-0000-0000-0000-000000000001',
      (now() at time zone 'Africa/Cairo')::date + 1,
      (now() at time zone 'Africa/Cairo')::date + 1,
      '51000000-0000-0000-0000-000000000001'
    ) as slot
    where slot.starts_at = (select starts_at from public.bookings where notes = 'tomorrow')
  ),
  'a booked time is not offered'
);
select ok(
  exists (
    select 1
    from public.available_slots(
      '50000000-0000-0000-0000-000000000001',
      (now() at time zone 'Africa/Cairo')::date + 1,
      (now() at time zone 'Africa/Cairo')::date + 1,
      '51000000-0000-0000-0000-000000000001',
      (select id from public.bookings where notes = 'tomorrow')
    ) as slot
    where slot.starts_at = (select starts_at from public.bookings where notes = 'tomorrow')
  ),
  'except to the booking being moved'
);

select tests.authenticate_as('owner-b@test.local');
select is_empty(
  $$ select 1 from public.day_bookings(tests.business_id('nour-salon'), '2026-11-02') $$,
  'other businesses see none of them'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.day_bookings(gen_random_uuid(), '2026-11-02') $$,
  '42501', 'permission denied for function day_bookings',
  'visitors cannot ask'
);

select * from finish();
rollback;
