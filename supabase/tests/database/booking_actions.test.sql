begin;
select plan(36);
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

-- Nour Salon is open every day 09:00-17:00. The rules are the defaults: an hour's notice, 60 days
-- ahead, every 15 minutes, and customers can cancel up to 24 hours before. Ids are fixed so tests
-- can name rows while acting as someone who can't see them.
insert into public.services (id, business_id, name_en, duration_minutes, buffer_minutes, price, currency, active)
values
  ('40000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'Haircut', 45, 15, 25000, 'EGP', true),
  ('40000000-0000-0000-0000-000000000002', tests.business_id('nour-salon'), 'Old service', 30, 0, 10000, 'EGP', false);
insert into public.staff (id, business_id, name) values
  ('41000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'Layla'),
  ('41000000-0000-0000-0000-000000000002', tests.business_id('nour-salon'), 'Omar'),
  ('41000000-0000-0000-0000-000000000003', tests.business_id('nour-salon'), 'Sara');
-- Sara doesn't do haircuts.
insert into public.staff_services (business_id, staff_id, service_id)
select staff.business_id, staff.id, '40000000-0000-0000-0000-000000000001'
from public.staff staff where staff.name in ('Layla', 'Omar');
insert into public.staff_services (business_id, staff_id, service_id)
select staff.business_id, staff.id, '40000000-0000-0000-0000-000000000002'
from public.staff staff where staff.name = 'Layla';
insert into public.working_hours (business_id, weekday, opens_at, closes_at)
select tests.business_id('nour-salon'), weekday, '09:00', '17:00'
from generate_series(0, 6) as weekday;

-- A moment `days` from today at a local time in Cairo. These functions run against the real
-- clock, so the tests use days relative to today.
create function pg_temp.local_at(days integer, local_time time)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone 'Africa/Cairo')::date + days) + local_time)
    at time zone 'Africa/Cairo';
$$;

-- Books a haircut for Mona, tagging the booking (in its notes) so later tests can find it.
create function pg_temp.book(
  tag text,
  starts timestamptz,
  idempotency_key text,
  staff_id uuid default null,
  customer_name text default 'Mona Adel'
)
returns public.bookings
language sql
as $$
  select * from public.book_appointment(
    '40000000-0000-0000-0000-000000000001', starts, customer_name, '+201012345678',
    idempotency_key, staff_id, booking_notes => tag
  );
$$;

create function pg_temp.booking_id(tag text)
returns uuid
language sql
stable
as $$
  select id from public.bookings where notes = tag;
$$;

create function pg_temp.move(
  tag text,
  starts timestamptz,
  idempotency_key text,
  staff_id uuid default null
)
returns public.bookings
language sql
as $$
  select * from public.reschedule_booking(pg_temp.booking_id(tag), starts, idempotency_key, staff_id);
$$;

create function pg_temp.cancel(tag text, idempotency_key text)
returns public.bookings
language sql
as $$
  select * from public.cancel_booking(pg_temp.booking_id(tag), idempotency_key);
$$;

grant execute on function pg_temp.local_at(integer, time) to anon, authenticated, service_role;
grant execute on function pg_temp.book(text, timestamptz, text, uuid, text)
  to anon, authenticated, service_role;
grant execute on function pg_temp.booking_id(text) to authenticated, service_role;
grant execute on function pg_temp.move(text, timestamptz, text, uuid) to authenticated, service_role;
grant execute on function pg_temp.cancel(text, text) to authenticated, service_role;

