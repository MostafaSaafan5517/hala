import { adminClient } from "./supabase";

export const TEST_PASSWORD = "correct-horse-1";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}@example.com`;
}

/**
 * Creates a user whose email is already confirmed, through the Supabase admin API. Faster than
 * the sign-up flow for tests that are about something else; the sign-up flow has its own test.
 */
export async function createConfirmedUser(
  fullName = "Test User",
  options: { readOnly?: boolean } = {},
) {
  const email = uniqueEmail("user");
  const { error } = await adminClient().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    // Like the public demo's account: the database refuses its changes.
    ...(options.readOnly ? { app_metadata: { read_only: true } } : {}),
  });
  if (error) throw error;

  return { email, password: TEST_PASSWORD, fullName };
}
