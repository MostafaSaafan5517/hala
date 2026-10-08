import { expect, type APIRequestContext, type Browser } from "@playwright/test";
import { demoConfig } from "@/config/demo";
import { slugify } from "@/lib/slug";
import { createBusinessFor } from "../../e2e/support/businesses";
import { signIn } from "../../e2e/support/forms";
import { adminClient } from "../../e2e/support/supabase";
import { TEST_PASSWORD } from "../../e2e/support/users";
import { asNewVisitor } from "../../e2e/support/visitors";

// What the screenshot and Lighthouse runs share: where they write, the accounts they use (made
// once and kept, so every run starts from the same state), and getting a page signed in.

export const outDir = process.env.SCREENS_DIR ?? "";
if (!outDir) {
  throw new Error(
    "Set SCREENS_DIR, for example SCREENS_DIR=docs/design/before",
  );
}

/** A member of the demo salon who can change things (the demo's own owner is read-only). */
export const frontDesk = {
  email: "screens.front-desk@example.test",
  fullName: "Rana Haddad",
};
/** The owner of a business that hasn't been set up yet: every empty state. */
export const newOwner = {
  email: "screens.new-owner@example.test",
  fullName: "Samir Khalil",
};
/** The owner of a business whose assistant spent today's budget. */
export const spentOwner = {
  email: "screens.spent-owner@example.test",
  fullName: "Huda Nasser",
};
export const emptyBusiness = "Cedar Clinic";
export const spentBusiness = "Palm Physio";

export async function ensureUser(user: { email: string; fullName: string }) {
  const admin = adminClient();
  const created = await admin.auth.admin.createUser({
    email: user.email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: user.fullName },
  });
  if (created.data.user) return created.data.user.id;
  if (created.error?.code !== "email_exists") throw created.error;
  // The profile has the id (its email follows the account's), however many accounts there are.
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error(`${user.email} exists but has no profile`);
  return profile.id as string;
}

export async function businessId(slug: string) {
  const { data, error } = await adminClient()
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function ensureBusiness(owner: { email: string }, name: string) {
  return (
    (await businessId(slugify(name))) ??
    (
      await createBusinessFor(
        { email: owner.email, password: TEST_PASSWORD },
        name,
      )
    ).id
  );
}

/** Sets the demo salon up (or clears it), with the front desk as one of its admins. */
export async function resetDemo(request: APIRequestContext) {
  const reset = await request.get("/api/demo/reset", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(reset.ok()).toBe(true);
  const demoId = await businessId(demoConfig.slug);
  if (!demoId) throw new Error("The demo salon wasn't set up");
  const frontDeskId = await ensureUser(frontDesk);
  const admin = adminClient();
  const { data: membership } = await admin
    .from("business_members")
    .select("user_id")
    .eq("business_id", demoId)
    .eq("user_id", frontDeskId)
    .maybeSingle();
  if (!membership) {
    const { error } = await admin
      .from("business_members")
      .insert({ business_id: demoId, user_id: frontDeskId, role: "admin" });
    if (error) throw error;
  }
  return demoId;
}

/** A date in Riyadh (the demo salon's zone), days from today, as YYYY-MM-DD. */
export function riyadhDay(daysAhead: number) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
  }).format(new Date());
  const day = new Date(`${today}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + daysAhead);
  return day.toISOString().slice(0, 10);
}

/** A page in a context of its own, looking like a new website visitor. */
export async function visitorPage(browser: Browser) {
  const context = await browser.newContext({
    extraHTTPHeaders: asNewVisitor(),
  });
  return context.newPage();
}

/** A page in a context of its own, signed in as `user`. */
export async function staffPage(
  browser: Browser,
  user: { email: string },
  password = TEST_PASSWORD,
) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await signIn(page, user.email, password);
  await expect(page).toHaveURL(/\/dashboard$/);
  return page;
}
