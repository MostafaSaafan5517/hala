begin;
select plan(17);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('owner-b@test.local');
select tests.create_user('outsider@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Nour Salon', 'nour-salon', 'Africa/Cairo', 'ar');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Cedar Clinic', 'cedar-clinic', 'Asia/Riyadh', 'en');
select tests.act_as_database();

insert into public.business_members (business_id, user_id, role) values
  (tests.business_id('nour-salon'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('nour-salon'), tests.get_user_id('staff-a@test.local'), 'staff');

insert into public.services (business_id, name_en, name_ar, duration_minutes, price, currency)
values (tests.business_id('cedar-clinic'), 'Check-up', 'فحص', 30, 20000, 'SAR');

-- Adding services --------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select lives_ok(
  $$
    insert into public.services (business_id, name_en, name_ar, duration_minutes, buffer_minutes, price, currency)
    values (tests.business_id('nour-salon'), 'Haircut', 'قص الشعر', 45, 15, 25000, 'EGP')
  $$,
  'owners add services'
);
select tests.authenticate_as('admin-a@test.local');
select lives_ok(
  $$
    insert into public.services (business_id, name_ar, duration_minutes, price, currency)
    values (tests.business_id('nour-salon'), 'استشوار', 30, 15000, 'EGP')
  $$,
  'admins add services, and an Arabic name alone is enough'
);
select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$
    insert into public.services (business_id, name_en, duration_minutes, price, currency)
    values (tests.business_id('nour-salon'), 'Free haircut', 30, 0, 'EGP')
  $$,
  '42501', 'new row violates row-level security policy for table "services"',
  'staff cannot add services'
);
select tests.authenticate_as('owner-b@test.local');
select throws_ok(
  $$
    insert into public.services (business_id, name_en, duration_minutes, price, currency)
    values (tests.business_id('nour-salon'), 'Sabotage', 30, 1, 'EGP')
  $$,
  '42501', 'new row violates row-level security policy for table "services"',
  'owners cannot add services to another business'
);
select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$
    insert into public.services (business_id, name_en, duration_minutes, price, currency, active)
    values (tests.business_id('nour-salon'), 'Hidden', 30, 100, 'EGP', false)
  $$,
  '42501', 'permission denied for table services',
  'a service starts active; archiving is an update'
);

-- Seeing services --------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select set_eq(
  $$ select coalesce(name_en, name_ar) from public.services $$,
  $$ values ('Haircut'), ('استشوار') $$,
  'staff see their business''s services'
);
select tests.authenticate_as('owner-b@test.local');
select set_eq(
  $$ select name_en from public.services $$,
  $$ values ('Check-up') $$,
  'the owner of business B sees only business B''s services'
);
select tests.authenticate_as('outsider@test.local');
select is_empty($$ select 1 from public.services $$, 'outsiders see no services');
select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.services $$,
  '42501', 'permission denied for table services',
  'visitors cannot read services directly (the assistant will, through the server)'
);

-- Changing services ------------------------------------------------------------------------

select tests.authenticate_as('admin-a@test.local');
update public.services set price = 30000, active = false where name_en = 'Haircut';
select tests.authenticate_as('staff-a@test.local');
update public.services set price = 1 where name_en = 'Haircut';
select tests.authenticate_as('owner-b@test.local');
update public.services set price = 1 where name_en = 'Haircut';
select tests.act_as_database();
select results_eq(
  $$ select price, active from public.services where name_en = 'Haircut' $$,
  $$ values (30000, false) $$,
  'admins edit and archive services; staff and other owners cannot'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ update public.services set business_id = tests.business_id('cedar-clinic') where name_en = 'Haircut' $$,
  '42501', 'permission denied for table services',
  'a service cannot be moved to another business'
);
select throws_ok(
  $$ delete from public.services where name_en = 'Haircut' $$,
  '42501', 'permission denied for table services',
  'services are archived, never deleted'
);
select tests.act_as_database();

-- Rules ------------------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.services (business_id, duration_minutes, price, currency)
    values (tests.business_id('nour-salon'), 30, 100, 'EGP')
  $$,
  '23514', null, 'a service needs a name in at least one language'
);
select throws_ok(
  $$
    insert into public.services (business_id, name_en, duration_minutes, price, currency)
    values (tests.business_id('nour-salon'), 'Odd', 32, 100, 'EGP')
  $$,
  '23514', null, 'durations come in 5-minute steps'
);
select throws_ok(
  $$
    insert into public.services (business_id, name_en, duration_minutes, price, currency)
    values (tests.business_id('nour-salon'), 'Refund', 30, -100, 'EGP')
  $$,
  '23514', null, 'prices cannot be negative'
);
select throws_ok(
  $$
    insert into public.services (business_id, name_en, duration_minutes, price, currency)
    values (tests.business_id('nour-salon'), 'Lowercase', 30, 100, 'egp')
  $$,
  '23514', null, 'currencies are ISO codes in capitals'
);
select throws_ok(
  $$
    insert into public.services (business_id, name_en, duration_minutes, buffer_minutes, price, currency)
    values (tests.business_id('nour-salon'), 'Slow', 30, 7, 100, 'EGP')
  $$,
  '23514', null, 'buffers come in 5-minute steps'
);

select * from finish();
rollback;
