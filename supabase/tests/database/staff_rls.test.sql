begin;
select plan(17);
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

insert into public.services (id, business_id, name_en, duration_minutes, price, currency) values
  ('20000000-0000-0000-0000-000000000001', tests.business_id('nour-salon'), 'Haircut', 45, 25000, 'EGP'),
  ('20000000-0000-0000-0000-000000000002', tests.business_id('nour-salon'), 'Colour', 120, 90000, 'EGP'),
  ('20000000-0000-0000-0000-000000000003', tests.business_id('cedar-clinic'), 'Check-up', 30, 20000, 'SAR');

-- Adding staff -----------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select isnt(
  public.create_staff_member(
    tests.business_id('nour-salon'), 'Layla',
    '{20000000-0000-0000-0000-000000000001,20000000-0000-0000-0000-000000000002}'
  ),
  null,
  'owners add a staff member with the services they perform'
);
select tests.authenticate_as('admin-a@test.local');
select isnt(
  public.create_staff_member(tests.business_id('nour-salon'), 'Omar', '{}'),
  null,
  'admins add staff, and a staff member may have no services yet'
);
select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$ select public.create_staff_member(tests.business_id('nour-salon'), 'Sneaky', '{}') $$,
  '42501', 'new row violates row-level security policy for table "staff"',
  'staff cannot add staff'
);
select tests.authenticate_as('owner-b@test.local');
select throws_ok(
  $$ select public.create_staff_member(tests.business_id('nour-salon'), 'Spy', '{}') $$,
  '42501', 'new row violates row-level security policy for table "staff"',
  'owners cannot add staff to another business'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$
    select public.create_staff_member(
      tests.business_id('nour-salon'), 'Mixed',
      '{20000000-0000-0000-0000-000000000001,20000000-0000-0000-0000-000000000003}'
    )
  $$,
  '23503', null,
  'a staff member cannot be given another business''s service'
);
select tests.act_as_database();
select is_empty(
  $$ select 1 from public.staff where name = 'Mixed' $$,
  'when a service is refused, the staff member isn''t created either'
);

-- Seeing staff -----------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select set_eq(
  $$
    select staff.name, services.name_en
    from public.staff_services
    join public.staff on staff.id = staff_services.staff_id
    join public.services on services.id = staff_services.service_id
  $$,
  $$ values ('Layla', 'Haircut'), ('Layla', 'Colour') $$,
  'members see who performs which service at their business'
);
select set_eq(
  $$ select name from public.staff $$,
  $$ values ('Layla'), ('Omar') $$,
  'members see their business''s staff'
);
select tests.authenticate_as('owner-b@test.local');
select is_empty($$ select 1 from public.staff $$, 'other businesses see none of it');
select is_empty($$ select 1 from public.staff_services $$, 'nor who performs what');

-- Changing staff ---------------------------------------------------------------------------

select tests.authenticate_as('admin-a@test.local');
select ok(
  public.update_staff_member(
    (select id from public.staff where name = 'Omar'), 'Omar K.',
    '{20000000-0000-0000-0000-000000000001}'
  ),
  'admins rename staff and change their services'
);
select ok(
  public.update_staff_member(
    (select id from public.staff where name = 'Layla'), 'Layla',
    '{20000000-0000-0000-0000-000000000002}'
  ),
  'changing services keeps the ones still chosen and drops the rest'
);
select tests.act_as_database();
select set_eq(
  $$
    select staff.name, services.name_en
    from public.staff_services
    join public.staff on staff.id = staff_services.staff_id
    join public.services on services.id = staff_services.service_id
  $$,
  $$ values ('Layla', 'Colour'), ('Omar K.', 'Haircut') $$,
  'each staff member now performs exactly the chosen services'
);

select tests.authenticate_as('staff-a@test.local');
select is(
  public.update_staff_member((select id from public.staff where name = 'Layla'), 'Hacked', '{}'),
  false,
  'staff cannot change staff members'
);
select tests.authenticate_as('owner-b@test.local');
select is(
  public.update_staff_member(
    (select tests.business_id('nour-salon')), 'Nobody', '{}'
  ),
  false,
  'nothing changes for someone who can''t see the staff member'
);
select tests.act_as_database();
select results_eq(
  $$ select count(*) from public.staff_services where staff_id = (select id from public.staff where name = 'Layla') $$,
  $$ values (1::bigint) $$,
  'refused changes leave the services as they were'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ delete from public.staff where name = 'Layla' $$,
  '42501', 'permission denied for table staff',
  'staff members are archived, never deleted'
);

select * from finish();
rollback;
