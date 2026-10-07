import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
  expect,
  test,
  type FrameLocator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { chatLabels } from "@/components/chat/labels";
import { demoConfig } from "@/config/demo";
import { slugify } from "@/lib/slug";
import { accessibilityViolations } from "../../e2e/support/accessibility";
import { adminClient } from "../../e2e/support/supabase";
import {
  emptyBusiness,
  ensureBusiness,
  ensureUser,
  frontDesk,
  newOwner,
  outDir,
  resetDemo,
  riyadhDay,
  spentBusiness,
  spentOwner,
  staffPage,
  visitorPage,
} from "./support";

// Every screen and state of the app, at the project's size (desktop, then mobile), saved as
// <SCREENS_DIR>/<area>-<nn>-<screen>-<project>.jpg with axe's findings for each page. Run with
// playwright.screens.config.ts. The demo salon is reset first, so every run starts from the same
// state.

test.describe.configure({ mode: "serial" });

const axeFindings: Record<string, string[]> = {};

async function shot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options: { fullPage?: boolean; axe?: boolean } = {},
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // Away from whatever was clicked last, so nothing is caught in its hover state.
  await page.mouse.move(
    1,
    Math.floor((page.viewportSize()?.height ?? 800) / 2),
  );
  if (options.axe) {
    axeFindings[name] = await accessibilityViolations(page);
  }
  mkdirSync(outDir, { recursive: true });
  await page.screenshot({
    path: path.join(outDir, `${name}-${testInfo.project.name}.jpg`),
    type: "jpeg",
    quality: 80,
    fullPage: options.fullPage ?? false,
    animations: "disabled",
    caret: "hide",
  });
}

/**
 * Sends a message and waits for the whole reply: until one more reply is in the log, and the
 * chat can send again. (Send alone can look enabled for a moment before the reply starts.)
 */
async function ask(
  chat: FrameLocator | Page,
  text: string,
  language: "en" | "ar" = "en",
) {
  const labels = chatLabels[language];
  const replies = chat
    .getByRole("log")
    .getByText(labels.assistant, { exact: true });
  const before = await replies.count();
  await chat.getByRole("textbox").fill(text);
  await chat.getByRole("button", { name: labels.send }).click();
  await expect(replies).toHaveCount(before + 1);
  await expect(chat.getByRole("button", { name: labels.send })).toBeEnabled();
}

async function openDemoChat(page: Page) {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Chat with us" }).click();
  const chat = page.frameLocator("#hala-widget-frame");
  await expect(chat.getByRole("button", { name: "Send" })).toBeEnabled();
  return chat;
}

/** The id of the conversation the visitor on `page` has with the demo salon. */
async function demoConversationOf(page: Page) {
  const frame = page
    .frames()
    .find((candidate) => candidate.url().includes("/widget/"));
  if (!frame) throw new Error("No chat frame on the page");
  const token = await frame.evaluate(
    (key) => window.localStorage.getItem(key),
    `hala:${demoConfig.slug}:conversation`,
  );
  if (!token) throw new Error("The visitor has no conversation yet");
  const { data, error } = await adminClient()
    .from("conversations")
    .select("id")
    .eq("visitor_token_hash", createHash("sha256").update(token).digest("hex"))
    .single();
  if (error) throw error;
  return data.id;
}

test("setup: reset the demo and the screenshot accounts", async ({
  request,
}) => {
  await resetDemo(request);
  const admin = adminClient();

  await ensureUser(newOwner);
  await ensureBusiness(newOwner, emptyBusiness);

  await ensureUser(spentOwner);
  const spentId = await ensureBusiness(spentOwner, spentBusiness);
  const enabled = await admin
    .from("businesses")
    .update({ widget_enabled: true })
    .eq("id", spentId);
  if (enabled.error) throw enabled.error;
  // More than the daily budget, today: the next customer message gets the fixed reply.
  const spent = await admin.from("model_calls").insert({
    business_id: spentId,
    purpose: "chat",
    model: "offline",
    input_tokens: 0,
    latency_ms: 0,
    cost_usd: 100,
  });
  if (spent.error) throw spent.error;
});

