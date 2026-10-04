begin;
select plan(3);

select has_schema('private');

-- Nothing in `private` is reachable by the API roles yet. Signed-in users get USAGE (never
-- CREATE) once RLS policies start calling helper functions that live there.
select schema_privs_are(
  'private', 'anon', array[]::text[],
  'anon has no privileges on the private schema'
);
select schema_privs_are(
  'private', 'authenticated', array[]::text[],
  'authenticated has no privileges on the private schema'
);

select * from finish();
rollback;
