import { expect, test } from "@playwright/test";
import { slugify } from "@/lib/slug";
import { accessibilityViolations } from "./support/accessibility";
import {
  addMember,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

// The browser says it's in Cairo, so the form should suggest that time zone.
test.use({ timezoneId: "Africa/Cairo" });

test("a new owner creates their business from the dashboard", async ({
  page,
}) => {
  const owner = await createConfirmedUser("Nadia Owner");
  const name = uniqueBusinessName("Nour Salon");

  await signInAs(page, owner);
  await expect(page.getByText("You don't have a business yet")).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);
  await page.getByRole("link", { name: "Create a business" }).click();

  await page.getByLabel("Business name").fill(name);
  await expect(page.getByLabel("Web address")).toHaveValue(slugify(name));
  await expect(page.getByLabel("Time zone")).toHaveValue("Africa/Cairo");
  await page.getByLabel("Assistant's first language").selectOption("ar");
  expect(await accessibilityViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Create business" }).click();

  await expect(page).toHaveURL(new RegExp(`/dashboard/b/${slugify(name)}$`));
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("You own this business.")).toBeVisible();
  const details = page.getByRole("region", { name: "Details" });
  await expect(details.getByLabel("Time zone")).toHaveValue("Africa/Cairo");
  await expect(details.getByLabel("Assistant's first language")).toHaveValue(
    "ar",
  );
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.getByRole("link", { name: "Businesses" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: name }),
  ).toContainText("Owner");
});

test("two owners: web addresses are unique, and each sees only their own business", async ({
  page,
  browser,
}) => {
  const first = await createConfirmedUser();
  const second = await createConfirmedUser();
  const business = await createBusinessFor(
    first,
    uniqueBusinessName("Cedar Clinic"),
  );

  await signInAs(page, second);
  await page.goto("/dashboard/new-business");
  await page.getByLabel("Business name").fill(business.name);
  await page.getByRole("button", { name: "Create business" }).click();
  await expect(formError(page)).toHaveText(
    "That web address is taken. Try another one.",
  );
  // The form keeps what was typed.
  await expect(page.getByLabel("Business name")).toHaveValue(business.name);

  const response = await page.goto(`/dashboard/b/${business.slug}`);
  expect(response?.status()).toBe(404);

  const firstPage = await (await browser.newContext()).newPage();
  await signInAs(firstPage, first);
  await expect(
    firstPage.getByRole("listitem").filter({ hasText: business.name }),
  ).toBeVisible();
});

test("staff open the business they work at", async ({ page }) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Rose Studio"),
  );
  await addMember(business.id, staff.email, "staff");

  await signInAs(page, staff);
  await page.getByRole("link", { name: business.name }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/b/${business.slug}$`));
  await expect(page.getByText("You're on the staff here.")).toBeVisible();
});

test("an owner sees every section's tab, on a laptop and on a phone", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Tab Salon"),
  );
  await signInAs(page, owner);

  // Seen, not just present: a row that hid its overflow once kept Usage, Widget and Team out of
  // sight, and clicking a link scrolls it into view first, so only this check could tell.
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/dashboard/b/${business.slug}`);
    const tabs = page
      .getByRole("navigation", { name: "Business" })
      .getByRole("link");
    await expect(tabs).toHaveCount(12);
    for (const tab of await tabs.all()) {
      await expect(tab).toBeInViewport({ ratio: 1 });
    }
  }
});

test("creating a business requires signing in", async ({ page }) => {
  await page.goto("/dashboard/new-business");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fnew-business$/);
});

test("owners correct the business's details and set its booking rules", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Amber Salon"),
    { timezone: "UTC" },
  );
  await addMember(business.id, staff.email, "staff");

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}`);
  const details = page.getByRole("region", { name: "Details" });
  await details.getByLabel("Business name").fill("Amber Beauty Lounge");
  await details.getByLabel("Time zone").selectOption("Asia/Dubai");
  await details.getByRole("button", { name: "Save details" }).click();
  await expect(details.getByRole("status")).toHaveText("Saved.");
  await expect(
    page.getByRole("heading", { level: 1, name: "Amber Beauty Lounge" }),
  ).toBeVisible();

  const rules = page.getByRole("region", { name: "Booking rules" });
  await expect(rules.getByLabel("Appointments start")).toHaveValue("15");
  await rules.getByLabel("Book how soon").selectOption("120");
  await rules.getByLabel("Book how far ahead (days)").fill("30");
  await rules.getByLabel("Appointments start").selectOption("30");
  await rules.getByLabel("Cancel or move a booking").selectOption("12");
  await rules.getByRole("button", { name: "Save rules" }).click();
  await expect(rules.getByRole("status")).toHaveText("Saved.");
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.reload();
  await expect(details.getByLabel("Time zone")).toHaveValue("Asia/Dubai");
  await expect(rules.getByLabel("Book how far ahead (days)")).toHaveValue("30");

  // The web address never changes.
  await expect(page).toHaveURL(new RegExp(`/dashboard/b/${business.slug}$`));

  const staffPage = await (await browser.newContext()).newPage();
  await signInAs(staffPage, staff);
  await staffPage.goto(`/dashboard/b/${business.slug}`);
  const staffRules = staffPage.getByRole("region", { name: "Booking rules" });
  await expect(staffRules).toContainText("At least 2 h ahead");
  await expect(staffRules).toContainText("Up to 30 days");
  await expect(staffRules).toContainText("Every 30 min");
  await expect(staffRules).toContainText("Up to 12 h before it starts");
  await expect(
    staffPage.getByRole("button", { name: "Save rules" }),
  ).toHaveCount(0);
});
