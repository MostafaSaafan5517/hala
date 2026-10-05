import { expect, test } from "@playwright/test";
import { accessibilityViolations } from "./support/accessibility";
import { addMember, createSalonFor } from "./support/businesses";
import { signInAs } from "./support/forms";
import { addDocument } from "./support/knowledge";
import { adminClient } from "./support/supabase";
import { createConfirmedUser } from "./support/users";

// The public demo's account: read-only, so visitors can look at everything and try the
// assistant, but change nothing. The database refuses its writes; the app says why.

test("a read-only account looks around and tries the assistant, but changes nothing", async ({
  page,
  browser,
}) => {
  test.slow();
  const owner = await createConfirmedUser();
  const business = await createSalonFor(owner);
  const ownerPage = await (await browser.newContext()).newPage();
  await signInAs(ownerPage, owner);
  await addDocument(ownerPage, business.slug, {
    kind: "faq",
    title: "Is there parking?",
    body: "Yes, free parking behind the salon.",
  });
  const demo = await createConfirmedUser("Demo Visitor", { readOnly: true });
  await addMember(business.id, demo.email, "admin");

  await signInAs(page, demo);
  await page.goto(`/dashboard/b/${business.slug}/services/new`);
  await expect(page.getByRole("note")).toContainText(
    "You're in the read-only demo",
  );
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.getByLabel("Name in English").fill("Shave");
  await page.getByLabel("Duration (minutes)").fill("30");
  await page.getByLabel("Price").fill("50");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page).toHaveURL(/\?read-only=1$/);
  await expect(
    page.getByRole("alert").filter({ hasText: "That change wasn't saved" }),
  ).toHaveText("That change wasn't saved: the demo account is read-only.");
  const { data: services } = await adminClient()
    .from("services")
    .select("name_en")
    .eq("business_id", business.id);
  expect(services).toEqual([{ name_en: "Haircut" }]);

  // The assistant still answers: only server code writes the conversation.
  await page.goto(`/dashboard/b/${business.slug}/assistant`);
  await page.getByRole("button", { name: "Start a test conversation" }).click();
  await expect(page).toHaveURL(/\/assistant\/[0-9a-f-]{36}$/);
  await page.getByRole("textbox").fill("Where is the parking?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("log")).toContainText(
    "Yes, free parking behind the salon.",
  );
});
