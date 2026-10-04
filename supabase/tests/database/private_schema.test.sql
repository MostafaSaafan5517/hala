begin;
select plan(4);

select has_schema('private');

select schema_privs_are(
  'private', 'anon', array[]::text[],
  'anon has no privileges on the private schema'
);
-- RLS policies run as the signed-in user, so they need to reach the helpers in private.
select schema_privs_are(
  'private', 'authenticated', array['USAGE'],
  'authenticated can only use (not create in) the private schema'
);
-- Server code checks availability and books through functions that call helpers in private.
select schema_privs_are(
  'private', 'service_role', array['USAGE'],
  'service_role can only use (not create in) the private schema'
);

select * from finish();
rollback;
