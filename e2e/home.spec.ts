import { expect, test } from "@playwright/test";
import { appConfig } from "@/config/app";
import { accessibilityViolations } from "./support/accessibility";

test("the home page shows the product and passes accessibility checks", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(appConfig.name);
  await expect(
    page.getByRole("heading", { level: 1, name: appConfig.name }),
  ).toBeVisible();
  await expect(page.getByText(appConfig.description)).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);
});
