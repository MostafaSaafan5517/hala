import { expect, type Page, test } from "@playwright/test";
import { accessibilityViolations } from "./support/accessibility";
import {
  addMember,
  addService,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

function serviceItem(page: Page, name: string) {
  return page
    .getByRole("region", { name: "Services" })
    .getByRole("listitem")
    .filter({ hasText: name });
}

test("an owner adds a service in English and Arabic, priced in their currency", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Nour Salon"),
  );

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/services`);
  await expect(page.getByText("No services yet.")).toBeVisible();
  await page.getByRole("link", { name: "New service" }).click();
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.getByLabel("Name in English").fill("Haircut");
  await page.getByLabel("Name in Arabic").fill("قص الشعر");
  await page.getByLabel("Duration (minutes)").fill("45");
  await page.getByLabel("Buffer after (minutes)").fill("15");
  // Typed with Arabic digits, as on an Arabic keyboard.
  await page.getByLabel("Price").fill("٢٥٠");
  await page.getByLabel("Currency").selectOption("EGP");
  await page.getByRole("button", { name: "Add service" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/dashboard/b/${business.slug}/services$`),
  );
  const haircut = serviceItem(page, "Haircut");
  await expect(haircut).toContainText("قص الشعر");
  await expect(haircut).toContainText(/EGP\s250\.00/);
  await expect(haircut).toContainText("45 min + 15 min buffer");
  await expect(haircut.locator('[lang="ar"]')).toHaveAttribute("dir", "rtl");
  expect(await accessibilityViolations(page)).toEqual([]);

  // The next service starts in the same currency.
  await page.getByRole("link", { name: "New service" }).click();
  await expect(page.getByLabel("Currency")).toHaveValue("EGP");
});

test("the service form explains what's wrong and keeps what was typed", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Rose Studio"),
  );

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/services/new`);
  await page.getByLabel("Duration (minutes)").fill("30");
  await page.getByLabel("Price").fill("100");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(formError(page)).toHaveText(
    "Give the service a name in English, Arabic or both.",
  );

  await page.getByLabel("Name in Arabic").fill("استشارة");
  await page.getByLabel("Currency").selectOption("EGP");
  await page.getByLabel("Price").fill("12.345");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(formError(page)).toHaveText(
    "Enter a price like 250 or 249.50 in EGP.",
  );
  await expect(page.getByLabel("Name in Arabic")).toHaveValue("استشارة");
  await expect(page.getByLabel("Duration (minutes)")).toHaveValue("30");

  // Kuwaiti dinars have three decimals.
  await page.getByLabel("Currency").selectOption("KWD");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(serviceItem(page, "استشارة")).toContainText(/KWD\s12\.345/);
});

test("owners edit, archive and restore services", async ({ page }) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Cedar Clinic"),
  );
  await addService(business.id, { nameEn: "Check-up", price: 20000 });

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/services`);
  await serviceItem(page, "Check-up")
    .getByRole("link", { name: "Edit" })
    .click();
  await expect(page.getByLabel("Price")).toHaveValue("200.00");
  await page.getByLabel("Price").fill("225");
  await page.getByLabel("Duration (minutes)").fill("40");
  await page.getByRole("button", { name: "Save service" }).click();

  const checkUp = serviceItem(page, "Check-up");
  await expect(checkUp).toContainText(/225\.00/);
  await expect(checkUp).toContainText("40 min");

  await checkUp.getByRole("button", { name: "Archive" }).click();
  await expect(checkUp).toContainText("Archived");
  await checkUp.getByRole("button", { name: "Restore" }).click();
  await expect(checkUp).not.toContainText("Archived");
});

test("staff see the services but can't change them", async ({ page }) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Lotus Spa"),
  );
  await addMember(business.id, staff.email, "staff");
  const serviceId = await addService(business.id, { nameEn: "Massage" });

  await signInAs(page, staff);
  await page.goto(`/dashboard/b/${business.slug}/services`);
  await expect(serviceItem(page, "Massage")).toBeVisible();
  await expect(page.getByRole("link", { name: "New service" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(0);

  for (const path of ["services/new", `services/${serviceId}`]) {
    const response = await page.goto(`/dashboard/b/${business.slug}/${path}`);
    expect(response?.status(), path).toBe(404);
  }
});

test("another business's service is a 404", async ({ page }) => {
  const owner = await createConfirmedUser();
  const otherOwner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Amber Salon"),
  );
  const other = await createBusinessFor(
    otherOwner,
    uniqueBusinessName("Jade Salon"),
  );
  const otherServiceId = await addService(other.id, { nameEn: "Secret" });

  await signInAs(page, owner);
  // Their own business's address, someone else's service id.
  const response = await page.goto(
    `/dashboard/b/${business.slug}/services/${otherServiceId}`,
  );
  expect(response?.status()).toBe(404);
});
