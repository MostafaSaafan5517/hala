import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { accessibilityViolations } from "./support/accessibility";
import { addMember, createSalonFor } from "./support/businesses";
import { signInAs } from "./support/forms";
import { addDocument } from "./support/knowledge";
import { adminClient } from "./support/supabase";
import { createConfirmedUser } from "./support/users";
import { asNewVisitor } from "./support/visitors";

// The staff inbox, with the offline models: a member takes a website conversation over from the
// assistant, replies in the customer's chat, hands it back, and closes it. Both sides check for
// changes every few seconds, so the waits here allow for a check or two.

const CHECK = { timeout: 15_000 };

async function say(page: Page, text: string) {
  await page.getByRole("textbox").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

test("a member takes a website conversation over, replies, hands it back, and closes it", async ({
  page,
  browser,
}) => {
  test.slow();
  const owner = await createConfirmedUser();
  const business = await createSalonFor(owner);
  await signInAs(page, owner);
  await addDocument(page, business.slug, {
    kind: "faq",
    title: "Is there parking?",
    body: "Yes, free parking behind the salon.",
  });
  const { error } = await adminClient()
    .from("businesses")
    .update({
      widget_enabled: true,
      widget_origins: ["https://nour-salon.com"],
    })
    .eq("id", business.id);
  if (error) throw error;
  const staff = await createConfirmedUser("Sara Haddad");
  await addMember(business.id, staff.email, "staff");

  // A visitor asks the assistant something.
  const visitor = await (
    await browser.newContext({ extraHTTPHeaders: asNewVisitor() })
  ).newPage();
  await visitor.goto(`/widget/${business.slug}`);
  const chat = visitor.getByRole("log");
  await say(visitor, "Where is the parking?");
  await expect(chat).toContainText("Yes, free parking behind the salon.");

  // A staff member finds it in the inbox, with what the assistant did.
  const member = await (await browser.newContext()).newPage();
  await signInAs(member, staff);
  await member.goto(`/dashboard/b/${business.slug}/inbox`);
  await expect(member.getByText("Nobody is waiting.")).toBeVisible();
  const recent = member.getByRole("region", { name: "Recent conversations" });
  await expect(recent.getByRole("link")).toHaveCount(1);
  expect(await accessibilityViolations(member)).toEqual([]);
  await recent.getByRole("link", { name: /Website visitor/ }).click();

  await expect(
    member.getByRole("heading", {
      name: "Conversation with a website visitor",
    }),
  ).toBeVisible();
  const transcript = member.getByRole("region", { name: "Transcript" });
  await expect(transcript).toContainText("Where is the parking?");
  await expect(transcript).toContainText("Yes, free parking behind the salon.");
  await transcript.getByText("Searched the knowledge base: done").click();
  await expect(transcript).toContainText('"question": "Where is the parking?"');
  expect(await accessibilityViolations(member)).toEqual([]);

  // Taking over: the assistant goes quiet, and the visitor is told a person has the chat.
  await member.getByRole("button", { name: "Take over" }).click();
  await expect(member.getByRole("status")).toContainText(
    "With the team: Sara Haddad",
  );
  await expect(visitor.getByText("You're chatting with the team.")).toBeVisible(
    CHECK,
  );
  await say(visitor, "Can I bring my dog?");
  await expect(transcript).toContainText("Can I bring my dog?", CHECK);
  await expect(
    chat.getByText("Yes, free parking behind the salon."),
  ).toHaveCount(1);

  // The member's reply appears in the visitor's chat, from the team.
  await member
    .getByLabel("Reply to the customer")
    .fill("Yes, dogs are welcome here.");
  await member.getByRole("button", { name: "Send reply" }).click();
  await expect(transcript).toContainText("Team · Sara Haddad");
  await expect(transcript).toContainText("Yes, dogs are welcome here.");
  await expect(member.getByLabel("Reply to the customer")).toHaveValue("");
  await expect(chat).toContainText("From the team", CHECK);
  await expect(chat).toContainText("Yes, dogs are welcome here.");
  expect(await accessibilityViolations(member)).toEqual([]);

  // The inbox lists it as waiting for the team.
  await member.goto(`/dashboard/b/${business.slug}/inbox`);
  await expect(
    member
      .getByRole("region", { name: "Waiting for the team" })
      .getByRole("link", { name: /Website visitor.*With the team/ }),
  ).toBeVisible();
  await member.goBack();

  // Handed back, the assistant answers again.
  await member
    .getByRole("button", { name: "Hand back to the assistant" })
    .click();
  await expect(member.getByRole("status")).toContainText("Open");
  await expect(visitor.getByText("You're chatting with the team.")).toBeHidden(
    CHECK,
  );
  await say(visitor, "Where is the parking?");
  await expect(
    chat.getByText("Yes, free parking behind the salon."),
  ).toHaveCount(2);

  // Closed: the visitor is offered a new conversation.
  await member.getByRole("button", { name: "Close conversation" }).click();
  await expect(member.getByRole("status")).toContainText("Closed");
  await expect(member.getByRole("button", { name: "Take over" })).toBeHidden();
  await expect(visitor.getByText("This conversation has ended.")).toBeVisible(
    CHECK,
  );
  await visitor
    .getByRole("button", { name: "Start a new conversation" })
    .click();
  await expect(chat).toContainText("Ask a question, or ask to book.");
});

test("another business's members can't open a business's conversations", async ({
  page,
  browser,
}) => {
  const owner = await createConfirmedUser();
  const business = await createSalonFor(owner);
  const { data: conversation, error } = await adminClient()
    .from("conversations")
    .insert({
      business_id: business.id,
      channel: "widget",
      visitor_token_hash: randomBytes(32).toString("hex"),
      visitor_hash: randomBytes(32).toString("hex"),
    })
    .select("id")
    .single();
  if (error) throw error;

  const outsider = await createConfirmedUser();
  await createSalonFor(outsider);
  await signInAs(page, outsider);
  const response = await page.goto(
    `/dashboard/b/${business.slug}/inbox/${conversation.id}`,
  );
  expect(response?.status()).toBe(404);

  const ownerPage = await (await browser.newContext()).newPage();
  await signInAs(ownerPage, owner);
  const own = await ownerPage.goto(
    `/dashboard/b/${business.slug}/inbox/${conversation.id}`,
  );
  expect(own?.status()).toBe(200);
});
