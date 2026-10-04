begin;
select plan(4);
select tests.clear_tenant_data();

select tests.create_user('owner@test.local');
select tests.create_user('staff@test.local');
select tests.create_user('other-owner@test.local');

select tests.authenticate_as('owner@test.local');
select public.create_business('Nour Salon', 'nour-salon', 'Africa/Cairo', 'ar');
select tests.authenticate_as('other-owner@test.local');
select public.create_business('Cedar Clinic', 'cedar-clinic', 'Asia/Riyadh', 'en');
select tests.act_as_database();

insert into public.business_members (business_id, user_id, role)
values (tests.business_id('nour-salon'), tests.get_user_id('staff@test.local'), 'staff');

-- Even below the API (the admin API deletes users as the database would), an owner's account
-- can't go while their business is there.
select throws_ok(
  $$ delete from auth.users where email = 'owner@test.local' $$,
  '23503', 'A business must keep its owner',
  'deleting a business owner''s account is refused'
);
select throws_ok(
  $$ delete from public.business_members where role = 'owner' and business_id = tests.business_id('nour-salon') $$,
  '23503', 'A business must keep its owner',
  'the owner''s member row cannot be deleted on its own'
);

select lives_ok(
  $$ delete from auth.users where email = 'staff@test.local' $$,
  'deleting a staff member''s account takes them off the business'
);

-- Deleting the business takes its owner row with it.
delete from public.businesses where slug = 'cedar-clinic';
select is_empty(
  $$ select 1 from public.business_members where user_id = tests.get_user_id('other-owner@test.local') $$,
  'deleting a business removes its owner''s row too'
);

select * from finish();
rollback;
