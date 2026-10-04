begin;
select plan(8);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('owner-b@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Nour Salon', 'nour-salon', 'Africa/Cairo', 'ar');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Cedar Clinic', 'cedar-clinic', 'Asia/Riyadh', 'en');
select tests.act_as_database();

insert into public.business_members (business_id, user_id, role) values
  (tests.business_id('nour-salon'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('nour-salon'), tests.get_user_id('staff-a@test.local'), 'staff');

select results_eq(
  $$
    select booking_notice_minutes, booking_horizon_days, slot_interval_minutes,
      cancellation_notice_hours
    from public.businesses where slug = 'nour-salon'
  $$,
  $$ values (60, 60, 15, 24) $$,
  'a new business starts with sensible rules'
);

select tests.authenticate_as('admin-a@test.local');
update public.businesses
set booking_notice_minutes = 120, booking_horizon_days = 30, slot_interval_minutes = 30,
  cancellation_notice_hours = 12
where slug = 'nour-salon';
select tests.authenticate_as('staff-a@test.local');
update public.businesses set booking_notice_minutes = 0 where slug = 'nour-salon';
select tests.authenticate_as('owner-b@test.local');
update public.businesses set booking_horizon_days = 365 where slug = 'nour-salon';
select tests.act_as_database();
select results_eq(
  $$
    select booking_notice_minutes, booking_horizon_days, slot_interval_minutes,
      cancellation_notice_hours
    from public.businesses where slug = 'nour-salon'
  $$,
  $$ values (120, 30, 30, 12) $$,
  'admins change the rules; staff and other businesses cannot'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ update public.businesses set slot_interval_minutes = 7 where slug = 'nour-salon' $$,
  '23514', null, 'start times come at set intervals'
);
select throws_ok(
  $$ update public.businesses set booking_horizon_days = 0 where slug = 'nour-salon' $$,
  '23514', null, 'customers can always book at least a day ahead'
);
select throws_ok(
  $$ update public.businesses set booking_horizon_days = 366 where slug = 'nour-salon' $$,
  '23514', null, 'nor more than a year ahead'
);
select throws_ok(
  $$ update public.businesses set booking_notice_minutes = -5 where slug = 'nour-salon' $$,
  '23514', null, 'notice cannot be negative'
);
select throws_ok(
  $$ update public.businesses set cancellation_notice_hours = 200 where slug = 'nour-salon' $$,
  '23514', null, 'cancellation notice is at most a week'
);
select tests.authenticate_as('staff-a@test.local');
select results_eq(
  $$ select slot_interval_minutes from public.businesses where slug = 'nour-salon' $$,
  $$ values (30) $$,
  'staff can see the rules'
);

select * from finish();
rollback;
