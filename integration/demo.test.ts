import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { setUpDemo } from "@/lib/demo/setup";

// The nightly job against the local stack. Its account already exists on every night but the
// first, and it has to find that account however many others the project has.

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const tag = randomBytes(4).toString("hex");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

afterAll(async () => {
  await pool.query("delete from auth.users where email like $1", [
    `many-accounts-${tag}-%`,
  ]);
  await pool.end();
});

describe("the demo's nightly job", () => {
  it("finds its existing account however many other accounts there are", async () => {
    await setUpDemo();
    // A thousand accounts older than the demo's and a thousand newer, so it isn't among the
    // first thousand whichever order auth lists accounts in.
    await pool.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
         email_change, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
         'authenticated', 'many-accounts-' || $1 || '-' || n || '@example.test', '', now(),
         '', '', '', '', '{"provider": "email", "providers": ["email"]}', '{}', created, created
       from generate_series(1, 2000) n,
         lateral (select case when n <= 1000 then timestamptz '2000-01-01' else now() end
           + n * interval '1 millisecond' as created) moment`,
      [tag],
    );

    await expect(setUpDemo()).resolves.toEqual({ created: false });
  }, 60_000);
});
