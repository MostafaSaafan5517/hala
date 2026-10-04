begin;
select plan(15);
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
insert into public.staff (id, business_id, name) values
  ('30000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'Layla'),
  ('30000000-0000-0000-0000-000000000002', tests.business_id('cedar-clinic'), 'Dr. Sami');

-- Setting hours ----------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select lives_ok(
  $$
    select public.set_working_hours(
      tests.business_id('nour-salon'),
      '[{"weekday": 0, "opens_at": "10:00", "closes_at": "14:00"},
        {"weekday": 0, "opens_at": "16:00", "closes_at": "21:00"},
        {"weekday": 1, "opens_at": "10:00", "closes_at": "24:00"}]'
    )
  $$,
  'owners set the business''s hours, split shifts and open-until-midnight included'
);
select lives_ok(
  $$
    select public.set_working_hours(
      tests.business_id('nour-salon'),
      '[{"weekday": 0, "opens_at": "12:00", "closes_at": "20:00"}]',
      '30000000-0000-0000-0000-000000000001'
    )
  $$,
  'owners give a staff member their own hours, which may overlap the business''s'
);

select throws_ok(
  $$
    select public.set_working_hours(
      tests.business_id('nour-salon'),
      '[{"weekday": 2, "opens_at": "09:00", "closes_at": "13:00"},
        {"weekday": 2, "opens_at": "12:00", "closes_at": "18:00"}]'
    )
  $$,
  '23P01', null,
  'spans on the same day cannot overlap'
);
select throws_ok(
  $$
    select public.set_working_hours(
      tests.business_id('nour-salon'),
      '[{"weekday": 3, "opens_at": "18:00", "closes_at": "09:00"}]'
    )
  $$,
  '23514', null,
  'a span closes after it opens; overnight spans aren''t supported'
);
select throws_ok(
  $$
    select public.set_working_hours(
      tests.business_id('nour-salon'),
      '[{"weekday": 7, "opens_at": "09:00", "closes_at": "17:00"}]'
    )
  $$,
  '23514', null,
  'weekdays run from 0 (Sunday) to 6 (Saturday)'
);
select throws_ok(
  $$
    select public.set_working_hours(
      tests.business_id('nour-salon'),
      '[{"weekday": 0, "opens_at": "09:00", "closes_at": "17:00"}]',
      '30000000-0000-0000-0000-000000000002'
    )
  $$,
  '23503', null,
  'hours cannot be set for another business''s staff member'
);
select tests.act_as_database();

select results_eq(
  $$
    select weekday, opens_at::text, closes_at::text
    from public.working_hours
    where business_id = tests.business_id('nour-salon') and staff_id is null
    order by weekday, opens_at
  $$,
  $$ values (0::smallint, '10:00:00', '14:00:00'), (0::smallint, '16:00:00', '21:00:00'),
            (1::smallint, '10:00:00', '24:00:00') $$,
  'refused schedules leave the last good one in place'
);

-- Replacing hours ----------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select public.set_working_hours(
  tests.business_id('nour-salon'),
  '[{"weekday": 6, "opens_at": "11:00", "closes_at": "19:00"}]'
);
select public.set_working_hours(
  tests.business_id('nour-salon'), '[]', '30000000-0000-0000-0000-000000000001'
);
select tests.act_as_database();
select results_eq(
  $$
    select staff_id, weekday, opens_at::text
    from public.working_hours where business_id = tests.business_id('nour-salon')
  $$,
  $$ values (null::uuid, 6::smallint, '11:00:00') $$,
  'setting a schedule replaces it whole, and an empty one puts staff back on the business''s hours'
);

-- Who may see and change hours -----------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select results_eq(
  $$ select weekday from public.working_hours $$,
  $$ values (6::smallint) $$,
  'staff see their business''s hours'
);
select throws_ok(
  $$
    select public.set_working_hours(
      tests.business_id('nour-salon'),
      '[{"weekday": 0, "opens_at": "00:00", "closes_at": "24:00"}]'
    )
  $$,
  '42501', 'new row violates row-level security policy for table "working_hours"',
  'staff cannot change hours'
);
select tests.authenticate_as('owner-b@test.local');
select is_empty(
  $$ select 1 from public.working_hours where business_id = tests.business_id('nour-salon') $$,
  'other businesses cannot see the hours'
);
select throws_ok(
  $$
    select public.set_working_hours(
      tests.business_id('nour-salon'),
      '[{"weekday": 0, "opens_at": "00:00", "closes_at": "01:00"}]'
    )
  $$,
  '42501', 'new row violates row-level security policy for table "working_hours"',
  'other businesses cannot set the hours'
);
select tests.act_as_database();
select results_eq(
  $$ select weekday, opens_at::text from public.working_hours where business_id = tests.business_id('nour-salon') $$,
  $$ values (6::smallint, '11:00:00') $$,
  'refused changes delete nothing either'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.working_hours $$,
  '42501', 'permission denied for table working_hours',
  'visitors cannot read hours directly'
);
select tests.act_as_database();
select throws_ok(
  $$
    insert into public.working_hours (business_id, staff_id, weekday, opens_at, closes_at) values
      (tests.business_id('nour-salon'), '30000000-0000-0000-0000-000000000001', 4, '09:00', '12:00'),
      (tests.business_id('nour-salon'), '30000000-0000-0000-0000-000000000001', 4, '11:30', '15:00')
  $$,
  '23P01', null,
  'a staff member''s own spans cannot overlap either'
);

select * from finish();
rollback;