test("widget in English: closed, open, an answer, a booking, an error", async ({
  browser,
}, testInfo) => {
  const page = await visitorPage(browser);
  await page.goto("/demo");
  await shot(page, testInfo, "demo-01-page", { fullPage: true, axe: true });
  await shot(page, testInfo, "widget-01-closed", { axe: true });

  const chat = await openDemoChat(page);
  await shot(page, testInfo, "widget-02-open-en", { axe: true });

  await ask(chat, "Is there parking?");
  await expect(chat.getByRole("log")).toContainText(
    "parking behind the building",
  );
  await shot(page, testInfo, "widget-03-answer-en", { axe: true });

  await chat
    .getByRole("textbox")
    .fill(
      `book Haircut on ${riyadhDay(3)} at 17:00 for Sara Al-Qahtani, +966 55 123 4567`,
    );
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByRole("button", { name: "Confirm" })).toBeVisible();
  await shot(page, testInfo, "widget-04-confirm-en", { axe: true });

  await chat.getByRole("button", { name: "Confirm" }).click();
  await expect(chat.getByRole("log")).toContainText("Booked ·");
  await expect(chat.getByRole("button", { name: "Send" })).toBeEnabled();
  await shot(page, testInfo, "widget-05-booked-en", { axe: true });

  await page.route("**/api/widget/*/chat", (route) => route.abort());
  await chat.getByRole("textbox").fill("Thank you");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(
    chat.getByRole("alert").filter({ hasText: "Something went wrong" }),
  ).toBeVisible();
  await shot(page, testInfo, "widget-06-error-en", { axe: true });
  await page.context().close();
});

test("widget in Arabic: open, an answer, a booking", async ({
  browser,
}, testInfo) => {
  const page = await visitorPage(browser);
  const chat = await openDemoChat(page);
  await chat.getByRole("button", { name: "العربية" }).click();
  await expect(chat.getByRole("button", { name: "إرسال" })).toBeEnabled();
  await shot(page, testInfo, "widget-07-open-ar", { axe: true });

  await ask(chat, "هل يوجد موقف للسيارات؟", "ar");
  await expect(chat.getByRole("log")).toContainText("موقف");
  await shot(page, testInfo, "widget-08-answer-ar", { axe: true });

  await chat
    .getByRole("textbox")
    .fill(
      `book قص شعر on ${riyadhDay(3)} at 18:00 for سارة القحطاني, +966 55 765 4321`,
    );
  await chat.getByRole("button", { name: "إرسال" }).click();
  await expect(chat.getByRole("button", { name: "تأكيد" })).toBeVisible();
  await shot(page, testInfo, "widget-09-confirm-ar", { axe: true });

  await chat.getByRole("button", { name: "تأكيد" }).click();
  await expect(chat.getByRole("log")).toContainText("تم الحجز");
  await expect(chat.getByRole("button", { name: "إرسال" })).toBeEnabled();
  await shot(page, testInfo, "widget-10-booked-ar", { axe: true });
  await page.context().close();
});

test("widget and inbox: waiting for the team, taken over, a reply, closed", async ({
  browser,
}, testInfo) => {
  const visitor = await visitorPage(browser);
  const chat = await openDemoChat(visitor);
  await ask(chat, "Can I speak to someone at the salon?");

  const conversationId = await demoConversationOf(visitor);
  const handed = await adminClient()
    .from("conversations")
    .update({ status: "needs_human" })
    .eq("id", conversationId);
  if (handed.error) throw handed.error;
  await expect(chat.getByText("We've asked the team to join.")).toBeVisible();
  await shot(visitor, testInfo, "widget-11-waiting-en", { axe: true });

  const staff = await staffPage(browser, frontDesk);
  const inbox = `/dashboard/b/${demoConfig.slug}/inbox`;
  await staff.goto(inbox);
  await shot(staff, testInfo, "inbox-01-list", { axe: true });
  await staff.goto(`${inbox}/${conversationId}`);
  await shot(staff, testInfo, "inbox-02-conversation", {
    fullPage: true,
    axe: true,
  });
  await staff.getByRole("button", { name: "Take over" }).click();
  await expect(staff.getByLabel("Reply to the customer")).toBeVisible();
  await shot(staff, testInfo, "inbox-03-taken-over", {
    fullPage: true,
    axe: true,
  });
  await staff
    .getByLabel("Reply to the customer")
    .fill("Hi, this is Rana at the front desk. How can I help?");
  await staff.getByRole("button", { name: "Send reply" }).click();
  await expect(staff.getByRole("button", { name: "Send reply" })).toBeEnabled();
  await shot(staff, testInfo, "inbox-04-replied", { fullPage: true });

  await expect(chat.getByRole("log")).toContainText("Rana at the front desk");
  await shot(visitor, testInfo, "widget-12-team-en", { axe: true });

  await staff.getByRole("button", { name: "Close conversation" }).click();
  await expect(chat.getByText("This conversation has ended.")).toBeVisible();
  await shot(visitor, testInfo, "widget-13-ended-en", { axe: true });
  await visitor.context().close();
  await staff.context().close();
});

