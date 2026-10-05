-- The public demo's business. Server code sets it up (the demo route, run by a daily cron) and
-- clears what visitors leave in it each night. Its account is read-only, so the setup itself
-- never changes; only conversations, bookings and customers pile up.

-- Marks the business the nightly reset may clear. Only server code sets it: no API role can
-- write the column.
alter table public.businesses add column is_demo boolean not null default false;

-- Server code may now save a business's documents too: the demo's setup does, with the service
-- role. Otherwise the same as before: owners and admins, one transaction, chunks in order.
create or replace function public.save_knowledge_document(
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
  if not (
    auth.role() = 'service_role'
    or private.has_business_role(target_business_id, '{owner,admin}')
  ) then
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
) to service_role;

-- Clears what visitors left in a demo business: conversations (their messages go with them),
-- bookings and customers. Refuses any business not marked as the demo. Server code only.
create function public.reset_demo_business(target_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.businesses where id = target_business_id and is_demo
  ) then
    raise exception 'Only a demo business can be reset' using errcode = '42501';
  end if;
  delete from public.conversations where business_id = target_business_id;
  delete from public.bookings where business_id = target_business_id;
  delete from public.customers where business_id = target_business_id;
end;
$$;

grant execute on function public.reset_demo_business(uuid) to service_role;
