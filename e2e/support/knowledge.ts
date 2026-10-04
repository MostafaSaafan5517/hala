import { expect, type Page } from "@playwright/test";

/** Adds an FAQ or a policy through the Knowledge tab, as an owner or admin would. */
export async function addDocument(
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
