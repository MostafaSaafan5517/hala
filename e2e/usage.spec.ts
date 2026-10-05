import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { accessibilityViolations } from "./support/accessibility";
import { addMember, createSalonFor } from "./support/businesses";
import { signInAs } from "./support/forms";
import { adminClient } from "./support/supabase";
import { createConfirmedUser } from "./support/users";

// The Usage tab: what the assistant did and cost, per day in the business's time zone (Riyadh,
// UTC+3 all year), for owners and admins. The usage log is written by server code only, so the
// test writes it directly, the way the assistant's calls would.

async function recordUsage(businessId: string) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const supabase = adminClient();
  // In a bulk insert, a column some rows leave out would be null; this gives it its default.
  const defaults = { defaultToNull: false };
  const calls = await supabase.from("model_calls").insert(
    [
      {
        business_id: businessId,
        purpose: "chat",
        model: "anthropic/claude-haiku-4.5",
        input_tokens: 3000,
        output_tokens: 300,
        cost_usd: 0.0045,
        latency_ms: 1200,
      },
      {
        business_id: businessId,
        purpose: "search",
        model: "openai/text-embedding-3-small",
        input_tokens: 20,
        cost_usd: 0.0000004,
        latency_ms: 80,
      },
      {
        business_id: businessId,
        purpose: "chat",
        model: "anthropic/claude-haiku-4.5",
        input_tokens: 2000,
        output_tokens: 200,
        cost_usd: 0.003,
        latency_ms: 900,
        created_at: yesterday,
      },
    ],
    defaults,
  );
  if (calls.error) throw calls.error;
  const conversation = await supabase.from("conversations").insert({
    business_id: businessId,
    channel: "widget",
    visitor_token_hash: randomBytes(32).toString("hex"),
    visitor_hash: randomBytes(32).toString("hex"),
  });
  if (conversation.error) throw conversation.error;
  const tools = await supabase.from("tool_calls").insert(
    [
      {
        business_id: businessId,
        conversation_id: crypto.randomUUID(),
        tool_call_id: "booking",
        tool_name: "book_appointment",
        input: {},
        output: { ok: true },
        status: "succeeded",
      },
      {
        business_id: businessId,
        conversation_id: crypto.randomUUID(),
        tool_call_id: "person",
        tool_name: "request_human",
        input: {},
        output: { ok: true },
        status: "succeeded",
        created_at: yesterday,
      },
    ],
    defaults,
  );
  if (tools.error) throw tools.error;
}

test("owners see what the assistant did and cost, day by day and by model", async ({
  page,
}) => {
  const owner = await createConfirmedUser();
  const business = await createSalonFor(owner);
  await recordUsage(business.id);
  await signInAs(page, owner);

  await page.goto(`/dashboard/b/${business.slug}`);
  await page.getByRole("link", { name: "Usage" }).click();
  await expect(
    page.getByRole("heading", {
      name: "The assistant's usage, last 7 days",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Last 7 days" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const tiles = page.locator("dl");
  await expect(tiles.getByText("Spent", { exact: true })).toBeVisible();
  for (const [label, value] of [
    ["Spent", "$0.0075"],
    ["Website conversations", "1"],
    ["Bookings by the assistant", "1"],
    ["Asked for a person", "1"],
  ] as const) {
    await expect(
      tiles.locator("div").filter({ hasText: label }).locator("dd"),
    ).toHaveText(value);
  }
  await expect(
    page.getByRole("meter", { name: "Spent today" }),
  ).toHaveAttribute("aria-valuetext", "$0.0045 of $5.00");

  // The chart reads each day from the keyboard; the table lists the same values.
  const chart = page.getByRole("group", { name: /Spend per day/ });
  await chart.focus();
  await expect(chart.getByText("$0.0045", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(chart.getByText("$0.003", { exact: true })).toBeVisible();

  const days = page.getByRole("region", { name: "Day by day" });
  const rows = days.getByRole("row");
  await expect(rows).toHaveCount(8);
  await expect(rows.nth(1)).toContainText("$0.0045");
  await expect(rows.nth(2)).toContainText("$0.003");
  await expect(rows.nth(2)).toContainText("900 ms");

  const models = page.getByRole("region", { name: "By model" });
  await expect(
    models.getByRole("row", { name: /anthropic\/claude-haiku-4\.5 Chat 2/ }),
  ).toBeVisible();
  await expect(
    models.getByRole("row", { name: /text-embedding-3-small Searching/ }),
  ).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.getByRole("link", { name: "Last 30 days" }).click();
  await expect(
    page.getByRole("heading", {
      name: "The assistant's usage, last 30 days",
    }),
  ).toBeVisible();
  await expect(days.getByRole("row")).toHaveCount(31);
});

test("staff don't see the business's usage", async ({ page }) => {
  const owner = await createConfirmedUser();
  const business = await createSalonFor(owner);
  const staff = await createConfirmedUser();
  await addMember(business.id, staff.email, "staff");
  await signInAs(page, staff);

  await page.goto(`/dashboard/b/${business.slug}`);
  await expect(page.getByRole("link", { name: "Usage" })).toHaveCount(0);
  const response = await page.goto(`/dashboard/b/${business.slug}/usage`);
  expect(response?.status()).toBe(404);
});
