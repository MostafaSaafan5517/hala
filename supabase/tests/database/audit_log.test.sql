begin;
select plan(14);
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

-- The audit_log may already hold entries from other test data; every check below looks only at
-- the businesses created in this transaction (their ids are new).

-- Recording changes ---------------------------------------------------------------------------

select results_eq(
  $$
    select table_name, action, actor, actor_user_id, record_id
    from public.audit_log
    where business_id = tests.business_id('nour-salon')
    order by id
  $$,
  $$
    values
      ('businesses', 'insert', 'user', tests.get_user_id('owner-a@test.local'), tests.business_id('nour-salon')),
      ('business_members', 'insert', 'user', tests.get_user_id('owner-a@test.local'), tests.get_user_id('owner-a@test.local'))
  $$,
  'creating a business records the business and its owner, made by that user'
);

insert into public.business_members (business_id, user_id, role) values
  (tests.business_id('nour-salon'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('nour-salon'), tests.get_user_id('staff-a@test.local'), 'staff');

select tests.authenticate_as('owner-a@test.local');
update public.businesses set name = 'Nour Salon Downtown', slot_interval_minutes = 30
where slug = 'nour-salon';
-- Changes nothing, so it isn't history.
update public.businesses set name = 'Nour Salon Downtown' where slug = 'nour-salon';
insert into public.services (business_id, name_en, duration_minutes, price, currency)
values (tests.business_id('nour-salon'), 'Haircut', 45, 25000, 'EGP');
select public.create_staff_member(
  tests.business_id('nour-salon'), 'Layla',
  array(select id from public.services where name_en = 'Haircut')
);
select public.set_working_hours(
  tests.business_id('nour-salon'), '[{"weekday": 0, "opens_at": "10:00", "closes_at": "18:00"}]'
);
select public.add_time_off(
  (select id from public.staff where name = 'Layla'), '2026-11-01 10:00', '2026-11-01 12:00'
);
insert into public.closures (business_id, starts_on, ends_on)
values (tests.business_id('nour-salon'), '2026-12-25', '2026-12-25');
select tests.act_as_database();

select results_eq(
  $$
    select table_name, action, changed_columns
    from public.audit_log
    where business_id = tests.business_id('nour-salon') and actor = 'user'
    order by id
    offset 2
  $$,
  $$
    values
      ('businesses', 'update', '{name,slot_interval_minutes}'::text[]),
      ('services', 'insert', '{}'::text[]),
      ('staff', 'insert', '{}'::text[]),
      ('staff_services', 'insert', '{}'::text[]),
      ('working_hours', 'insert', '{}'::text[]),
      ('time_off', 'insert', '{}'::text[]),
      ('closures', 'insert', '{}'::text[])
  $$,
  'every setup change is recorded with the columns it changed; an update that changes nothing is not'
);
select results_eq(
  $$
    select old_data ->> 'name', new_data ->> 'name'
    from public.audit_log
    where business_id = tests.business_id('nour-salon')
      and table_name = 'businesses' and action = 'update'
  $$,
  $$ values ('Nour Salon', 'Nour Salon Downtown') $$,
  'updates keep the row as it was and as it is now'
);
select results_eq(
  $$
    select actor from public.audit_log
    where business_id = tests.business_id('nour-salon') and table_name = 'business_members'
    order by id
  $$,
  $$ values ('user'), ('database'), ('database') $$,
  'changes made directly in the database are recorded as such'
);

select tests.authenticate_as_service_role();
update public.services set price = 30000 where name_en = 'Haircut';
select tests.authenticate_as('admin-a@test.local');
delete from public.closures where business_id = tests.business_id('nour-salon');
select tests.act_as_database();
select results_eq(
  $$
    select table_name, action, actor, actor_user_id
    from public.audit_log
    where business_id = tests.business_id('nour-salon')
    order by id desc
    limit 2
  $$,
  $$
    values
      ('closures', 'delete', 'user', tests.get_user_id('admin-a@test.local')),
      ('services', 'update', 'server', null::uuid)
  $$,
  'server code is recorded as the server, and deletions are recorded too'
);
select isnt(
  (select old_data from public.audit_log
   where business_id = tests.business_id('nour-salon') and table_name = 'closures' and action = 'delete'),
  null,
  'a deleted row is kept in the history'
);

-- Who can read it ------------------------------------------------------------------------------

select tests.authenticate_as('admin-a@test.local');
select isnt_empty(
  $$ select 1 from public.audit_log where business_id = tests.business_id('nour-salon') $$,
  'admins see their business''s history'
);
select tests.authenticate_as('staff-a@test.local');
select is_empty($$ select 1 from public.audit_log $$, 'staff do not');
select tests.authenticate_as('owner-b@test.local');
select is_empty(
  $$ select 1 from public.audit_log where business_id = tests.business_id('nour-salon') $$,
  'other businesses do not'
);

-- Nobody can rewrite it --------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ delete from public.audit_log where business_id = tests.business_id('nour-salon') $$,
  '42501', 'permission denied for table audit_log',
  'owners cannot delete their history'
);
select tests.authenticate_as_service_role();
select throws_ok(
  $$
    insert into public.audit_log (business_id, actor, table_name, record_id, action)
    values (tests.business_id('nour-salon'), 'server', 'services', gen_random_uuid(), 'insert')
  $$,
  '42501', 'permission denied for table audit_log',
  'not even the server can write entries itself'
);
select tests.act_as_database();
select throws_ok(
  $$ update public.audit_log set actor = 'server' where business_id = tests.business_id('nour-salon') $$,
  'P0001', 'audit_log is append-only: its rows can''t be changed or deleted',
  'the database itself refuses to change entries'
);
select throws_ok(
  $$ delete from public.audit_log where business_id = tests.business_id('nour-salon') $$,
  'P0001', 'audit_log is append-only: its rows can''t be changed or deleted',
  'or to delete them'
);
select throws_ok(
  $$ truncate public.audit_log $$,
  'P0001', 'audit_log is append-only: its rows can''t be changed or deleted',
  'or to empty the table'
);

select * from finish();
rollback;
