begin;
select plan(20);
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

-- A chunk as the server sends it, with an embedding pointing along one dimension.
create function pg_temp.chunk(content text, dimension integer default 1)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'content', content,
    'content_hash', encode(extensions.digest(content, 'sha256'), 'hex'),
    'embedding', (
      select jsonb_agg(case when index = dimension then 1 else 0 end order by index)
      from generate_series(1, 1536) as index
    )
  );
$$;
grant execute on function pg_temp.chunk(text, integer) to authenticated;

-- A document's id whoever the test is acting as, so it can aim at one it can't see.
create function pg_temp.document_id(document_title text)
returns uuid
language sql
stable
security definer
as $$
  select id from public.knowledge_documents where title = document_title;
$$;
grant execute on function pg_temp.document_id(text) to authenticated;

-- Keyword words ----------------------------------------------------------------------------------

select is(
  (select array_agg(word order by word) from unnest(private.search_words(
    'هل يوجد مَوْقِف للسيارات؟ Free PARKING, free!'
  )) as word),
  (select array_agg(word order by word) from unnest(array[
    'free', 'parking', 'سيارات', 'للسيارات', 'موقف', 'هل', 'يوجد'
  ]) as word),
  'keyword search sees each word once, lowercased, Arabic normalized, with and without the article'
);
select ok(
  private.search_words('الإلغاء') && private.search_words('إلغاء')
    and private.search_words('إلغاء') && private.search_words('الغاء')
    and private.search_words('السيارات') && private.search_words('سيارات'),
  'an Arabic word matches with or without the article, however its alef is written'
);

-- Saving ----------------------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select isnt(
  public.save_knowledge_document(
    tests.business_id('nour-salon'), 'faq', 'en', 'Is there parking?',
    'Yes, free parking behind the salon.',
    jsonb_build_array(pg_temp.chunk('Is there parking? Yes, free parking behind the salon.')),
    'offline'
  ),
  null,
  'owners add a document with its chunks'
);
select results_eq(
  $$
    select document.kind::text, document.title, chunk.position, chunk.embedding_model,
      'parking' = any (chunk.words)
    from public.knowledge_documents document
    join public.knowledge_chunks chunk on chunk.document_id = document.id
  $$,
  $$ values ('faq', 'Is there parking?', 0, 'offline', true) $$,
  'the document and its chunk are stored together, with the chunk''s model and words'
);

select tests.authenticate_as('admin-a@test.local');
select is(
  public.save_knowledge_document(
    tests.business_id('nour-salon'), 'policy', 'en', 'Is there parking?',
    'Yes, free parking for two hours.',
    jsonb_build_array(pg_temp.chunk('Part one.', 2), pg_temp.chunk('Part two.', 3)),
    'offline',
    target_document_id => (select id from public.knowledge_documents where title = 'Is there parking?')
  ),
  (select id from public.knowledge_documents where title = 'Is there parking?'),
  'admins edit a document'
);
select results_eq(
  $$
    select document.kind::text, document.body, chunk.position, chunk.content
    from public.knowledge_documents document
    join public.knowledge_chunks chunk on chunk.document_id = document.id
    order by chunk.position
  $$,
  $$
    values
      ('faq', 'Yes, free parking for two hours.', 0, 'Part one.'),
      ('faq', 'Yes, free parking for two hours.', 1, 'Part two.')
  $$,
  'editing replaces the chunks; a document''s kind never changes'
);

select throws_ok(
  $$
    select public.save_knowledge_document(
      tests.business_id('nour-salon'), 'faq', 'en', 'Empty', 'Nothing', '[]', 'offline'
    )
  $$,
  '22023', 'A document needs at least one chunk',
  'a document always has chunks, so it can be found'
);
select throws_ok(
  $$
    select public.save_knowledge_document(
      tests.business_id('nour-salon'), 'faq', 'en', 'Short', 'Too few dimensions',
      '[{"content": "x", "content_hash": "8a77ec9b2fed9d6e0c2b1a6a3a3c1b6d58c4e8d1f0b7c39b2f2f2b8c5d6e7f80", "embedding": [1, 0, 0]}]',
      'offline'
    )
  $$,
  '22000', 'expected 1536 dimensions, not 3',
  'embeddings must have the stored length'
);
select is(
  (select count(*)::int from public.knowledge_documents),
  1,
  'and a refused save leaves nothing behind'
);

-- Who can change it -------------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$
    select public.save_knowledge_document(
      tests.business_id('nour-salon'), 'faq', 'en', 'Staff note', 'No.',
      jsonb_build_array(pg_temp.chunk('No.')), 'offline'
    )
  $$,
  '42501', 'Only owners and admins can change the knowledge base',
  'staff cannot change the knowledge base'
);
select results_eq(
  $$ select count(*)::int from public.knowledge_chunks $$,
  $$ values (2) $$,
  'but can read it'
);
update public.knowledge_documents set active = false;
select tests.authenticate_as('owner-b@test.local');
select throws_ok(
  $$
    select public.save_knowledge_document(
      tests.business_id('nour-salon'), 'faq', 'en', 'Spam', 'Spam.',
      jsonb_build_array(pg_temp.chunk('Spam.')), 'offline'
    )
  $$,
  '42501', 'Only owners and admins can change the knowledge base',
  'other businesses cannot add to it'
);
select is(
  public.save_knowledge_document(
    tests.business_id('cedar-clinic'), 'faq', 'en', 'Moved', 'Moved.',
    jsonb_build_array(pg_temp.chunk('Moved.')), 'offline',
    target_document_id => pg_temp.document_id('Is there parking?')
  ),
  null,
  'nor move a document into their own business'
);
select is_empty(
  $$ select 1 from public.knowledge_documents union all select 1 from public.knowledge_chunks $$,
  'nor read it'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$
    insert into public.knowledge_chunks (business_id, document_id, position, content, content_hash, embedding_model, embedding)
    select business_id, document_id, 9, 'Injected', repeat('a', 64), 'offline', embedding
    from public.knowledge_chunks limit 1
  $$,
  '42501', 'permission denied for table knowledge_chunks',
  'nobody writes chunks directly: they always come from their document'
);
select throws_ok(
  $$ update public.knowledge_documents set body = 'Changed directly' $$,
  '42501', 'permission denied for table knowledge_documents',
  'or edits a document''s text without re-indexing it'
);
select tests.act_as_database();
select ok(
  (select active from public.knowledge_documents),
  'staff cannot archive a document'
);
select tests.authenticate_as('owner-a@test.local');
update public.knowledge_documents set active = false;
select tests.act_as_database();
select ok(
  not (select active from public.knowledge_documents),
  'owners can'
);
select results_eq(
  $$
    select action, actor from public.audit_log
    where table_name = 'knowledge_documents'
      and business_id = tests.business_id('nour-salon')
    order by id
  $$,
  $$ values ('insert', 'user'), ('update', 'user'), ('update', 'user') $$,
  'the audit log records each change to a document'
);

delete from public.businesses where slug = 'nour-salon';
select is_empty(
  $$ select 1 from public.knowledge_chunks $$,
  'deleting a business deletes its knowledge'
);

select * from finish();
rollback;
