-- What the assistant may answer from, beyond services and hours: frequent questions (FAQs) and
-- policies (cancellation, payment, parking, ...). Each document is split into chunks, stored with
-- an embedding (for search by meaning) and its words (for search by keyword). Everything belongs
-- to one business: RLS limits who sees it, and search always filters by business.

create type public.knowledge_kind as enum ('faq', 'policy');

-- The words of a text for keyword search: lowercased, split by Postgres's text search parser,
-- with Arabic normalized so a word matches however it's written: vowel marks and tatweel
-- removed and letter variants unified. A word that starts like the article "ال" (alone or after
-- a preposition: "لل", "بال", ...) is kept both whole and without it, because the letters alone
-- can't tell an article from a word that starts that way (إلغاء, "cancellation", normalizes to
-- الغاء). So "السيارات" matches "سيارات", and "الإلغاء" matches "إلغاء" and "الغاء".
create function private.search_words(content text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct form), '{}')
  from unnest(tsvector_to_array(to_tsvector(
    'simple',
    translate(regexp_replace(content, '[ً-ْٰـ]', '', 'g'), 'أإآٱةى', 'اااايه')
  ))) as word,
  lateral (select regexp_replace(word, '^(وال|بال|كال|فال|لل|ال)', '') as stem) as stripped,
  lateral unnest(
    case when stem <> word and char_length(stem) >= 2 then array[word, stem] else array[word] end
  ) as form;
$$;

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind public.knowledge_kind not null,
  -- The language it's written in. Customers may ask in either: search works across languages.
  language public.language not null,
  -- An FAQ's question, or a policy's title.
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- An FAQ's answer, or a policy's text.
  body text not null check (char_length(btrim(body)) between 1 and 20000),
  -- Archived documents are kept (answers may have cited them) but never searched.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  document_id uuid not null,
  position integer not null check (position >= 0),
  content text not null check (char_length(content) between 1 and 4000),
  -- SHA-256 of the content: when a document is edited, unchanged chunks keep their embedding.
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  -- The model that made the embedding. Embeddings from different models can't be compared, so
  -- search only uses chunks embedded with the same model as the question.
  embedding_model text not null check (char_length(embedding_model) between 1 and 100),
  embedding extensions.vector(1536) not null,
  words text[] generated always as (private.search_words(content)) stored,
  unique (document_id, position),
  foreign key (document_id, business_id)
    references public.knowledge_documents (id, business_id) on delete cascade
);

-- Search reads one business's chunks and compares them all with the question (an exact scan,
-- found through this index). There is deliberately no approximate vector index (HNSW): a
-- business has at most a few hundred chunks, which an exact scan handles in milliseconds with
-- perfect recall, while an approximate index shared by every business applies the business filter
-- after its approximate search and can miss a business's best matches. Revisit (pgvector's
-- iterative index scans, or partitioning by business) if a business reaches tens of thousands.
create index knowledge_chunks_business_id on public.knowledge_chunks (business_id);

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

grant select on public.knowledge_documents, public.knowledge_chunks to authenticated;
-- Server code (the assistant) searches the knowledge base but never writes it.
revoke all on public.knowledge_documents, public.knowledge_chunks from service_role;
grant select on public.knowledge_documents, public.knowledge_chunks to service_role;
-- Content changes go through save_knowledge_document; archiving is a plain update.
grant update (active) on public.knowledge_documents to authenticated;

create policy "members can view their business's knowledge"
  on public.knowledge_documents for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

create policy "owners and admins can archive knowledge"
  on public.knowledge_documents for update to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'))
  with check (private.has_business_role(business_id, '{owner,admin}'));

create policy "members can view their business's knowledge chunks"
  on public.knowledge_chunks for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

-- Documents are audited. Chunks aren't: they are derived from the document, and logging every
-- embedding would bloat the history.
create trigger record_audit_log
  after insert or update or delete on public.knowledge_documents
  for each row execute function private.record_audit_log('id');

-- Creates a document (target_document_id null) or updates one, and replaces its chunks, in one
-- transaction, so a document and its search index never disagree. The server splits the text
-- and computes the embeddings first, and passes them in order:
-- [{"content": "...", "content_hash": "<sha-256 hex>", "embedding": [0.01, ...]}, ...].
-- Owners and admins only. A document's kind is fixed when it's created. Returns the document's
-- id, or null when there is no such document in that business.
create function public.save_knowledge_document(
  target_business_id uuid,
  target_document_id uuid,
  document_kind public.knowledge_kind,
  document_language public.language,
  document_title text,
  document_body text,
  chunks jsonb,
  chunks_model text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if not private.has_business_role(target_business_id, '{owner,admin}') then
    raise exception 'Only owners and admins can change the knowledge base'
      using errcode = '42501';
  end if;
  if jsonb_typeof(chunks) is distinct from 'array' or jsonb_array_length(chunks) = 0 then
    raise exception 'A document needs at least one chunk' using errcode = '22023';
  end if;

  if target_document_id is null then
    insert into public.knowledge_documents (business_id, kind, language, title, body)
    values (target_business_id, document_kind, document_language, document_title, document_body)
    returning id into saved_id;
  else
    update public.knowledge_documents
    set language = document_language,
      title = document_title,
      body = document_body,
      updated_at = now()
    where id = target_document_id and business_id = target_business_id
    returning id into saved_id;
    if saved_id is null then
      return null;
    end if;
    delete from public.knowledge_chunks where document_id = saved_id;
  end if;

  insert into public.knowledge_chunks (
    business_id, document_id, position, content, content_hash, embedding_model, embedding
  )
  select target_business_id, saved_id, chunk.ordinality - 1, chunk.value ->> 'content',
    chunk.value ->> 'content_hash', chunks_model, (chunk.value ->> 'embedding')::extensions.vector
  from jsonb_array_elements(chunks) with ordinality as chunk(value, ordinality);
  return saved_id;
end;
$$;

grant execute on function public.save_knowledge_document(
  uuid, uuid, public.knowledge_kind, public.language, text, text, jsonb, text
) to authenticated;
