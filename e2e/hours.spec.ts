import { expect, type Page, test } from "@playwright/test";
import { accessibilityViolations } from "./support/accessibility";
import {
  addMember,
  addStaffMember,
  createBusinessFor,
  setHoursFor,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

function day(page: Page, name: string) {
  return page
    .getByRole("group", { name: "Hours for each day" })
    .locator("div")
    .filter({
      has: page.getByText(name, { exact: true }),
    })
    .first();
}

test("an owner sets split shifts and open-until-midnight hours", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Nour Salon"),
  );

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/hours`);
  await expect(
    page.getByRole("heading", { name: "Business hours" }),
  ).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.getByRole("button", { name: "Add hours on Sunday" }).click();
  await page.getByLabel("Sunday opens at").fill("10:00");
  await page.getByLabel("Sunday closes at").fill("14:00");
  await page.getByRole("button", { name: "Add hours on Sunday" }).click();
  await page.getByLabel("Sunday opens at").nth(1).fill("16:00");
  await page.getByLabel("Sunday closes at").nth(1).fill("21:00");
  await page.getByRole("button", { name: "Add hours on Monday" }).click();
  await page.getByLabel("Monday opens at").fill("12:00");
  // 00:00 closing means midnight.
  await page.getByLabel("Monday closes at").fill("00:00");
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  await page.reload();
  await expect(page.getByLabel("Sunday opens at")).toHaveCount(2);
  await expect(page.getByLabel("Sunday closes at").nth(1)).toHaveValue("21:00");
  await expect(page.getByLabel("Monday closes at")).toHaveValue("00:00");
  await expect(day(page, "Tuesday")).toContainText("Closed");
});

test("overlapping hours are explained and nothing is saved", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Rose Studio"),
  );
  await setHoursFor(business.id, null, [
    { weekday: 3, opens_at: "09:00", closes_at: "17:00" },
  ]);

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/hours`);
  await page.getByRole("button", { name: "Add hours on Wednesday" }).click();
  await page.getByLabel("Wednesday opens at").nth(1).fill("16:00");
  await page.getByLabel("Wednesday closes at").nth(1).fill("20:00");
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(formError(page)).toHaveText("On Wednesday, the hours overlap.");

  await page.reload();
  await expect(page.getByLabel("Wednesday opens at")).toHaveCount(1);
});

test("a staff member gets their own hours, then goes back to the business's", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Cedar Clinic"),
  );
  await setHoursFor(business.id, null, [
    { weekday: 1, opens_at: "09:00", closes_at: "17:00" },
  ]);
  await addStaffMember(business.id, "Dr. Sami");

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/hours`);
  await page.getByRole("link", { name: "Dr. Sami" }).click();
  await expect(
    page.getByRole("heading", { name: "Dr. Sami's hours" }),
  ).toBeVisible();
  const usesBusinessHours = page.getByRole("checkbox", {
    name: "Dr. Sami works the business's hours",
  });
  await expect(usesBusinessHours).toBeChecked();

  // Their own hours start as a copy of the business's.
  await usesBusinessHours.uncheck();
  await expect(page.getByLabel("Monday opens at")).toHaveValue("09:00");
  await page.getByLabel("Monday opens at").fill("13:00");
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(
    page.getByRole("link", { name: "Dr. Sami (own hours)" }),
  ).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);

  await usesBusinessHours.check();
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(
    page.getByRole("link", { name: "Dr. Sami", exact: true }),
  ).toBeVisible();
});

test("staff see the hours but can't change them", async ({ page }) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Lotus Spa"),
  );
  await addMember(business.id, staff.email, "staff");
  await setHoursFor(business.id, null, [
    { weekday: 6, opens_at: "11:00", closes_at: "19:00" },
  ]);

  await signInAs(page, staff);
  await page.goto(`/dashboard/b/${business.slug}/hours`);
  await expect(page.getByText("Saturday")).toBeVisible();
  await expect(page.getByText("11:00-19:00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save hours" })).toHaveCount(0);
});
