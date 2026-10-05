import { expect, test } from "@playwright/test";
import { addDays, todayIn } from "@/lib/dates";
import { accessibilityViolations } from "./support/accessibility";
import { createSalonFor } from "./support/businesses";
import { signInAs } from "./support/forms";
import { addDocument } from "./support/knowledge";
import { siteWithWidget } from "./support/sites";
import { createConfirmedUser } from "./support/users";
import { asNewVisitor } from "./support/visitors";

// One journey across the product, with the offline models: the owner puts the widget on their
// site, a visitor asks in Arabic and books through it, and the business then finds the booking,
// the conversation (with what the assistant did) and the usage, each in its own tab.

let site: Awaited<ReturnType<typeof siteWithWidget>> | undefined;
test.afterEach(async () => {
  await site?.close();
  site = undefined;
});

test("a visitor books on the business's website, and the business sees it everywhere", async ({
  page,
  browser,
  baseURL,
}) => {
  test.slow();
  const owner = await createConfirmedUser();
  const business = await createSalonFor(owner);
  await signInAs(page, owner);
  await addDocument(page, business.slug, {
    kind: "faq",
    language: "ar",
    title: "هل يوجد موقف سيارات؟",
    body: "نعم، يوجد موقف مجاني خلف الصالون.",
  });
  site = await siteWithWidget({
    appUrl: baseURL,
    slug: business.slug,
    language: "ar",
  });

  // The owner allows their site and turns the widget on.
  await page.goto(`/dashboard/b/${business.slug}/widget`);
  await page.getByLabel("Show the widget on your website").check();
  await page.getByLabel("Websites allowed to show it").fill(site.origin);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("form").getByRole("status")).toHaveText("Saved.");

  // A visitor on that site asks in Arabic, then books.
  const visitor = await (
    await browser.newContext({ extraHTTPHeaders: asNewVisitor() })
  ).newPage();
  await visitor.goto(site.origin);
  await visitor.getByRole("button", { name: "Chat with us" }).click();
  const chat = visitor.frameLocator("#hala-widget-frame");
  await expect(
    chat.getByRole("heading", { name: `تحدّث مع ${business.name}` }),
  ).toBeVisible();
  await expect(chat.locator("html")).toHaveAttribute("dir", "rtl");

  const log = chat.getByRole("log");
  await chat.getByRole("textbox").fill("هل يوجد موقف سيارات؟");
  await chat.getByRole("button", { name: "إرسال" }).click();
  await expect(log).toContainText("نعم، يوجد موقف مجاني خلف الصالون.");

  const tomorrow = addDays(todayIn("Asia/Riyadh"), 1);
  await chat
    .getByRole("textbox")
    .fill(
      `book Haircut on ${tomorrow} at 10:00 for Mona Adel, +966 50 123 4567`,
    );
  await chat.getByRole("button", { name: "إرسال" }).click();
  await log
    .getByRole("group", { name: "تأكيد" })
    .getByRole("button", { name: "تأكيد" })
    .click();
  const booked = log.getByText(/Booked! Your reference is [2-9A-HJ-NP-Z]{6}\./);
  await expect(booked).toBeVisible();
  const reference = /([2-9A-HJ-NP-Z]{6})\./.exec(
    (await booked.textContent()) ?? "",
  )?.[1];
  expect(reference).toBeDefined();

  // The booking is on the day's list.
  await page.goto(`/dashboard/b/${business.slug}/bookings?day=${tomorrow}`);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Mona Adel" }),
  ).toContainText("10:00");

  // The conversation is in the inbox, under the customer's name, with what the assistant did.
  await page.goto(`/dashboard/b/${business.slug}/inbox`);
  await page
    .getByRole("region", { name: "Recent conversations" })
    .getByRole("link", { name: /Mona Adel/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conversation with Mona Adel" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Customer" })).toContainText(
    "+966 50 123 4567",
  );
  const transcript = page.getByRole("region", { name: "Transcript" });
  await expect(transcript).toContainText("هل يوجد موقف سيارات؟");
  await expect(transcript).toContainText("Booking: done");
  await expect(transcript).toContainText(reference!);
  expect(await accessibilityViolations(page)).toEqual([]);

  // And it counts in the usage.
  await page.goto(`/dashboard/b/${business.slug}/usage`);
  const tiles = page.locator("dl");
  for (const label of ["Website conversations", "Bookings by the assistant"]) {
    await expect(
      tiles.locator("div").filter({ hasText: label }).locator("dd"),
    ).toHaveText("1");
  }
});
