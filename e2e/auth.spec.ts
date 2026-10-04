import { expect, test } from "@playwright/test";
import { accessibilityViolations } from "./support/accessibility";
import { formError, signIn } from "./support/forms";
import { getEmailLink } from "./support/mailpit";
import {
  createConfirmedUser,
  TEST_PASSWORD,
  uniqueEmail,
} from "./support/users";

test("a new user signs up, confirms their email on another device, and lands on the dashboard", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("signup");

  await page.goto("/signup");
  expect(await accessibilityViolations(page)).toEqual([]);
  await page.getByLabel("Full name").fill("Casey Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);

  // Signing in before confirming explains what to do.
  await page.goto("/login");
  await signIn(page, email, TEST_PASSWORD);
  await expect(formError(page)).toHaveText(
    "Confirm your email first: open the link we sent you.",
  );

  // Opened in a fresh browser, like tapping the link on a phone: the token-hash link must not
  // depend on anything stored by the browser that signed up.
  const confirmLink = await getEmailLink(email, "/auth/confirm");
  const phone = await browser.newContext();
  const phonePage = await phone.newPage();
  await phonePage.goto(confirmLink);
  await expect(phonePage).toHaveURL(/\/dashboard$/);
  await expect(
    phonePage.getByRole("heading", { name: "Welcome, Casey Tester" }),
  ).toBeVisible();
  expect(await accessibilityViolations(phonePage)).toEqual([]);
  await phone.close();

  // Email links are single-use.
  const laptop = await browser.newContext();
  const laptopPage = await laptop.newPage();
  await laptopPage.goto(confirmLink);
  await expect(laptopPage).toHaveURL(/\/login\?error=link$/);
  await laptop.close();
});

test("sign-up explains what's wrong without losing what was typed", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Weak Password");
  await page.getByLabel("Email").fill(uniqueEmail("weak"));
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(formError(page)).toHaveText(
    "Use at least 8 characters, with letters and numbers.",
  );
  await expect(page.getByLabel("Full name")).toHaveValue("Weak Password");
});

test("a user signs in with their password and signs out", async ({ page }) => {
  const user = await createConfirmedUser("Pat Password");

  await page.goto("/login");
  expect(await accessibilityViolations(page)).toEqual([]);
  await signIn(page, user.email, "not-the-password-1");
  await expect(formError(page)).toHaveText("Wrong email or password.");

  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(`Signed in as ${user.email}`)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
});

test("a sign-in link can't send the user to another site", async ({ page }) => {
  const user = await createConfirmedUser();

  await page.goto("/login?next=//evil.example/steal");
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/^http:\/\/localhost:3100\/dashboard$/);
});
