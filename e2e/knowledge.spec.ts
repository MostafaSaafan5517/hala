import { expect, type Page, test } from "@playwright/test";
import { accessibilityViolations } from "./support/accessibility";
import {
  addMember,
  createBusinessFor,
  uniqueBusinessName,
} from "./support/businesses";
import { formError, signInAs } from "./support/forms";
import { adminClient } from "./support/supabase";
import { createConfirmedUser } from "./support/users";

// The app runs with EMBEDDING_MODEL=offline here: search by meaning is word overlap, so these
// tests check the pipeline (indexing, search, isolation, logging), not answer quality.

async function addDocument(
  page: Page,
  slug: string,
  document: {
    kind: "faq" | "policy";
    language?: "en" | "ar";
    title: string;
    body: string;
  },
) {
  await page.goto(`/dashboard/b/${slug}/knowledge/new?kind=${document.kind}`);
  if (document.language) {
    await page.getByLabel("Written in").selectOption(document.language);
  }
  await page
    .getByLabel(document.kind === "faq" ? "Question" : "Title")
    .fill(document.title);
  await page
    .getByLabel(document.kind === "faq" ? "Answer" : "Text")
    .fill(document.body);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/knowledge\?saved=1$/);
}

async function ask(page: Page, question: string) {
  await page.getByLabel("Question", { exact: true }).fill(question);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByLabel("Question", { exact: true })).toHaveValue(
    question,
  );
}

function found(page: Page) {
  return page
    .getByRole("list", { name: "Passages found" })
    .getByRole("listitem");
}

test("owners build the knowledge base and see what a question finds", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Nour Salon"),
  );

  await signInAs(page, owner);
  await page.goto(`/dashboard/b/${business.slug}`);
  await page.getByRole("link", { name: "Knowledge" }).click();
  await expect(page.getByText("No FAQs yet.")).toBeVisible();
  await expect(page.getByText("No policies yet.")).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.getByRole("link", { name: "New FAQ" }).click();
  expect(await accessibilityViolations(page)).toEqual([]);
  await addDocument(page, business.slug, {
    kind: "faq",
    title: "Is there parking?",
    body: "Yes, free parking behind the salon.",
  });
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await addDocument(page, business.slug, {
    kind: "faq",
    language: "ar",
    title: "هل تقبلون الدفع بالبطاقة؟",
    body: "نعم، نقبل البطاقات والنقد.",
  });
  await addDocument(page, business.slug, {
    kind: "policy",
    title: "Cancellation policy",
    body: "Cancel up to a day before at no charge.\n\nLate cancellations are charged half the price.",
  });

  const faqs = page.getByRole("region", { name: "FAQs" });
  await expect(faqs.getByRole("listitem")).toHaveCount(2);
  await expect(faqs.getByRole("listitem").nth(1)).toContainText("العربية");
  await expect(
    page.getByRole("region", { name: "Policies" }).getByRole("listitem"),
  ).toContainText("Cancellation policy");
  expect(await accessibilityViolations(page)).toEqual([]);

  await ask(page, "Where is the parking?");
  await expect(found(page).first()).toContainText("Is there parking?");
  await expect(found(page).first()).toContainText("keyword match");
  await expect(found(page).first()).toContainText(
    "Yes, free parking behind the salon.",
  );
  expect(await accessibilityViolations(page)).toEqual([]);

  await ask(page, "الدفع بالبطاقة");
  await expect(found(page).first()).toContainText("هل تقبلون الدفع بالبطاقة؟");

  await ask(page, "What happens if I cancel late?");
  await expect(found(page).first()).toContainText("Cancellation policy");
  await expect(found(page).first()).toContainText("charged half the price");

  await ask(page, "Can I bring my dog?");
  await expect(
    page.getByText(
      "Nothing relevant found. The assistant would say it doesn't know",
    ),
  ).toBeVisible();

  // Every model call was logged: three documents indexed, four questions searched.
  const { data: calls, error } = await adminClient()
    .from("model_calls")
    .select("purpose, model, error")
    .eq("business_id", business.id);
  expect(error).toBeNull();
  expect(calls?.filter((call) => call.purpose === "index")).toHaveLength(3);
  expect(calls?.filter((call) => call.purpose === "search")).toHaveLength(4);
  expect(
    calls?.every((call) => call.model === "offline" && call.error === null),
  ).toBe(true);
});

