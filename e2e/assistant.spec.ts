import { expect, type Page, test } from "@playwright/test";
import { addDays, todayIn } from "@/lib/dates";
import { accessibilityViolations } from "./support/accessibility";
import {
  addService,
  addStaffMember,
  createBusinessFor,
  setHoursFor,
  uniqueBusinessName,
} from "./support/businesses";
import { signInAs } from "./support/forms";
import { addDocument } from "./support/knowledge";
import { adminClient } from "./support/supabase";
import { createConfirmedUser } from "./support/users";

// The app runs with CHAT_MODEL=offline here: a rule-based model that answers from the knowledge
// base, and books from one exact request. These tests check the conversation, the citations, the
// on-screen approval and the access rules; answer quality is the evaluation suite's job.

const timezone = "Asia/Riyadh";

async function salonFor(owner: { email: string; password: string }) {
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
  await addStaffMember(business.id, "Layla", [serviceId]);
  await setHoursFor(
    business.id,
    null,
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opens_at: "09:00",
      closes_at: "17:00",
    })),
  );
  return business;
}

async function startConversation(page: Page, slug: string) {
  await page.goto(`/dashboard/b/${slug}/assistant`);
  await page.getByRole("button", { name: "Start a test conversation" }).click();
  await expect(page).toHaveURL(/\/assistant\/[0-9a-f-]{36}$/);
}

async function say(page: Page, text: string) {
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

function conversation(page: Page) {
  return page.getByRole("log", { name: "Conversation" });
}

test("members test the assistant: it answers from the knowledge base and cites it", async ({
  page,
}) => {
  // A whole conversation, with its setup: more than the default time under parallel load.
  test.slow();
  const owner = await createConfirmedUser();
  const business = await salonFor(owner);

  await signInAs(page, owner);
  await addDocument(page, business.slug, {
    kind: "faq",
    title: "Is there parking?",
    body: "Yes, free parking behind the salon.",
  });
  await page.goto(`/dashboard/b/${business.slug}`);
  await page.getByRole("link", { name: "Assistant" }).click();
  await expect(page.getByText("None yet.")).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.getByRole("button", { name: "Start a test conversation" }).click();
  await expect(page).toHaveURL(/\/assistant\/[0-9a-f-]{36}$/);
  await say(page, "Where is the parking?");
  await expect(conversation(page)).toContainText(
    "Yes, free parking behind the salon.",
  );
  await expect(conversation(page)).toContainText("[1]");
  await expect(conversation(page)).toContainText(
    "Sources: [1] Is there parking?",
  );
  expect(await accessibilityViolations(page)).toEqual([]);

  await say(page, "Can I bring my dog?");
  await expect(conversation(page)).toContainText("I don't know");

  // The conversation is kept: it's all there after a reload.
  await page.reload();
  await expect(conversation(page)).toContainText("Where is the parking?");
  await expect(conversation(page)).toContainText("I don't know");
});

test("a booking happens only when the customer confirms it on screen", async ({
  page,
}) => {
  test.slow();
  const owner = await createConfirmedUser();
  const business = await salonFor(owner);
  const tomorrow = addDays(todayIn(timezone), 1);

  await signInAs(page, owner);
  await startConversation(page, business.slug);
  await say(
    page,
    `book Haircut on ${tomorrow} at 10:00 for Mona Adel, +966 50 123 4567`,
  );
  const card = conversation(page).getByRole("group", { name: "Confirm" });
  await expect(card).toContainText("Haircut");
  await expect(card).toContainText("10:00 to 10:45");
  await expect(card).toContainText("for Mona Adel (+966 50 123 4567)");
  expect(await accessibilityViolations(page)).toEqual([]);

  await card.getByRole("button", { name: "Confirm" }).click();
  await expect(conversation(page)).toContainText(
    /Booked! Your reference is [2-9A-HJ-NP-Z]{6}\./,
  );
  await expect(conversation(page)).toContainText(/Booked · [2-9A-HJ-NP-Z]{6}/);

  await say(
    page,
    `book Haircut on ${tomorrow} at 11:00 for Mona Adel, +966 50 123 4567`,
  );
  await conversation(page)
    .getByRole("group", { name: "Confirm" })
    .getByRole("button", { name: "Not now" })
    .click();
  await expect(conversation(page)).toContainText("I haven't booked it.");

  const { data: bookings } = await adminClient()
    .from("bookings")
    .select("starts_at")
    .eq("business_id", business.id);
  expect(bookings).toHaveLength(1);

  await page.goto(`/dashboard/b/${business.slug}/bookings?day=${tomorrow}`);
  await expect(page.getByRole("listitem")).toContainText(
    "Mona Adel · Haircut with Layla",
  );
});

test("a business's conversations are private to it", async ({
  page,
  request,
}) => {
  const owner = await createConfirmedUser();
  const outsider = await createConfirmedUser();
  const business = await salonFor(owner);

  await signInAs(page, owner);
  await startConversation(page, business.slug);
  const url = page.url();
  const conversationId = url.slice(url.lastIndexOf("/") + 1);

  // Signed out: the chat endpoint refuses.
  const anonymous = await request.post(`/api/assistant/${conversationId}`, {
    data: { text: "Hello" },
  });
  expect(anonymous.status()).toBe(401);

  const outsiderPage = await (
    await page.context().browser()!.newContext()
  ).newPage();
  await signInAs(outsiderPage, outsider);
  expect((await outsiderPage.goto(url))?.status()).toBe(404);
  const forbidden = await outsiderPage.request.post(
    `/api/assistant/${conversationId}`,
    { data: { text: "Hello" } },
  );
  expect(forbidden.status()).toBe(404);
});
