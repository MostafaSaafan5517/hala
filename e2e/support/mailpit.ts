import { expect } from "@playwright/test";
import { supabaseSettings } from "./supabase";

// Local Supabase sends every email to Mailpit instead of a real inbox (see supabase/config.toml).
const MAILPIT_URL = "http://127.0.0.1:55324";

type MailpitSearch = { messages: { ID: string }[] };
type MailpitMessage = { HTML: string };

async function searchByRecipient(recipient: string) {
  const query = encodeURIComponent(`to:"${recipient}"`);
  const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
  const { messages } = (await search.json()) as MailpitSearch;
  return messages;
}

async function findLink(recipient: string, path: string) {
  const latest = (await searchByRecipient(recipient))[0];
  if (!latest) return undefined;

  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`);
  const { HTML } = (await response.json()) as MailpitMessage;
  const href = [...HTML.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1]?.replaceAll("&amp;", "&"))
    .find((link) => link?.includes(path));
  return href;
}

/** Waits for the latest email to `recipient` and returns its link containing `path`. */
export async function getEmailLink(recipient: string, path: string) {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        link = await findLink(recipient, path);
        return link;
      },
      { message: `email to ${recipient} with a ${path} link`, timeout: 15_000 },
    )
    .toBeDefined();
  if (!link) throw new Error(`No ${path} link emailed to ${recipient}`);
  return link;
}

/**
 * The link Supabase's default confirmation email holds for the same sign-up, made from our
 * template's link: Supabase's verify endpoint with the same token, which confirms the address and
 * sends the browser back to the sign-up's redirect URL with a one-time code. Hosted projects on
 * Supabase's free plan send this email, since they can't use our template.
 */
export function defaultTemplateLink(templateLink: string) {
  const redirectTo = new URL(templateLink);
  const token = redirectTo.searchParams.get("token_hash");
  if (!token) throw new Error(`No token hash in ${templateLink}`);
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");

  const link = new URL("/auth/v1/verify", supabaseSettings().url);
  link.searchParams.set("token", token);
  link.searchParams.set("type", "signup");
  link.searchParams.set("redirect_to", redirectTo.toString());
  return link.toString();
}