-- Booking ----------------------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select results_eq(
  $$
    select staff_id, status::text, ends_at - starts_at, blocked_until - ends_at, price, currency
    from pg_temp.book(
      'first', pg_temp.local_at(1, '10:00'), 'book-first-key-0001',
      '41000000-0000-0000-0000-000000000001'
    )
  $$,
  $$
    values (
      '41000000-0000-0000-0000-000000000001'::uuid, 'confirmed', interval '45 minutes',
      interval '15 minutes', 25000, 'EGP'
    )
  $$,
  'staff book an appointment: it lasts the service''s duration, keeps the buffer, and its price'
);
select results_eq(
  $$ select name, phone, language::text from public.customers $$,
  $$ values ('Mona Adel', '+201012345678', 'ar') $$,
  'a new customer is created, speaking the business''s language unless told otherwise'
);
select is(
  (pg_temp.book(
    'first', pg_temp.local_at(1, '10:00'), 'book-first-key-0001',
    '41000000-0000-0000-0000-000000000001'
  )).id,
  pg_temp.booking_id('first'),
  'retrying with the same idempotency key returns the same booking'
);
select is(
  (select count(*)::int from public.bookings), 1,
  'without booking twice'
);
select throws_ok(
  $$
    select pg_temp.book(
      'first', pg_temp.local_at(1, '10:15'), 'book-first-key-0001',
      '41000000-0000-0000-0000-000000000001'
    )
  $$,
  'HB006', 'This request was already made with different details',
  'a key cannot be reused for a different request'
);
select throws_ok(
  $$
    select pg_temp.book(
      'clash', pg_temp.local_at(1, '10:00'), 'book-clash-key-0001',
      '41000000-0000-0000-0000-000000000001'
    )
  $$,
  'HB001', 'That time is already booked',
  'nobody else can book that staff member then'
);
select is(
  (pg_temp.book('any', pg_temp.local_at(1, '10:00'), 'book-any-key-00001')).staff_id,
  '41000000-0000-0000-0000-000000000002'::uuid,
  'without a staff member, the first one free is booked'
);
select throws_ok(
  $$ select pg_temp.book('any-2', pg_temp.local_at(1, '10:00'), 'book-any-key-00002') $$,
  'HB001', 'That time is already booked',
  'and when everyone is busy, the time is taken'
);

select pg_temp.book(
  'second', pg_temp.local_at(1, '15:00'), 'book-second-key-001',
  '41000000-0000-0000-0000-000000000001', customer_name => 'Mona A.'
);
select results_eq(
  $$ select name from public.customers $$,
  $$ values ('Mona Adel') $$,
  'a returning customer is found by phone number; booking doesn''t rename them'
);

-- Refusals --------------------------------------------------------------------------------------

select throws_ok(
  $$
    select pg_temp.book(
      'late', pg_temp.local_at(1, '20:00'), 'book-late-key-00001',
      '41000000-0000-0000-0000-000000000001'
    )
  $$,
  'HB002', 'That time isn''t available',
  'not outside working hours'
);
select throws_ok(
  $$
    select pg_temp.book(
      'odd', pg_temp.local_at(1, '16:05'), 'book-odd-key-000001',
      '41000000-0000-0000-0000-000000000001'
    )
  $$,
  'HB002', 'That time isn''t available',
  'not off the 15-minute grid'
);
select throws_ok(
  $$ select pg_temp.book('soon', now() + interval '30 minutes', 'book-soon-key-00001') $$,
  'HB003', 'That''s too soon to book',
  'not inside the notice period'
);
select throws_ok(
  $$ select pg_temp.book('past', now() - interval '1 day', 'book-past-key-00001') $$,
  'HB003', 'That''s too soon to book',
  'not in the past'
);
select throws_ok(
  $$ select pg_temp.book('far', pg_temp.local_at(61, '10:00'), 'book-far-key-000001') $$,
  'HB004', 'That''s too far ahead to book',
  'not beyond the booking horizon'
);
select throws_ok(
  $$
    select pg_temp.book(
      'sara', pg_temp.local_at(1, '14:00'), 'book-sara-key-00001',
      '41000000-0000-0000-0000-000000000003'
    )
  $$,
  'HB005', 'That staff member doesn''t offer this service',
  'not with someone who doesn''t offer the service'
);
select throws_ok(
  $$
    select public.book_appointment(
      '40000000-0000-0000-0000-000000000002', pg_temp.local_at(1, '14:00'), 'Mona Adel',
      '+201012345678', 'book-old-key-000001'
    )
  $$,
  'HB005', 'That service can''t be booked',
  'not an archived service'
);
select throws_ok(
  $$ select pg_temp.book('short', pg_temp.local_at(1, '14:00'), 'short') $$,
  '22023', 'An idempotency key of 16 to 100 characters is required',
  'every request needs an idempotency key'
);

select tests.authenticate_as('owner-b@test.local');
select throws_ok(
  $$ select pg_temp.book('spy', pg_temp.local_at(1, '14:00'), 'book-spy-key-000001') $$,
  '42501', 'Only members of this business can manage its bookings',
  'other businesses cannot book here'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select pg_temp.book('anon', pg_temp.local_at(1, '14:00'), 'book-anon-key-00001') $$,
  '42501', 'permission denied for function book_appointment',
  'visitors cannot book directly (the assistant books for them, as server code)'
);

