import { expect, type Page, test } from "@playwright/test";
import { addDays, formatDay, todayIn } from "@/lib/dates";
import { accessibilityViolations } from "./support/accessibility";
import {
  addBooking,
  addMember,
  addService,
  addStaffMember,
  createBusinessFor,
  setHoursFor,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signInAs } from "./support/forms";
import { createConfirmedUser } from "./support/users";

// Riyadh is UTC+3 all year, so a local time maps to one UTC moment without daylight saving.
const timezone = "Asia/Riyadh";

function tomorrow() {
  return addDays(todayIn(timezone), 1);
}

/** A local time tomorrow in Riyadh, as an ISO moment. */
function tomorrowAt(time: string) {
  return new Date(`${tomorrow()}T${time}:00+03:00`).toISOString();
}

/** A salon open 09:00-17:00 every day, with a 45-minute haircut that Layla does. */
async function salonOf(owner: { email: string; password: string }) {
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Palm Salon"),
    { timezone },
  );
  const serviceId = await addService(business.id, {
    nameEn: "Haircut",
    duration: 45,
    price: 12000,
    currency: "SAR",
  });
  const laylaId = await addStaffMember(business.id, "Layla", [serviceId]);
  await setHoursFor(
    business.id,
    null,
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opens_at: "09:00",
      closes_at: "17:00",
    })),
  );
  return { business, serviceId, laylaId };
}

function times(page: Page) {
  return page.getByRole("group", { name: "Time" });
}

test("staff book an appointment and find it on the day's list", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const { business } = await salonOf(owner);
  await addMember(business.id, staff.email, "staff");

  await signInAs(page, staff);
  await page.goto(`/dashboard/b/${business.slug}`);
  await page.getByRole("link", { name: "Bookings" }).click();
  await expect(page.getByText("No bookings on this day.")).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.getByRole("link", { name: "New booking" }).click();
  await page.getByLabel("Service").selectOption({ label: "Haircut" });
  await page.getByLabel("Day").fill(tomorrow());
  await page.getByRole("button", { name: "Show free times" }).click();
  await expect(times(page).getByRole("radio", { name: "09:00" })).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);

  await times(page).getByRole("radio", { name: "10:00" }).check();
  await page.getByLabel("Customer name").fill("Mona Adel");
  await page.getByLabel("Phone, with country code").fill("+966 50 123 4567");
  await page.getByLabel("Speaks").selectOption("ar");
  await page.getByRole("button", { name: "Book appointment" }).click();

  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}\?booked=1$/);
  await expect(page.getByRole("status")).toHaveText("Booked.");
  await expect(
    page.getByRole("heading", { name: /^Booking [2-9A-HJ-NP-Z]{6}$/ }),
  ).toBeVisible();
  const details = page.getByRole("region", { name: /^Booking/ });
  await expect(details).toContainText("10:00 to 10:45");
  await expect(details).toContainText("Layla");
  await expect(details).toContainText("+966 50 123 4567");
  await expect(details).toContainText("العربية");
  await expect(details).toContainText(/SAR\s120\.00/);
  expect(await accessibilityViolations(page)).toEqual([]);

  await page
    .getByRole("link", { name: `All bookings on ${formatDay(tomorrow())}` })
    .click();
  const booking = page.getByRole("listitem");
  await expect(booking).toContainText("10:00–10:45");
  await expect(booking).toContainText("Mona Adel · Haircut with Layla");

  // The booked time (and anything that would overlap it) is no longer offered.
  await page.getByRole("link", { name: "New booking" }).click();
  await page.getByLabel("Service").selectOption({ label: "Haircut" });
  await page.getByRole("button", { name: "Show free times" }).click();
  await expect(times(page).getByRole("radio", { name: "10:45" })).toBeVisible();
  for (const taken of ["09:30", "10:00", "10:30"]) {
    await expect(times(page).getByRole("radio", { name: taken })).toHaveCount(
      0,
    );
  }
});

