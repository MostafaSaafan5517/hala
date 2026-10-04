begin;
select plan(11);
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

insert into public.customers (business_id, name, phone, language) values
  (tests.business_id('nour-salon'), 'Mona Adel', '+201012345678', 'ar'),
  (tests.business_id('cedar-clinic'), 'Sara Ali', '+966501234567', 'en');

-- Shape -------------------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.customers (business_id, name, phone, language)
    values (tests.business_id('nour-salon'), 'Local Format', '01012345678', 'ar')
  $$,
  '23514', null, 'phone numbers are stored in international format'
);
select throws_ok(
  $$
    insert into public.customers (business_id, name, phone, language)
    values (tests.business_id('nour-salon'), 'Spaced', '+20 10 1234 5678', 'ar')
  $$,
  '23514', null, 'with digits only'
);
select throws_ok(
  $$
    insert into public.customers (business_id, name, phone, language)
    values (tests.business_id('nour-salon'), 'Mona Again', '+201012345678', 'ar')
  $$,
  '23505', null, 'a phone number belongs to one customer in a business'
);
select lives_ok(
  $$
    insert into public.customers (business_id, name, phone, language)
    values (tests.business_id('cedar-clinic'), 'Mona Adel', '+201012345678', 'ar')
  $$,
  'but the same person can be a customer of two businesses'
);
select throws_ok(
  $$
    insert into public.customers (business_id, name, phone, email, language)
    values (tests.business_id('nour-salon'), 'No At', '+201112345678', 'mona.example.com', 'ar')
  $$,
  '23514', null, 'an email address needs an @'
);
select throws_ok(
  $$
    insert into public.customers (business_id, name, phone, language)
    values (tests.business_id('nour-salon'), '  ', '+201112345678', 'ar')
  $$,
  '23514', null, 'a customer has a name'
);

-- Who can see them ---------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select results_eq(
  $$ select name, phone from public.customers $$,
  $$ values ('Mona Adel', '+201012345678') $$,
  'staff see their own business''s customers, and only those'
);
select tests.authenticate_as('owner-b@test.local');
select results_eq(
  $$ select name from public.customers order by name $$,
  $$ values ('Mona Adel'), ('Sara Ali') $$,
  'each business sees only its own customers'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.customers $$,
  '42501', 'permission denied for table customers',
  'visitors cannot read customers at all'
);

-- Customers are written only by the booking functions.
select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$
    insert into public.customers (business_id, name, phone, language)
    values (tests.business_id('nour-salon'), 'Direct', '+201112345678', 'ar')
  $$,
  '42501', 'permission denied for table customers',
  'members cannot add customers directly'
);
select throws_ok(
  $$ update public.customers set name = 'Renamed' $$,
  '42501', 'permission denied for table customers',
  'or change them'
);

select * from finish();
rollback;
