import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, type Page, test } from "@playwright/test";
import { addDays, todayIn } from "@/lib/dates";
import { accessibilityViolations } from "./support/accessibility";
import { addMember, createSalonFor } from "./support/businesses";
import { signInAs } from "./support/forms";
import { addDocument } from "./support/knowledge";
import { adminClient } from "./support/supabase";
import { createConfirmedUser } from "./support/users";
import { asNewVisitor } from "./support/visitors";

// The website widget, with the offline models: a visitor with no account chats, books with an
// on-screen confirmation, switches language, and comes back after a reload. The business turns
// it on and allows its sites; browsers refuse to show it anywhere else.

async function salonWithParkingFaq(page: Page) {
  const owner = await createConfirmedUser();
  const business = await createSalonFor(owner);
  await signInAs(page, owner);
  await addDocument(page, business.slug, {
    kind: "faq",
    title: "Is there parking?",
    body: "Yes, free parking behind the salon.",
  });
  return { owner, business };
}

async function enableWidget(
  businessId: string,
  origins = ["https://nour-salon.com"],
) {
  const { error } = await adminClient()
    .from("businesses")
    .update({ widget_enabled: true, widget_origins: origins })
    .eq("id", businessId);
  if (error) throw error;
}

async function say(page: Page, text: string) {
  await page.getByRole("textbox").fill(text);
  await page.getByRole("button", { name: /^(Send|إرسال)$/ }).click();
}

test("owners turn the widget on for their site, copy the code, and try it", async ({
  page,
  browser,
}) => {
  test.slow();
  // The owner tries the preview as a website visitor would.
  await page.context().setExtraHTTPHeaders(asNewVisitor());
  const { business } = await salonWithParkingFaq(page);
  const staff = await createConfirmedUser();
  await addMember(business.id, staff.email, "staff");

  await page.goto(`/dashboard/b/${business.slug}/widget`);
  expect(await accessibilityViolations(page)).toEqual([]);
  await page.getByLabel("Show the widget on your website").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Add the website the widget goes on before turning it on.",
  );

  await page
    .getByLabel("Websites allowed to show it")
    .fill("https://Nour-Salon.com/");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("form").getByRole("status")).toHaveText("Saved.");
  await expect(page.getByLabel("Websites allowed to show it")).toHaveValue(
    "https://nour-salon.com",
  );
  await expect(page.getByLabel("Embed code")).toHaveValue(
    new RegExp(
      `^<script src="http://localhost:\\d+/widget\\.js" data-business="${business.slug}" defer></script>$`,
    ),
  );

  const preview = page.frameLocator('iframe[title="Widget preview"]');
  await preview.getByRole("textbox").fill("Where is the parking?");
  await preview.getByRole("button", { name: "Send" }).click();
  await expect(preview.getByRole("log")).toContainText(
    "Yes, free parking behind the salon.",
  );
  expect(await accessibilityViolations(page)).toEqual([]);

  const staffPage = await (await browser.newContext()).newPage();
  await signInAs(staffPage, staff);
  const response = await staffPage.goto(`/dashboard/b/${business.slug}/widget`);
  expect(response?.status()).toBe(404);
});