test("editing re-indexes a document, and archived documents are never found", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Rose Studio"),
  );

  await signInAs(page, owner);
  await addDocument(page, business.slug, {
    kind: "faq",
    title: "How can I pay?",
    body: "Cash only.",
  });
  const faq = page.getByRole("region", { name: "FAQs" }).getByRole("listitem");

  await faq.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByLabel("Answer")).toHaveValue("Cash only.");
  await page.getByLabel("Answer").fill("");
  await page.getByLabel("Answer").fill("   ");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(formError(page)).toHaveText("Enter the answer.");

  await page.getByLabel("Answer").fill("Cash, or cards: Visa and Mastercard.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/knowledge\?saved=1$/);
  await ask(page, "Do you take Visa?");
  await expect(found(page).first()).toContainText(
    "Cash, or cards: Visa and Mastercard.",
  );

  await faq.getByRole("button", { name: "Archive" }).click();
  await expect(faq).toContainText("Archived");
  await ask(page, "Do you take Visa?");
  await expect(found(page)).toHaveCount(0);
  await expect(page.getByText("Nothing relevant found.")).toBeVisible();

  await faq.getByRole("button", { name: "Restore" }).click();
  await expect(faq).not.toContainText("Archived");
  await ask(page, "Visa?");
  await expect(found(page).first()).toContainText("How can I pay?");
});

test("staff can search the knowledge base but not change it", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const staff = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Cedar Clinic"),
  );
  await addMember(business.id, staff.email, "staff");

  await signInAs(page, owner);
  await addDocument(page, business.slug, {
    kind: "faq",
    title: "Do you open on Fridays?",
    body: "No, we are closed on Fridays.",
  });

  const staffPage = await (
    await page.context().browser()!.newContext()
  ).newPage();
  await signInAs(staffPage, staff);
  await staffPage.goto(`/dashboard/b/${business.slug}/knowledge`);
  await expect(staffPage.getByText("Do you open on Fridays?")).toBeVisible();
  await expect(staffPage.getByRole("link", { name: "New FAQ" })).toHaveCount(0);
  await expect(staffPage.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(staffPage.getByRole("button", { name: "Archive" })).toHaveCount(
    0,
  );
  await ask(staffPage, "Fridays?");
  await expect(found(staffPage).first()).toContainText(
    "Do you open on Fridays?",
  );

  const response = await staffPage.goto(
    `/dashboard/b/${business.slug}/knowledge/new?kind=faq`,
  );
  expect(response?.status()).toBe(404);
});

test("one business's knowledge is invisible to another", async ({ page }) => {
  const owner = await createConfirmedUser();
  const outsider = await createConfirmedUser();
  const business = await createBusinessFor(
    owner,
    uniqueBusinessName("Amber Salon"),
  );
  const other = await createBusinessFor(
    outsider,
    uniqueBusinessName("Other Salon"),
  );

  await signInAs(page, owner);
  await addDocument(page, business.slug, {
    kind: "faq",
    title: "Is there parking?",
    body: "Yes, free parking behind the salon.",
  });

  const outsiderPage = await (
    await page.context().browser()!.newContext()
  ).newPage();
  await signInAs(outsiderPage, outsider);
  await outsiderPage.goto(`/dashboard/b/${other.slug}/knowledge`);
  await ask(outsiderPage, "Is there parking?");
  await expect(outsiderPage.getByText("Nothing relevant found.")).toBeVisible();

  const response = await outsiderPage.goto(
    `/dashboard/b/${business.slug}/knowledge`,
  );
  expect(response?.status()).toBe(404);
});
