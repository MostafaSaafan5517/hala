begin;
select plan(9);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('owner-b@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Demo Salon', 'demo-salon', 'UTC', 'en');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Real Salon', 'real-salon', 'UTC', 'en');
select tests.act_as_database();

-- A chunk as the server sends it, with an embedding pointing along the first dimension.
create function pg_temp.chunk(content text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'content', content,
    'content_hash', encode(extensions.digest(content, 'sha256'), 'hex'),
    'embedding', (
      select jsonb_agg(case when index = 1 then 1 else 0 end order by index)
      from generate_series(1, 1536) as index
    )
  );
$$;
grant execute on function pg_temp.chunk(text) to authenticated, service_role;

-- Both salons: a haircut with Layla, open around the clock (UTC), and one booking each.
insert into public.services (business_id, name_en, duration_minutes, price, currency)
select id, 'Haircut', 30, 10000, 'SAR' from public.businesses where slug in ('demo-salon', 'real-salon');
insert into public.staff (business_id, name)
select id, 'Layla' from public.businesses where slug in ('demo-salon', 'real-salon');
insert into public.staff_services (business_id, staff_id, service_id)
select staff.business_id, staff.id, service.id
from public.staff staff join public.services service on service.business_id = staff.business_id;
insert into public.working_hours (business_id, weekday, opens_at, closes_at)
select business.id, weekday, '00:00', '24:00'
from public.businesses business, generate_series(0, 6) as weekday
where business.slug in ('demo-salon', 'real-salon');

select tests.authenticate_as_service_role();
select public.book_appointment(
  target_service_id => service.id,
  requested_start => date_trunc('day', now() + interval '2 days') + interval '10 hours',
  customer_name => 'Visitor',
  customer_phone => '+966501234567',
  idempotency_key => 'demo-test-' || business.slug
)
from public.services service join public.businesses business on business.id = service.business_id;
insert into public.conversations (business_id, channel, visitor_token_hash, visitor_hash)
select id, 'widget', encode(extensions.digest(slug, 'sha256'), 'hex'), repeat('f', 64)
from public.businesses where slug in ('demo-salon', 'real-salon');

select tests.act_as_database();
select results_eq(
  $$ select slug, is_demo from public.businesses order by slug $$,
  $$ values ('demo-salon', false), ('real-salon', false) $$,
  'no business is the demo unless server code makes it so'
);
select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ update public.businesses set is_demo = true where slug = 'demo-salon' $$,
  '42501', 'permission denied for table businesses',
  'an owner can''t mark their business as the demo'
);
select tests.act_as_database();
update public.businesses set is_demo = true where slug = 'demo-salon';

select tests.authenticate_as_service_role();
select isnt(
  public.save_knowledge_document(
    tests.business_id('demo-salon'), 'faq', 'en', 'Is there parking?', 'Yes, behind the salon.',
    jsonb_build_array(pg_temp.chunk('Is there parking? Yes, behind the salon.')), 'offline'
  ),
  null,
  'server code can set up a business''s knowledge (the demo''s setup does)'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ select public.reset_demo_business(tests.business_id('demo-salon')) $$,
  '42501', 'permission denied for function reset_demo_business',
  'only server code resets the demo'
);
select tests.authenticate_as_service_role();
select throws_ok(
  $$ select public.reset_demo_business(tests.business_id('real-salon')) $$,
  '42501', 'Only a demo business can be reset',
  'and never a real business'
);
select lives_ok(
  $$ select public.reset_demo_business(tests.business_id('demo-salon')) $$,
  'server code clears the demo'
);

select tests.act_as_database();
select results_eq(
  $$
    select
      (select count(*)::integer from public.conversations where business_id = tests.business_id('demo-salon')),
      (select count(*)::integer from public.bookings where business_id = tests.business_id('demo-salon')),
      (select count(*)::integer from public.customers where business_id = tests.business_id('demo-salon'))
  $$,
  $$ values (0, 0, 0) $$,
  'which takes away what visitors left: conversations, bookings, customers'
);
select results_eq(
  $$
    select
      (select count(*)::integer from public.services where business_id = tests.business_id('demo-salon')),
      (select count(*)::integer from public.staff where business_id = tests.business_id('demo-salon')),
      (select count(*)::integer from public.working_hours where business_id = tests.business_id('demo-salon')),
      (select count(*)::integer from public.knowledge_documents where business_id = tests.business_id('demo-salon'))
  $$,
  $$ values (1, 1, 7, 1) $$,
  'and keeps the salon itself: services, staff, hours, knowledge'
);
select results_eq(
  $$
    select
      (select count(*)::integer from public.conversations where business_id = tests.business_id('real-salon')),
      (select count(*)::integer from public.bookings where business_id = tests.business_id('real-salon')),
      (select count(*)::integer from public.customers where business_id = tests.business_id('real-salon'))
  $$,
  $$ values (1, 1, 1) $$,
  'other businesses keep everything'
);

select * from finish();
rollback;