test("a phone number needs its country code", async ({ page }) => {
  const owner = await createConfirmedUser();
  const { business, serviceId } = await salonOf(owner);

  await signInAs(page, owner);
  await page.goto(
    `/dashboard/b/${business.slug}/bookings/new?service=${serviceId}&day=${tomorrow()}`,
  );
  await times(page).getByRole("radio", { name: "10:00" }).check();
  await page.getByLabel("Customer name").fill("Mona Adel");
  await page.getByLabel("Phone, with country code").fill("050 123 4567");
  await page.getByRole("button", { name: "Book appointment" }).click();

  await expect(formError(page)).toHaveText(
    "Enter the phone number with its country code, like +20 10 1234 5678.",
  );
  await expect(page.getByLabel("Customer name")).toHaveValue("Mona Adel");
});

test("a time someone else books while the form is open is refused, and drops off the list", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const { business, serviceId, laylaId } = await salonOf(owner);

  await signInAs(page, owner);
  await page.goto(
    `/dashboard/b/${business.slug}/bookings/new?service=${serviceId}&day=${tomorrow()}`,
  );
  await times(page).getByRole("radio", { name: "11:00" }).check();
  await page.getByLabel("Customer name").fill("Sara Ali");
  await page.getByLabel("Phone, with country code").fill("+966 55 765 4321");

  // Meanwhile, the assistant books that time for someone else.
  await addBooking(serviceId, tomorrowAt("11:00"), { staffId: laylaId });
  await page.getByRole("button", { name: "Book appointment" }).click();

  await expect(formError(page)).toHaveText(
    "That time has just been booked. Choose another time.",
  );
  await expect(times(page).getByRole("radio", { name: "11:00" })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Customer name")).toHaveValue("Sara Ali");
});

test("staff move a booking, then cancel it", async ({ page }) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const { business, serviceId, laylaId } = await salonOf(owner);
  await addMember(business.id, staff.email, "staff");
  const bookingId = await addBooking(serviceId, tomorrowAt("12:00"), {
    staffId: laylaId,
    customerName: "Omar Said",
  });

  await signInAs(page, staff);
  await page.goto(`/dashboard/b/${business.slug}/bookings/${bookingId}`);
  const details = page.getByRole("region", { name: /^Booking/ });
  await expect(details).toContainText("12:00 to 12:45");
  expect(await accessibilityViolations(page)).toEqual([]);

  const move = page.getByRole("region", { name: "Move booking" });
  // Its own time isn't offered, but times overlapping it are.
  await expect(move.getByRole("radio", { name: "12:00" })).toHaveCount(0);
  await move.getByRole("radio", { name: "12:15" }).check();
  await move.getByRole("button", { name: "Move booking" }).click();
  await expect(page).toHaveURL(/\?moved=1$/);
  await expect(page.getByRole("status")).toHaveText("Moved.");
  await expect(details).toContainText("12:15 to 13:00");

  await page.getByRole("button", { name: "Cancel booking" }).click();
  await expect(details).toContainText("Cancelled on");
  await expect(page.getByRole("region", { name: "Move booking" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Cancel booking" }),
  ).toHaveCount(0);

  await page
    .getByRole("link", { name: `All bookings on ${formatDay(tomorrow())}` })
    .click();
  await expect(page.getByRole("listitem")).toContainText("Cancelled");
});

test("other businesses cannot open a booking", async ({ page }) => {
  const owner = await createConfirmedUser();
  const outsider = await createConfirmedUser();
  const { business, serviceId } = await salonOf(owner);
  const bookingId = await addBooking(serviceId, tomorrowAt("14:00"));

  await signInAs(page, outsider);
  const response = await page.goto(
    `/dashboard/b/${business.slug}/bookings/${bookingId}`,
  );
  expect(response?.status()).toBe(404);
});
