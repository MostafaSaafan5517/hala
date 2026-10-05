import { expect, test } from "@playwright/test";
import { demoConfig } from "@/config/demo";
import { accessibilityViolations } from "./support/accessibility";
import { signIn } from "./support/forms";
import { adminClient } from "./support/supabase";
import { asNewVisitor } from "./support/visitors";

// The public demo, with the offline models: the nightly job sets the salon up (or resets it), a
// visitor chats with its assistant on the salon's website, and the read-only owner account shows
// the salon's side. The job's secret comes from playwright.config.ts.

const cron = { Authorization: `Bearer ${process.env.CRON_SECRET}` };

async function demoBusinessId() {
  const { data, error } = await adminClient()
    .from("businesses")
    .select("id")
    .eq("slug", demoConfig.slug)
    .eq("is_demo", true)
    .single();
  if (error) throw error;
  return data.id;
}

test("the nightly job sets the demo up, and a visitor tries it on the website and the dashboard", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  expect((await request.get("/api/demo/reset")).status()).toBe(401);
  expect(
    (await request.get("/api/demo/reset", { headers: cron })).status(),
  ).toBe(200);
  // A second night: the salon is there, so it's only cleared and refilled.
  const again = await request.get("/api/demo/reset", { headers: cron });
  expect(await again.json()).toEqual({ created: false });
  const businessId = await demoBusinessId();
  const [bookings, conversations] = await Promise.all([
    adminClient().from("bookings").select("id").eq("business_id", businessId),
    adminClient()
      .from("conversations")
      .select("id")
      .eq("business_id", businessId),
  ]);
  expect(bookings.data).toHaveLength(2);
  expect(conversations.data).toHaveLength(1);

  // A visitor on the salon's website.
  const visitor = await (
    await browser.newContext({ extraHTTPHeaders: asNewVisitor() })
  ).newPage();
  await visitor.goto("/demo");
  await expect(
    visitor.getByRole("heading", {
      name: "Hair, beard and colour in the heart of Riyadh",
    }),
  ).toBeVisible();
  await expect(visitor.getByRole("listitem")).toHaveCount(4);
  expect(await accessibilityViolations(visitor)).toEqual([]);
  await visitor.getByRole("button", { name: "Chat with us" }).click();
  const chat = visitor.frameLocator("#hala-widget-frame");
  await chat.getByRole("textbox").fill("Is there parking?");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByRole("log")).toContainText(
    "free parking behind the building",
  );

  // The salon's side, with the demo's public, read-only login.
  await page.goto("/login");
  await expect(
    page.getByRole("complementary", { name: "Trying the demo?" }),
  ).toContainText(demoConfig.email);
  await signIn(page, demoConfig.email, demoConfig.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/dashboard/b/${demoConfig.slug}/inbox`);
  await expect(page.getByRole("note")).toContainText(
    "You're in the read-only demo",
  );
  await expect(
    page
      .getByRole("region", { name: "Waiting for the team" })
      .getByRole("link"),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "Recent conversations" })
      .getByRole("link"),
  ).toHaveCount(1);
  expect(await accessibilityViolations(page)).toEqual([]);
});
