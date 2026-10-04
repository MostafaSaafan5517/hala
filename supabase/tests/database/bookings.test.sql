begin;
select plan(19);
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

-- Fixtures, written as the database (bookings have no API write path). A haircut takes 45
-- minutes plus a 15-minute buffer, so it blocks its staff member for an hour.
insert into public.services (business_id, name_en, duration_minutes, buffer_minutes, price, currency)
values (tests.business_id('nour-salon'), 'Haircut', 45, 15, 25000, 'EGP');
insert into public.staff (business_id, name) values
  (tests.business_id('nour-salon'), 'Layla'),
  (tests.business_id('nour-salon'), 'Omar'),
  (tests.business_id('cedar-clinic'), 'Dr. Hani');
insert into public.customers (business_id, name, phone, language) values
  (tests.business_id('nour-salon'), 'Mona Adel', '+201012345678', 'ar');

-- Books the haircut with a staff member at a UTC time, returning the booking's id.
create function pg_temp.book(staff_name text, starts timestamptz, business_slug text default 'nour-salon')
returns uuid
language sql
as $$
  insert into public.bookings (
    business_id, customer_id, service_id, staff_id, starts_at, ends_at, blocked_until, price,
    currency
  )
  select tests.business_id(business_slug), customer.id, service.id, staff.id, starts,
    starts + interval '45 minutes', starts + interval '60 minutes', 25000, 'EGP'
  from public.customers customer, public.services service, public.staff staff
  where customer.name = 'Mona Adel' and service.name_en = 'Haircut' and staff.name = staff_name
  returning id;
$$;
grant execute on function pg_temp.book(text, timestamptz, text) to authenticated, service_role;

-- No double bookings --------------------------------------------------------------------------

select lives_ok(
  $$ select pg_temp.book('Layla', '2026-11-02 08:00Z') $$,
  'a staff member can be booked'
);
select throws_ok(
  $$ select pg_temp.book('Layla', '2026-11-02 08:30Z') $$,
  '23P01', null, 'but not again while that booking is on'
);
select throws_ok(
  $$ select pg_temp.book('Layla', '2026-11-02 07:30Z') $$,
  '23P01', null, 'nor by a booking that would run into it'
);
select throws_ok(
  $$ select pg_temp.book('Layla', '2026-11-02 08:50Z') $$,
  '23P01', null, 'and the buffer after an appointment is kept free too'
);
select lives_ok(
  $$ select pg_temp.book('Layla', '2026-11-02 09:00Z') $$,
  'the next booking can start as soon as the buffer ends'
);
select lives_ok(
  $$ select pg_temp.book('Layla', '2026-11-02 07:00Z') $$,
  'or end exactly when the first starts'
);
select lives_ok(
  $$ select pg_temp.book('Omar', '2026-11-02 08:00Z') $$,
  'another staff member can be booked at the same time'
);

update public.bookings set status = 'cancelled', cancelled_at = now()
where starts_at = '2026-11-02 08:00Z'
  and staff_id = (select id from public.staff where name = 'Layla');
select lives_ok(
  $$ select pg_temp.book('Layla', '2026-11-02 08:00Z') $$,
  'cancelling a booking frees its time'
);
select throws_ok(
  $$
    update public.bookings set status = 'confirmed', cancelled_at = null
    where status = 'cancelled'
  $$,
  '23P01', null, 'so a cancelled booking cannot come back over a newer one'
);

-- Shape ---------------------------------------------------------------------------------------

select throws_ok(
  $$
    update public.bookings set status = 'cancelled'
    where starts_at = '2026-11-02 09:00Z'
  $$,
  '23514', null, 'a cancelled booking records when it was cancelled'
);
select throws_ok(
  $$ select pg_temp.book('Dr. Hani', '2026-11-03 08:00Z') $$,
  '23503', null, 'a booking cannot use another business''s staff member'
);
select is_empty(
  $$
    select reference from public.bookings where reference !~ '^[2-9A-HJ-NP-Z]{6}$'
    union all
    select reference from public.bookings group by reference having count(*) > 1
  $$,
  'every booking gets its own six-character reference'
);

-- Who can see and write them ------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select is(
  (select count(*)::int from public.bookings),
  5,
  'staff see their business''s bookings'
);
select tests.authenticate_as('owner-b@test.local');
select is_empty($$ select 1 from public.bookings $$, 'other businesses do not');
select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.bookings $$,
  '42501', 'permission denied for table bookings',
  'visitors cannot read bookings'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ select pg_temp.book('Omar', '2026-11-04 08:00Z') $$,
  '42501', 'permission denied for table bookings',
  'owners cannot write bookings directly; the booking functions apply the rules'
);
select tests.authenticate_as_service_role();
select throws_ok(
  $$ select pg_temp.book('Omar', '2026-11-04 08:00Z') $$,
  '42501', 'permission denied for table bookings',
  'neither can server code'
);
select is(
  (select count(*)::int from public.bookings),
  5,
  'though it can read them'
);

select tests.act_as_database();
delete from public.businesses where slug = 'nour-salon';
select is_empty(
  $$ select 1 from public.bookings $$,
  'deleting a business deletes its bookings'
);

select * from finish();
rollback;
