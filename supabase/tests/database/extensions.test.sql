begin;
select plan(2);

select has_extension('extensions', 'vector', 'pgvector is installed, in the extensions schema');
-- Cosine distance, the operator retrieval will order by: identical vectors are 0 apart,
-- opposite ones 2.
select results_eq(
  $$ select '[1,0,0]'::extensions.vector <=> '[1,0,0]'::extensions.vector,
            '[1,0,0]'::extensions.vector <=> '[-1,0,0]'::extensions.vector $$,
  $$ values (0::double precision, 2::double precision) $$,
  'vectors can be compared by cosine distance'
);

select * from finish();
rollback;