test("a visitor chats, books with a confirmation, switches to Arabic, and comes back later", async ({
  page,
  browser,
}) => {
  test.slow();
  const { business } = await salonWithParkingFaq(page);
  await enableWidget(business.id);
  const tomorrow = addDays(todayIn("Asia/Riyadh"), 1);

  // A visitor: no account, their own browser.
  const visitor = await (
    await browser.newContext({ extraHTTPHeaders: asNewVisitor() })
  ).newPage();
  await visitor.goto(`/widget/${business.slug}`);
  await expect(
    visitor.getByRole("heading", { name: `Chat with ${business.name}` }),
  ).toBeVisible();
  expect(await accessibilityViolations(visitor)).toEqual([]);

  await say(visitor, "Where is the parking?");
  const log = visitor.getByRole("log");
  await expect(log).toContainText("Yes, free parking behind the salon.");
  await expect(log).toContainText("Sources: [1] Is there parking?");

  await say(
    visitor,
    `book Haircut on ${tomorrow} at 10:00 for Mona Adel, +966 50 123 4567`,
  );
  await log
    .getByRole("group", { name: "Confirm" })
    .getByRole("button", { name: "Confirm" })
    .click();
  await expect(log).toContainText(
    /Booked! Your reference is [2-9A-HJ-NP-Z]{6}\./,
  );

  // The conversation is still there after a reload.
  await visitor.reload();
  await expect(log).toContainText("Where is the parking?");
  await expect(log).toContainText(/Booked · [2-9A-HJ-NP-Z]{6}/);

  await visitor.getByRole("button", { name: "العربية" }).click();
  await expect(
    visitor.getByRole("heading", { name: `تحدّث مع ${business.name}` }),
  ).toBeVisible();
  await expect(visitor.locator("html")).toHaveAttribute("dir", "rtl");
  await say(visitor, "أين موقف السيارات؟");
  await expect(log).toContainText("لا أعرف");
  expect(await accessibilityViolations(visitor)).toEqual([]);

  const { data: bookings } = await adminClient()
    .from("bookings")
    .select("id")
    .eq("business_id", business.id);
  expect(bookings).toHaveLength(1);
});

/** Websites the test serves (a business's own, or someone else's), each on its own origin. */
const sites: Server[] = [];
test.afterEach(() => {
  for (const site of sites.splice(0)) site.close();
});

/**
 * A website carrying the embed code, on a loopback port: browsers won't let a public site load
 * scripts from localhost, where the app under test runs.
 */
async function siteWithWidget(slug: string, baseURL: string | undefined) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(
      `<!doctype html><html lang="en"><title>Site</title><body><main>A site</main><script src="${baseURL}/widget.js" data-business="${slug}" data-label="Chat with us" defer></script></body></html>`,
    );
  });
  sites.push(server);
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

test("the widget shows only for businesses that turned it on, and only on their sites", async ({
  page,
  request,
  baseURL,
}) => {
  const owner = await createConfirmedUser();
  const business = await createSalonFor(owner);
  const ownSite = await siteWithWidget(business.slug, baseURL);
  const otherSite = await siteWithWidget(business.slug, baseURL);

  const off = await request.get(`/widget/${business.slug}`);
  expect(off.status()).toBe(404);

  await enableWidget(business.id, [ownSite]);
  const on = await request.get(`/widget/${business.slug}`);
  expect(on.status()).toBe(200);
  expect(on.headers()["content-security-policy"]).toBe(
    `frame-ancestors 'self' ${ownSite}`,
  );
  // Hala's other pages refuse to be framed by anyone.
  const login = await request.get("/login");
  expect(login.headers()["content-security-policy"]).toBe(
    "frame-ancestors 'none'",
  );

  // On the business's own site, the embed code opens and closes the chat.
  await page.goto(ownSite);
  const launcher = page.getByRole("button", { name: "Chat with us" });
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await launcher.click();
  await expect(launcher).toHaveAttribute("aria-expanded", "true");
  const frame = page.frameLocator("#hala-widget-frame");
  await expect(
    frame.getByRole("heading", { name: `Chat with ${business.name}` }),
  ).toBeVisible();
  await frame.getByRole("button", { name: "Close chat" }).click();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(launcher).toBeFocused();

  // On anyone else's site, the browser refuses to show it.
  const elsewhere = await page.context().newPage();
  await elsewhere.goto(otherSite);
  const loaded = elsewhere
    .locator("#hala-widget-frame")
    .evaluate(
      (element) =>
        new Promise((resolve) =>
          element.addEventListener("load", resolve, { once: true }),
        ),
    );
  await elsewhere.getByRole("button", { name: "Chat with us" }).click();
  await loaded;
  await expect(
    elsewhere.frameLocator("#hala-widget-frame").getByRole("heading"),
  ).toHaveCount(0);
});