test("widget limits and errors: budget spent, too many conversations, unknown business", async ({
  browser,
}, testInfo) => {
  const spent = await visitorPage(browser);
  await spent.goto(`/widget/${slugify(spentBusiness)}`);
  await expect(spent.getByRole("button", { name: "Send" })).toBeEnabled();
  await ask(spent, "Hello, can I book a session?");
  await expect(spent.getByRole("log")).toContainText(
    "Hello, can I book a session?",
  );
  await shot(spent, testInfo, "widget-14-budget-spent-en", { axe: true });
  await spent.context().close();

  const busy = await visitorPage(browser);
  const chat = await openDemoChat(busy);
  await busy.route("**/api/widget/*/conversations", (route) =>
    route.fulfill({ status: 429, body: "{}" }),
  );
  await chat.getByRole("textbox").fill("Hello");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(
    chat.getByRole("alert").filter({ hasText: "several conversations" }),
  ).toBeVisible();
  await shot(busy, testInfo, "widget-15-too-many-en", { axe: true });

  await busy.goto("/widget/no-such-business");
  await shot(busy, testInfo, "widget-16-unknown-business", { axe: true });
  await busy.context().close();
});

test("public pages: home, sign in, sign up, check email, not found", async ({
  browser,
}, testInfo) => {
  const page = await (await browser.newContext()).newPage();
  const pages: [string, string, boolean?][] = [
    ["/", "public-01-home", true],
    ["/login", "auth-01-login"],
    ["/login?error=link", "auth-02-login-link-error"],
    ["/login?confirmed=1&next=%2Fdashboard", "auth-03-login-confirmed"],
    ["/signup", "auth-04-signup"],
    ["/check-email", "auth-06-check-email"],
    ["/no-such-page", "public-02-not-found"],
  ];
  for (const [url, name, fullPage] of pages) {
    await page.goto(url);
    await shot(page, testInfo, name, { fullPage, axe: true });
  }
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Weak Password");
  await page.getByLabel("Email").fill("weak.password@example.test");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "8 characters" }),
  ).toBeVisible();
  await shot(page, testInfo, "auth-05-signup-error", { axe: true });
  await page.context().close();
});

test("dashboard as a member of the demo salon", async ({
  browser,
}, testInfo) => {
  const page = await staffPage(browser, frontDesk);
  const salon = `/dashboard/b/${demoConfig.slug}`;
  await shot(page, testInfo, "dash-01-businesses", { axe: true });
  await page.goto("/dashboard/new-business");
  await shot(page, testInfo, "dash-02-new-business", { axe: true });
  await page.goto(salon);
  await shot(page, testInfo, "dash-03-overview", { fullPage: true, axe: true });

  await page.goto(`${salon}/bookings?day=${riyadhDay(1)}`);
  await shot(page, testInfo, "dash-04-bookings", { fullPage: true, axe: true });
  await page
    .getByRole("link", { name: /Mona Adel/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}/);
  await shot(page, testInfo, "dash-05-booking", { fullPage: true, axe: true });
  await page.goto(`${salon}/bookings/new`);
  await shot(page, testInfo, "dash-06-new-booking", {
    fullPage: true,
    axe: true,
  });

  await page.goto(`${salon}/services`);
  await shot(page, testInfo, "dash-07-services", { fullPage: true, axe: true });
  await page
    .locator(`a[href^="${salon}/services/"]:not([href*="/new"])`)
    .first()
    .click();
  await expect(page).toHaveURL(/\/services\/[0-9a-f-]{36}/);
  await shot(page, testInfo, "dash-08-service", { fullPage: true, axe: true });

  await page.goto(`${salon}/staff`);
  await shot(page, testInfo, "dash-09-staff", { fullPage: true, axe: true });
  await page
    .locator(`a[href^="${salon}/staff/"]:not([href*="/new"])`)
    .first()
    .click();
  await expect(page).toHaveURL(/\/staff\/[0-9a-f-]{36}/);
  await shot(page, testInfo, "dash-10-staff-member", {
    fullPage: true,
    axe: true,
  });

  await page.goto(`${salon}/hours`);
  await shot(page, testInfo, "dash-11-hours", { fullPage: true, axe: true });
  await page.goto(`${salon}/time-off`);
  await shot(page, testInfo, "dash-12-time-off", { fullPage: true, axe: true });

  await page.goto(`${salon}/knowledge`);
  await shot(page, testInfo, "dash-13-knowledge", {
    fullPage: true,
    axe: true,
  });
  await page.locator("#q").fill("Is there parking?");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(
    page.getByRole("list", { name: "Passages found" }),
  ).toBeVisible();
  await shot(page, testInfo, "dash-14-knowledge-try", {
    fullPage: true,
    axe: true,
  });
  await page
    .locator(`a[href^="${salon}/knowledge/"]:not([href*="/new"])`)
    .first()
    .click();
  await expect(page).toHaveURL(/\/knowledge\/[0-9a-f-]{36}/);
  await shot(page, testInfo, "dash-15-knowledge-document", {
    fullPage: true,
    axe: true,
  });

  await page.goto(`${salon}/assistant`);
  await shot(page, testInfo, "dash-16-assistant", {
    fullPage: true,
    axe: true,
  });
  await page.getByRole("button", { name: "Start a test conversation" }).click();
  await expect(page).toHaveURL(/\/assistant\/[0-9a-f-]{36}/);
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
  await ask(page, "Is there parking?");
  await expect(page.getByRole("log")).toContainText(
    "parking behind the building",
  );
  await shot(page, testInfo, "dash-17-assistant-chat", { axe: true });

  for (const [tab, name] of [
    ["usage", "dash-18-usage"],
    ["widget", "dash-19-widget"],
    ["team", "dash-20-team"],
  ] as const) {
    await page.goto(`${salon}/${tab}`);
    await shot(page, testInfo, name, { fullPage: true, axe: true });
  }
  await page.context().close();
});

