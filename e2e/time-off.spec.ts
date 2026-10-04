import { expect, type Page, test } from "@playwright/test";
import { formatDay, formatLocalDateTime } from "@/lib/dates";
import { accessibilityViolations } from "./support/accessibility";
import {
  addMember,
  addStaffMember,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signInAs } from "./support/forms";
import { adminClient } from "./support/supabase";
import { createConfirmedUser } from "./support/users";

/** A date `days` from now, as YYYY-MM-DD (dates in these tests are always in the future). */
function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function section(page: Page, name: string) {
  return page.getByRole("region", { name });
}

test("an owner closes the business for a holiday and removes it again", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Nour Salon"),
  );
  const first = daysFromNow(30);
  const last = daysFromNow(32);

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/time-off`);
  expect(await accessibilityViolations(page)).toEqual([]);
  const closures = section(page, "Closures");
  await closures.getByLabel("First day").fill(last);
  await closures.getByLabel("Last day").fill(first);
  await closures.getByRole("button", { name: "Add closure" }).click();
  await expect(closures.getByRole("alert")).toHaveText(
    "The last day can't be before the first.",
  );

  await closures.getByLabel("First day").fill(first);
  await closures.getByLabel("Last day").fill(last);
  await closures.getByLabel("Reason (optional)").fill("عيد الفطر");
  await closures.getByRole("button", { name: "Add closure" }).click();
  await expect(closures.getByRole("status")).toHaveText("Closure added.");
  const holiday = closures.getByRole("listitem");
  await expect(holiday).toContainText(
    `${formatDay(first)} to ${formatDay(last)}`,
  );
  await expect(holiday).toContainText("عيد الفطر");

  await holiday.getByRole("button", { name: "Remove" }).click();
  await expect(closures.getByText("No closures coming up.")).toBeVisible();
});

test("time off is entered in the business's local time and stored in UTC", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Cedar Clinic"),
    { timezone: "Africa/Cairo" },
  );
  await addStaffMember(business.id, "Dr. Sami");
  const day = daysFromNow(10);

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}/time-off`);
  const timeOff = section(page, "Staff time off");
  await expect(timeOff).toContainText("Times are in Africa/Cairo time.");
  await timeOff.getByLabel("From").fill(`${day}T14:00`);
  await timeOff.getByLabel("Until").fill(`${day}T10:00`);
  await timeOff.getByRole("button", { name: "Add time off" }).click();
  await expect(formError(page).last()).toHaveText(
    "The time off must end after it starts.",
  );

  await timeOff.getByLabel("From").fill(`${day}T10:00`);
  await timeOff.getByLabel("Until").fill(`${day}T14:00`);
  await timeOff.getByLabel("Reason (optional)").fill("Conference");
  await timeOff.getByRole("button", { name: "Add time off" }).click();
  await expect(timeOff.getByRole("status")).toHaveText("Time off added.");

  // Stored as UTC moments that read 10:00 and 14:00 in Cairo, whatever its offset that day.
  const { data, error } = await adminClient()
    .from("time_off")
    .select("starts_at, ends_at")
    .eq("business_id", business.id)
    .single();
  if (error) throw error;
  expect(formatLocalDateTime(data.starts_at, "Africa/Cairo")).toMatch(
    /, 10:00$/,
  );
  expect(formatLocalDateTime(data.ends_at, "Africa/Cairo")).toMatch(/, 14:00$/);

  const entry = timeOff.getByRole("listitem");
  await expect(entry).toContainText("Dr. Sami");
  await expect(entry).toContainText(
    `${formatLocalDateTime(data.starts_at, "Africa/Cairo")} to ${formatLocalDateTime(data.ends_at, "Africa/Cairo")}`,
  );
  await expect(entry).toContainText("Conference");
  expect(await accessibilityViolations(page)).toEqual([]);

  await entry.getByRole("button", { name: "Remove" }).click();
  await expect(timeOff.getByText("No time off coming up.")).toBeVisible();
});

test("past time off isn't listed, and staff can only look", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Lotus Spa"),
  );
  await addMember(business.id, staff.email, "staff");
  const staffId = await addStaffMember(business.id, "Hana");
  const { error } = await adminClient()
    .from("time_off")
    .insert([
      {
        business_id: business.id,
        staff_id: staffId,
        starts_at: "2020-01-01T08:00:00Z",
        ends_at: "2020-01-02T08:00:00Z",
        reason: "Long ago",
      },
      {
        business_id: business.id,
        staff_id: staffId,
        starts_at: `${daysFromNow(5)}T08:00:00Z`,
        ends_at: `${daysFromNow(6)}T08:00:00Z`,
        reason: "Coming up",
      },
    ]);
  if (error) throw error;

  await signInAs(page, staff);
  await page.goto(`/dashboard/b/${business.slug}/time-off`);
  const timeOff = section(page, "Staff time off");
  await expect(timeOff.getByRole("listitem")).toHaveCount(1);
  await expect(timeOff).toContainText("Coming up");
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add time off" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Add closure" })).toHaveCount(
    0,
  );
});
