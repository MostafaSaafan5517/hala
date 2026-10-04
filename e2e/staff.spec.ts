import { expect, type Page, test } from "@playwright/test";
import { accessibilityViolations } from "./support/accessibility";
import {
  addMember,
  addService,
  addStaffMember,
  archiveService,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

function staffItem(page: Page, name: string) {
  return page
    .getByRole("region", { name: "Staff" })
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}

/** The services listed under a staff member, one item each. */
function servicesOf(page: Page, name: string) {
  return staffItem(page, name)
    .getByRole("list", { name: `Services ${name} performs` })
    .getByRole("listitem");
}

test("an owner adds a staff member and chooses the services they perform", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Nour Salon"),
  );
  await addService(business.id, { nameEn: "Haircut" });
  await addService(business.id, { nameAr: "صبغة الشعر" });
  await addService(business.id, { nameEn: "Manicure" });

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/staff`);
  await expect(page.getByText("No staff yet.")).toBeVisible();
  await page.getByRole("link", { name: "New staff member" }).click();
  await expect(page).toHaveURL(/\/staff\/new$/);
  await expect(page).toHaveTitle(/New staff member/);
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.getByRole("checkbox", { name: "Haircut" }).check();
  await page.getByRole("checkbox", { name: "صبغة الشعر" }).check();
  // Only spaces: the browser lets it through, the server doesn't. The ticked services stay ticked.
  await page.getByLabel("Name").fill("   ");
  await page.getByRole("button", { name: "Add staff member" }).click();
  await expect(formError(page)).toHaveText("Enter the staff member's name.");
  await expect(page.getByRole("checkbox", { name: "Haircut" })).toBeChecked();

  await page.getByLabel("Name").fill("ليلى");
  await page.getByRole("button", { name: "Add staff member" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/dashboard/b/${business.slug}/staff$`),
  );
  await expect(servicesOf(page, "ليلى")).toHaveText(["Haircut", "صبغة الشعر"]);
  expect(await accessibilityViolations(page)).toEqual([]);
});

test("owners rename staff, change their services, and archive them", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Rose Studio"),
  );
  const haircut = await addService(business.id, { nameEn: "Haircut" });
  await addService(business.id, { nameEn: "Manicure" });
  await addStaffMember(business.id, "Omar", [haircut]);

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/staff`);
  await staffItem(page, "Omar").getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("checkbox", { name: "Haircut" })).toBeChecked();
  await page.getByLabel("Name").fill("Omar Khaled");
  await page.getByRole("checkbox", { name: "Haircut" }).uncheck();
  await page.getByRole("checkbox", { name: "Manicure" }).check();
  await page.getByRole("button", { name: "Save staff member" }).click();

  const omar = staffItem(page, "Omar Khaled");
  await expect(servicesOf(page, "Omar Khaled")).toHaveText(["Manicure"]);

  await omar.getByRole("button", { name: "Archive" }).click();
  await expect(omar).toContainText("Archived");
  await omar.getByRole("button", { name: "Restore" }).click();
  await expect(omar).not.toContainText("Archived");
});

test("an archived service a staff member still performs survives an edit", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Lotus Spa"),
  );
  const facial = await addService(business.id, { nameEn: "Facial" });
  await addStaffMember(business.id, "Sara", [facial]);
  await archiveService(facial);

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/staff`);
  await staffItem(page, "Sara").getByRole("link", { name: "Edit" }).click();
  const facialBox = page.getByRole("checkbox", { name: "Facial" });
  await expect(facialBox).toBeChecked();
  await expect(page.getByText("(archived)")).toBeVisible();
  await page.getByLabel("Name").fill("Sara M.");
  await page.getByRole("button", { name: "Save staff member" }).click();

  await expect(servicesOf(page, "Sara M.")).toHaveText(["Facial"]);
});

test("staff see the team but can't change it", async ({ page }) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Amber Salon"),
  );
  await addMember(business.id, staff.email, "staff");
  const staffId = await addStaffMember(business.id, "Hana");

  await signInAs(page, staff);
  await page.goto(`/dashboard/b/${business.slug}/staff`);
  await expect(staffItem(page, "Hana")).toContainText("No services yet");
  await expect(
    page.getByRole("link", { name: "New staff member" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

  for (const path of ["staff/new", `staff/${staffId}`]) {
    const response = await page.goto(`/dashboard/b/${business.slug}/${path}`);
    expect(response?.status(), path).toBe(404);
  }
});
