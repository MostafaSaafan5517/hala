begin;
select plan(16);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('owner-b@test.local');
select tests.create_user('outsider@test.local');

-- Creating a business ----------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select isnt(
  public.create_business('Nour Salon', 'nour-salon', 'Africa/Cairo', 'ar'),
  null,
  'a signed-in user can create a business'
);
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Cedar Clinic', 'cedar-clinic', 'Asia/Riyadh', 'en');
select tests.act_as_database();

select results_eq(
  $$
    select m.user_id, m.role::text, b.timezone, b.default_language::text
    from public.business_members m
    join public.businesses b on b.id = m.business_id
    where b.slug = 'nour-salon'
  $$,
  $$ values (tests.get_user_id('owner-a@test.local'), 'owner', 'Africa/Cairo', 'ar') $$,
  'the creator becomes the only member, as owner, of a business in their time zone and language'
);

insert into public.business_members (business_id, user_id, role) values
  (tests.business_id('nour-salon'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('nour-salon'), tests.get_user_id('staff-a@test.local'), 'staff');

select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.create_business('Anon Spa', 'anon-spa', 'UTC', 'en') $$,
  '42501', 'permission denied for function create_business',
  'visitors who are not signed in cannot create a business'
);
select tests.act_as_database();
select throws_ok(
  $$ select public.create_business('No User', 'no-user', 'UTC', 'en') $$,
  '42501', 'You must be signed in to create a business',
  'create_business refuses a call with no signed-in user'
);

-- Seeing businesses ------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select results_eq(
  $$ select slug from public.businesses $$,
  $$ values ('nour-salon') $$,
  'an owner sees only their own business'
);
select tests.authenticate_as('staff-a@test.local');
select results_eq(
  $$ select slug from public.businesses $$,
  $$ values ('nour-salon') $$,
  'staff see the business they work at'
);
select tests.authenticate_as('owner-b@test.local');
select results_eq(
  $$ select slug from public.businesses $$,
  $$ values ('cedar-clinic') $$,
  'the owner of business B cannot see business A'
);
select tests.authenticate_as('outsider@test.local');
select is_empty(
  $$ select 1 from public.businesses $$,
  'a user with no business sees none'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.businesses $$,
  '42501', 'permission denied for table businesses',
  'visitors who are not signed in cannot read businesses'
);

-- Changing businesses ----------------------------------------------------------------------

select tests.authenticate_as('admin-a@test.local');
update public.businesses
set name = 'Nour Salon Downtown', timezone = 'Asia/Dubai', default_language = 'en'
where slug = 'nour-salon';
select tests.act_as_database();
select results_eq(
  $$ select name, timezone, default_language::text from public.businesses where slug = 'nour-salon' $$,
  $$ values ('Nour Salon Downtown', 'Asia/Dubai', 'en') $$,
  'admins can change their business''s name, time zone and language'
);

select tests.authenticate_as('staff-a@test.local');
update public.businesses set name = 'Renamed By Staff' where slug = 'nour-salon';
select tests.authenticate_as('owner-b@test.local');
update public.businesses set name = 'Taken Over' where slug = 'nour-salon';
select tests.act_as_database();
select is(
  (select name from public.businesses where slug = 'nour-salon'),
  'Nour Salon Downtown',
  'staff, and owners of other businesses, cannot rename a business'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ update public.businesses set slug = 'new-slug' where slug = 'nour-salon' $$,
  '42501', 'permission denied for table businesses',
  'owners cannot change the slug'
);
select throws_ok(
  $$ update public.businesses set timezone = 'Not/AZone' where slug = 'nour-salon' $$,
  '23514', null,
  'owners cannot set a time zone Postgres doesn''t know'
);
select throws_ok(
  $$ insert into public.businesses (name, slug, timezone) values ('Direct', 'direct-insert', 'UTC') $$,
  '42501', 'permission denied for table businesses',
  'businesses can only be created through create_business'
);
select throws_ok(
  $$ delete from public.businesses where slug = 'nour-salon' $$,
  '42501', 'permission denied for table businesses',
  'users cannot delete businesses'
);
select tests.act_as_database();

select results_eq(
  $$ select slug, timezone from public.businesses where slug = 'nour-salon' $$,
  $$ values ('nour-salon', 'Asia/Dubai') $$,
  'the business is unchanged after the refused changes'
);

select * from finish();
rollback;
