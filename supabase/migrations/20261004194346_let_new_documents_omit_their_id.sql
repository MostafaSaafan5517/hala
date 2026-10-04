-- save_knowledge_document took the document's id second, with no default, so a new document had
-- to pass null in the middle of its arguments, which the generated TypeScript types can't express.
-- The id now comes last and defaults to null, like set_working_hours's staff member. Same body.
drop function public.save_knowledge_document(
  uuid, uuid, public.knowledge_kind, public.language, text, text, jsonb, text
);

-- Creates a document (target_document_id left out) or updates one, and replaces its chunks, in one
-- transaction, so a document and its search index never disagree. The server splits the text
-- and computes the embeddings first, and passes them in order:
-- [{"content": "...", "content_hash": "<sha-256 hex>", "embedding": [0.01, ...]}, ...].
-- Owners and admins only. A document's kind is fixed when it's created. Returns the document's
-- id, or null when there is no such document in that business.
create function public.save_knowledge_document(
  target_business_id uuid,
  document_kind public.knowledge_kind,
  document_language public.language,
  document_title text,
  document_body text,
  chunks jsonb,
  chunks_model text,
  target_document_id uuid default null
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
  uuid, public.knowledge_kind, public.language, text, text, jsonb, text, uuid
) to authenticated;
