-- A person from the business has taken the conversation over: the assistant stays quiet until
-- they hand it back. (open: the assistant answers; needs_human: it asked for a person and keeps
-- helping meanwhile; closed: finished.) Its own migration, because Postgres can't use a new enum
-- value in the transaction that adds it.
alter type public.conversation_status add value 'taken_over' before 'closed';