test("dashboard as the demo's read-only owner", async ({
  browser,
}, testInfo) => {
  const page = await staffPage(browser, demoConfig, demoConfig.password);
  await page.goto(`/dashboard/b/${demoConfig.slug}`);
  await shot(page, testInfo, "dash-21-read-only", { axe: true });
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "read-only" }),
  ).toBeVisible();
  await shot(page, testInfo, "dash-22-read-only-refused", { axe: true });
  await page.context().close();
});

test("dashboard of a business not set up yet: empty states", async ({
  browser,
}, testInfo) => {
  const page = await staffPage(browser, newOwner);
  await shot(page, testInfo, "empty-01-businesses", { axe: true });
  const business = `/dashboard/b/${slugify(emptyBusiness)}`;
  for (const [tab, name] of [
    ["", "empty-02-overview"],
    ["/bookings", "empty-03-bookings"],
    ["/inbox", "empty-04-inbox"],
    ["/services", "empty-05-services"],
    ["/staff", "empty-06-staff"],
    ["/knowledge", "empty-07-knowledge"],
    ["/usage", "empty-08-usage"],
  ] as const) {
    await page.goto(`${business}${tab}`);
    await shot(page, testInfo, name, { fullPage: true, axe: true });
  }
  await page.context().close();
});

test("widget size: the embed script and the chat frame's JavaScript", async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Measured once.");
  const embed = readFileSync("public/widget.js");
  const page = await visitorPage(browser);
  const scripts: Promise<number>[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      scripts.push(
        response
          .finished()
          .then(
            async () => (await response.request().sizes()).responseBodySize,
          ),
      );
    }
  });
  await page.goto(`/widget/${demoConfig.slug}`);
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
  const sizes = await Promise.all(scripts);
  writeFileSync(
    path.join(outDir, "widget-size.json"),
    `${JSON.stringify(
      {
        embedScript: { bytes: embed.length, gzipBytes: gzipSync(embed).length },
        chatFrameJavaScript: {
          files: sizes.length,
          bytesAsSent: sizes.reduce((total, size) => total + size, 0),
        },
      },
      null,
      2,
    )}\n`,
  );
  await page.context().close();
});

test.afterAll(async ({}, testInfo) => {
  if (!existsSync(outDir)) return;
  writeFileSync(
    path.join(outDir, `axe-${testInfo.project.name}.json`),
    `${JSON.stringify(axeFindings, null, 2)}\n`,
  );
  if (testInfo.project.name !== "mobile") return;
  // An index that shows each screen at both sizes side by side.
  const names = [
    ...new Set(
      readdirSync(outDir)
        .filter((file) => file.endsWith(".jpg"))
        .map((file) => file.replace(/-(desktop|mobile)\.jpg$/, "")),
    ),
  ].sort();
  const rows = names.map((name) => {
    const cell = (size: string) => {
      const file = `${name}-${size}.jpg`;
      return existsSync(path.join(outDir, file)) &&
        statSync(path.join(outDir, file)).size
        ? `<img src="${file}" width="${size === "desktop" ? 480 : 160}" alt="${name}, ${size}">`
        : "";
    };
    return `| ${name} | ${cell("desktop")} | ${cell("mobile")} |`;
  });
  writeFileSync(
    path.join(outDir, "index.md"),
    [
      "# Screens",
      "",
      "Captured by `scripts/screens/screens.spec.ts` (`pnpm screens`): each screen at desktop (1440 wide) and mobile (390 wide).",
      "",
      "| Screen | Desktop | Mobile |",
      "| --- | --- | --- |",
      ...rows,
      "",
    ].join("\n"),
  );
});
