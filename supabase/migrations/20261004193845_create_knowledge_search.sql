-- Searches one business's knowledge for the passages that answer a question, combining two
-- signals:
--   - meaning: the cosine similarity of the question's embedding and each passage's, counted only
--     above min_similarity (the threshold depends on the embedding model, so the caller passes
--     it), and only for passages embedded with the same model as the question;
--   - keywords: the question's words that are rare among the business's passages: found in at
--     most a quarter of them (or in one, when there are fewer than eight). A more common word
--     ("you", "في", the business's own name) says little about which passage answers, so it's
--     ignored, in any language and without a stop-word list.
-- Each signal ranks the passages it matched, and the ranks are fused (reciprocal rank fusion:
-- 1 / (60 + rank) from each list, summed), so a passage both signals agree on comes first. A
-- passage matched by neither is never returned: an empty result means "nothing relevant", and the
-- assistant says it doesn't know rather than guess.
--
-- Always one business: the filter is in the query itself, so server code (which bypasses RLS)
-- can't get another business's passages either. Security invoker: members search their own
-- business's knowledge, and nobody else's.
create function public.search_knowledge(
  target_business_id uuid,
  query_text text,
  query_embedding extensions.vector(1536),
  query_model text,
  min_similarity double precision,
  match_count integer default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  kind public.knowledge_kind,
  title text,
  content text,
  similarity double precision,
  keyword_match boolean,
  score double precision
)
language sql
stable
set search_path = ''
as $$
  with candidates as (
    select chunk.id, chunk.document_id, chunk.content, chunk.words, document.kind,
      document.title,
      1 - (chunk.embedding operator(extensions.<=>) query_embedding) as similarity
    from public.knowledge_chunks chunk
    join public.knowledge_documents document on document.id = chunk.document_id
    where chunk.business_id = target_business_id
      and document.active
      and chunk.embedding_model = query_model
  ),
  rare_words as (
    select query_word.word
    from unnest(private.search_words(query_text)) as query_word(word)
    cross join lateral (
      select count(*) as passages from candidates where query_word.word = any (candidates.words)
    ) as found
    cross join (select count(*) as total from candidates) as totals
    where found.passages between 1 and greatest(1, totals.total / 4)
  ),
  semantic_ranks as (
    select id, row_number() over (order by similarity desc, id) as rank
    from candidates
    where similarity >= min_similarity
  ),
  keyword_ranks as (
    select candidates.id,
      row_number() over (order by count(*) desc, candidates.id) as rank
    from candidates
    join rare_words on rare_words.word = any (candidates.words)
    group by candidates.id
  )
  select candidates.id, candidates.document_id, candidates.kind, candidates.title,
    candidates.content, candidates.similarity, keyword_ranks.id is not null,
    (coalesce(1.0 / (60 + semantic_ranks.rank), 0)
      + coalesce(1.0 / (60 + keyword_ranks.rank), 0))::double precision as score
  from candidates
  left join semantic_ranks on semantic_ranks.id = candidates.id
  left join keyword_ranks on keyword_ranks.id = candidates.id
  where semantic_ranks.id is not null or keyword_ranks.id is not null
  order by score desc, candidates.similarity desc, candidates.id
  limit least(greatest(match_count, 1), 20);
$$;

-- Members (the dashboard's "Try a question") and server code (the assistant). The search runs
-- as its caller, so they need the word normalizer too.
grant execute on function private.search_words(text) to authenticated, service_role;
grant execute on function public.search_knowledge(
  uuid, text, extensions.vector, text, double precision, integer
) to authenticated, service_role;