select tests.act_as_database();
update public.services set price = 30000 where name_en = 'Haircut';
select tests.authenticate_as('staff-a@test.local');
select is(
  (select price from public.bookings where id = pg_temp.booking_id('first')),
  25000,
  'a booking keeps the price it was booked at'
);

-- Moving -----------------------------------------------------------------------------------------

select is(
  (pg_temp.move('first', pg_temp.local_at(1, '11:00'), 'move-first-key-0001')).starts_at,
  pg_temp.local_at(1, '11:00'),
  'staff move a booking to another free time'
);
select lives_ok(
  $$ select pg_temp.move('first', pg_temp.local_at(1, '11:15'), 'move-first-key-0002') $$,
  'including into time the booking itself is holding'
);
select throws_ok(
  $$
    select pg_temp.move(
      'first', pg_temp.local_at(1, '10:00'), 'move-first-key-0003',
      '41000000-0000-0000-0000-000000000002'
    )
  $$,
  'HB001', 'That time is already booked',
  'but not onto someone else''s booking'
);
select is(
  (pg_temp.move('first', pg_temp.local_at(1, '11:00'), 'move-first-key-0001')).starts_at,
  pg_temp.local_at(1, '11:15'),
  'retrying a move returns the booking as it is, without moving it again'
);
select throws_ok(
  $$
    select pg_temp.move(
      'first', pg_temp.local_at(1, '14:00'), 'move-first-key-0004',
      '41000000-0000-0000-0000-000000000003'
    )
  $$,
  'HB005', 'That staff member doesn''t offer this service',
  'nor to someone who doesn''t offer the service'
);

-- Cancelling -------------------------------------------------------------------------------------

select results_eq(
  $$ select status::text, cancelled_at is not null from pg_temp.cancel('first', 'cancel-first-key-01') $$,
  $$ values ('cancelled', true) $$,
  'staff cancel a booking'
);
select lives_ok(
  $$
    select pg_temp.book(
      'third', pg_temp.local_at(1, '11:15'), 'book-third-key-0001',
      '41000000-0000-0000-0000-000000000001'
    )
  $$,
  'which frees its time'
);
select is(
  (pg_temp.cancel('first', 'cancel-first-key-01')).status::text,
  'cancelled',
  'retrying a cancellation returns the booking without an error'
);
select throws_ok(
  $$ select pg_temp.cancel('first', 'cancel-first-key-02') $$,
  'HB008', 'That booking can''t be changed',
  'a cancelled booking cannot be cancelled again'
);
select throws_ok(
  $$ select pg_temp.move('first', pg_temp.local_at(1, '14:00'), 'move-first-key-0005') $$,
  'HB008', 'That booking can''t be changed',
  'or moved'
);

-- Customers' rules ------------------------------------------------------------------------------

-- Customers (through the assistant, which is server code) can cancel or move up to 48 hours
-- before; the business's staff always can.
select tests.act_as_database();
update public.businesses set cancellation_notice_hours = 48 where slug = 'nour-salon';
select tests.authenticate_as_service_role();
select lives_ok(
  $$ select pg_temp.book('assistant', pg_temp.local_at(1, '14:00'), 'book-assistant-key-01') $$,
  'server code books for customers'
);
select throws_ok(
  $$ select pg_temp.cancel('assistant', 'cancel-assistant-key-1') $$,
  'HB007', 'It''s too late to cancel or move this booking',
  'customers cannot cancel inside the cancellation window'
);
select throws_ok(
  $$ select pg_temp.move('assistant', pg_temp.local_at(5, '10:00'), 'move-assistant-key-01') $$,
  'HB007', 'It''s too late to cancel or move this booking',
  'or move the booking'
);
select pg_temp.book('later', pg_temp.local_at(5, '10:00'), 'book-later-key-0001');
select lives_ok(
  $$ select pg_temp.cancel('later', 'cancel-later-key-001') $$,
  'but can before it'
);
select tests.authenticate_as('staff-a@test.local');
select lives_ok(
  $$ select pg_temp.cancel('assistant', 'cancel-assistant-key-2') $$,
  'the business''s staff can still cancel inside the window'
);

select tests.act_as_database();
select results_eq(
  $$
    select action, actor from public.audit_log
    where table_name = 'bookings' and record_id = pg_temp.booking_id('assistant')
    order by id
  $$,
  $$ values ('insert', 'server'), ('update', 'user') $$,
  'the audit log records who booked and who cancelled'
);

select * from finish();
rollback;
