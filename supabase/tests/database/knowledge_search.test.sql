begin;
select plan(13);
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

-- An embedding of length 1 spread evenly over the given dimensions: two passages share
-- similarity only through shared dimensions, so the tests control it exactly.
create function pg_temp.embedding(variadic dimensions integer[])
returns extensions.vector
language sql
immutable
as $$
  select (
    '[' || array_to_string(array(
      select case when index = any (dimensions)
        then 1 / sqrt(cardinality(dimensions)) else 0 end
      from generate_series(1, 1536) as index
    ), ',') || ']'
  )::extensions.vector;
$$;
grant execute on function pg_temp.embedding(integer[]) to anon, authenticated, service_role;

-- Adds a document with one chunk, straight into the tables (as the save function would).
create function pg_temp.add(
  business_slug text, title text, content text, embedding extensions.vector,
  model text default 'offline', active boolean default true
)
returns void
language sql
as $$
  with document as (
    insert into public.knowledge_documents (business_id, kind, language, title, body, active)
    values (tests.business_id(business_slug), 'faq', 'en', title, content, active)
    returning id, business_id
  )
  insert into public.knowledge_chunks (business_id, document_id, position, content, content_hash, embedding_model, embedding)
  select business_id, id, 0, content, encode(extensions.digest(content, 'sha256'), 'hex'), model, embedding
  from document;
$$;

-- Nour Salon's knowledge. "we" is in three of its four searchable passages, "you" in two.
select pg_temp.add('nour-salon', 'Parking', 'Is there parking? Yes, we have free parking behind the salon.', pg_temp.embedding(1));
select pg_temp.add('nour-salon', 'Cancellations', 'Please cancel a day before; we charge you half for late cancellations.', pg_temp.embedding(2));
select pg_temp.add('nour-salon', 'Payment', 'Do you take cards? We accept cash and Visa.', pg_temp.embedding(3));
select pg_temp.add('nour-salon', 'موقف', 'هل يوجد موقف للسيارات؟ نعم، موقف مجاني خلف الصالون.', pg_temp.embedding(5));
-- Never searched: archived, or embedded with another model.
select pg_temp.add('nour-salon', 'Old parking', 'Old parking rules.', pg_temp.embedding(1), active => false);
select pg_temp.add('nour-salon', 'Other model', 'Parking, from another model.', pg_temp.embedding(1), model => 'openai/text-embedding-3-small');
-- Another business, with a passage identical in meaning to the question below.
select pg_temp.add('cedar-clinic', 'Clinic parking', 'Parking: the clinic has its own car park.', pg_temp.embedding(1));

-- Searches Nour Salon as server code does (the assistant), returning the passages' titles.
create function pg_temp.titles(query text, embedding extensions.vector, match_count integer default 5)
returns text[]
language sql
as $$
  select coalesce(array_agg(result.title order by result.score desc, result.similarity desc), '{}')
  from public.search_knowledge(
    tests.business_id('nour-salon'), query, embedding, 'offline', 0.5, match_count
  ) as result;
$$;
grant execute on function pg_temp.titles(text, extensions.vector, integer) to authenticated, service_role;

select tests.authenticate_as_service_role();

-- By meaning ---------------------------------------------------------------------------------------

select is(
  pg_temp.titles('Where can I leave my car?', pg_temp.embedding(1)),
  '{Parking}',
  'a passage close in meaning is found'
);
select is_empty(
  $$
    select 1 from public.search_knowledge(
      tests.business_id('nour-salon'), 'Where can I leave my car?', pg_temp.embedding(1),
      'offline', 0.5
    ) as result
    where result.title in ('Clinic parking', 'Old parking', 'Other model')
  $$,
  'never another business''s, an archived one, or one embedded by another model, however close'
);
select is(
  pg_temp.titles('Can I bring my dog?', pg_temp.embedding(7)),
  '{}',
  'nothing similar enough and no shared rare word: nothing is returned, so the assistant can say it doesn''t know'
);
select is(
  (select round(similarity::numeric, 4) from public.search_knowledge(
    tests.business_id('nour-salon'), 'car', pg_temp.embedding(1, 7), 'offline', 0.5
  )),
  round((1 / sqrt(2))::numeric, 4),
  'similarity is the cosine of the two embeddings'
);

-- By keyword -----------------------------------------------------------------------------------------

select results_eq(
  $$
    select title, similarity, keyword_match from public.search_knowledge(
      tests.business_id('nour-salon'), 'Do you accept VISA?', pg_temp.embedding(7), 'offline', 0.5
    )
  $$,
  $$ values ('Payment', 0::double precision, true) $$,
  'a rare word the question shares with a passage finds it, even with nothing in common in meaning'
);
select is(
  pg_temp.titles('We need to cancel, you see?', pg_temp.embedding(7)),
  '{Cancellations}',
  'words in many passages ("we", "you") are not matches; a rare one ("cancel") is'
);
select is(
  pg_temp.titles('أين موقف السيارات؟', pg_temp.embedding(7)),
  '{موقف}',
  'Arabic keywords match however they are written'
);

-- Both -----------------------------------------------------------------------------------------------

select is(
  pg_temp.titles('Which cards do you take, Visa?', pg_temp.embedding(1, 3)),
  '{Payment,Parking}',
  'a passage both signals agree on ranks first'
);
select is(
  pg_temp.titles('Which cards do you take, Visa?', pg_temp.embedding(1, 3), 1),
  '{Payment}',
  'and the caller chooses how many to get'
);

-- Who can search ---------------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select is(
  pg_temp.titles('Where can I leave my car?', pg_temp.embedding(1)),
  '{Parking}',
  'members search their business''s knowledge'
);
select tests.authenticate_as('owner-b@test.local');
select is(
  pg_temp.titles('Where can I leave my car?', pg_temp.embedding(1)),
  '{}',
  'other businesses get nothing from it'
);
select is(
  (select array_agg(title) from public.search_knowledge(
    tests.business_id('cedar-clinic'), 'Where can I leave my car?', pg_temp.embedding(1),
    'offline', 0.5
  )),
  '{"Clinic parking"}',
  'and only their own from their own'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$
    select * from public.search_knowledge(
      gen_random_uuid(), 'parking', pg_temp.embedding(1), 'offline', 0.5
    )
  $$,
  '42501', 'permission denied for function search_knowledge',
  'visitors cannot search directly (the assistant searches for them, as server code)'
);

select * from finish();
rollback;
