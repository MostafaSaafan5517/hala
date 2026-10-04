begin;
select plan(16);
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

-- Time off, from the business's local time ----------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select isnt(
  public.add_time_off(
    '30000000-0000-0000-0000-000000000001', '2026-10-05 10:00', '2026-10-05 14:00', 'Dentist'
  ),
  null,
  'owners add time off for their staff'
);
select public.add_time_off(
  '30000000-0000-0000-0000-000000000001', '2026-01-10 10:00', '2026-01-12 18:00', '  '
);
select tests.act_as_database();

-- Cairo observes daylight saving: 10:00 is 07:00 UTC in October but 08:00 UTC in January.
select results_eq(
  $$
    select starts_at, ends_at, reason
    from public.time_off
    where staff_id = '30000000-0000-0000-0000-000000000001'
    order by starts_at
  $$,
  $$
    values
      ('2026-01-10 08:00:00+00'::timestamptz, '2026-01-12 16:00:00+00'::timestamptz, null::text),
      ('2026-10-05 07:00:00+00'::timestamptz, '2026-10-05 11:00:00+00'::timestamptz, 'Dentist')
  $$,
  'local times become UTC with the business''s own daylight saving rules, and a blank reason is none'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$
    select public.add_time_off(
      '30000000-0000-0000-0000-000000000001', '2026-10-05 14:00', '2026-10-05 10:00'
    )
  $$,
  '23514', null,
  'time off ends after it starts'
);
select is(
  public.add_time_off(
    '30000000-0000-0000-0000-000000000002', '2026-10-05 10:00', '2026-10-05 14:00'
  ),
  null,
  'nothing is added for another business''s staff member'
);

select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$
    select public.add_time_off(
      '30000000-0000-0000-0000-000000000001', '2026-11-01 10:00', '2026-11-01 11:00'
    )
  $$,
  '42501', 'new row violates row-level security policy for table "time_off"',
  'staff cannot add time off'
);
select results_eq(
  $$ select count(*) from public.time_off $$,
  $$ values (2::bigint) $$,
  'staff see their business''s time off'
);
delete from public.time_off;
select tests.authenticate_as('owner-b@test.local');
select is_empty($$ select 1 from public.time_off $$, 'other businesses see none of it');
delete from public.time_off;
select tests.act_as_database();
select results_eq(
  $$ select count(*) from public.time_off $$,
  $$ values (2::bigint) $$,
  'staff, and other businesses, cannot remove time off'
);

select tests.authenticate_as('owner-a@test.local');
delete from public.time_off where reason = 'Dentist';
select tests.act_as_database();
select results_eq(
  $$ select count(*) from public.time_off $$,
  $$ values (1::bigint) $$,
  'owners remove time off'
);

-- Closures ---------------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select lives_ok(
  $$
    insert into public.closures (business_id, starts_on, ends_on, reason)
    values (tests.business_id('nour-salon'), '2026-03-20', '2026-03-22', 'Eid al-Fitr')
  $$,
  'owners close the business for whole days'
);
select throws_ok(
  $$
    insert into public.closures (business_id, starts_on, ends_on)
    values (tests.business_id('nour-salon'), '2026-03-22', '2026-03-20')
  $$,
  '23514', null,
  'a closure ends on or after its first day'
);
select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$
    insert into public.closures (business_id, starts_on, ends_on)
    values (tests.business_id('nour-salon'), '2026-04-01', '2026-04-01')
  $$,
  '42501', 'new row violates row-level security policy for table "closures"',
  'staff cannot close the business'
);
select results_eq(
  $$ select reason from public.closures $$,
  $$ values ('Eid al-Fitr') $$,
  'staff see the closures'
);
select tests.authenticate_as('owner-b@test.local');
select throws_ok(
  $$
    insert into public.closures (business_id, starts_on, ends_on)
    values (tests.business_id('nour-salon'), '2026-04-01', '2026-04-01')
  $$,
  '42501', 'new row violates row-level security policy for table "closures"',
  'other businesses cannot close it'
);
select is_empty($$ select 1 from public.closures $$, 'nor see its closures');
select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.closures $$,
  '42501', 'permission denied for table closures',
  'visitors cannot read closures directly'
);

select * from finish();
rollback;
