-- Ground rules for everything later migrations create, and the extensions the app relies on.

-- Home for helper functions that RLS policies call (for example "is this user staff of this
-- business?"). The Supabase API only serves the schemas listed under [api] in config.toml
-- (public, graphql_public), so nothing in `private` can be called over HTTP.
create schema private;

-- Postgres lets every role (PUBLIC, which includes anon) execute any new function by default.
-- Turn that off for functions our migrations create, so every grant has to be deliberate.
-- This must be the global form: a per-schema REVOKE cannot remove a global default.
alter default privileges revoke execute on functions from public;

-- Supabase's defaults give anon and authenticated every privilege on each new table, sequence
-- and function in public (TRUNCATE included, which RLS does not cover), leaving RLS as the only
-- guard. Reverse that for objects our migrations create: the API roles get nothing until a
-- migration grants it, so a forgotten grant fails closed. service_role keeps its access.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- pgvector: stores the embeddings of each business's knowledge (FAQs, policies) next to the
-- rest of its data, so retrieval runs under the same Row-Level Security as everything else.
-- Supabase keeps extensions in their own schema, off the API.
create extension if not exists vector with schema extensions;
