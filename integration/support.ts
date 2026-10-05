import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { ModelMessage } from "ai";
import {
  addService,
  addStaffMember,
  createBusinessFor,
  setHoursFor,
  uniqueBusinessName,
} from "../e2e/support/businesses";
import { supabaseSettings } from "../e2e/support/supabase";
import { createConfirmedUser } from "../e2e/support/users";
import type { AssistantBusiness } from "@/lib/assistant/toolkit";
import { addDays, todayIn } from "@/lib/dates";
import { saveDocument } from "@/lib/knowledge/indexing";
import type { Database } from "@/lib/supabase/database.types";

// Riyadh is UTC+3 all year, so a local time maps to one moment without daylight saving.
export const TIME_ZONE = "Asia/Riyadh";

/** A local time `days` from today in Riyadh, as an ISO moment. */
export function localAt(days: number, time: string) {
  return new Date(
    `${addDays(todayIn(TIME_ZONE), days)}T${time}:00+03:00`,
  ).toISOString();
}

/** The typed service-role client, as the assistant uses it. */
export function serviceClient() {
  const { url, secretKey } = supabaseSettings();
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false },
  });
}

/**
 * A salon open 09:00-17:00 every day with a 45-minute haircut that Layla does, and an FAQ about
 * parking. Customers can cancel or move up to 72 hours before. Comes with its owner, signed in,
 * for what members do (the knowledge base, the inbox).
 */
export async function createSalon(name = "Palm Salon") {
  const owner = await createConfirmedUser();
  const created = await createBusinessFor(owner, uniqueBusinessName(name), {
    timezone: TIME_ZONE,
  });
  const supabase = serviceClient();
  const serviceId = await addService(created.id, {
    nameEn: "Haircut",
    nameAr: "قص شعر",
    duration: 45,
    price: 12000,
    currency: "SAR",
  });
  const laylaId = await addStaffMember(created.id, "Layla", [serviceId]);
  await setHoursFor(
    created.id,
    null,
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opens_at: "09:00",
      closes_at: "17:00",
    })),
  );
  const { data: business, error } = await supabase
    .from("businesses")
    .update({ cancellation_notice_hours: 72 })
    .eq("id", created.id)
    .select(
      "id, name, timezone, default_language, booking_notice_minutes, booking_horizon_days, cancellation_notice_hours",
    )
    .single();
  if (error) throw error;

  // Knowledge is saved as the owner, through the same path as the Knowledge tab.
  const ownerClient = await signedInClient(owner);
  await saveDocument(ownerClient, {
    businessId: business.id,
    documentId: null,
    kind: "faq",
    language: "en",
    title: "Is there parking?",
    body: `Yes, ${name} has free parking behind the building.`,
  });

  return {
    business: business satisfies AssistantBusiness,
    slug: created.slug,
    serviceId,
    laylaId,
    ownerClient,
  };
}

/** A typed client signed in as this user, the way the dashboard calls the API. */
async function signedInClient(user: { email: string; password: string }) {
  const { url, publishableKey } = supabaseSettings();
  const client = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword(user);
  if (error) throw error;
  return client;
}

export async function startConversation(businessId: string) {
  const { data, error } = await serviceClient()
    .from("conversations")
    .insert({ business_id: businessId, channel: "test" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** A conversation from the website widget (its visitor's token isn't needed here). */
export async function startWidgetConversation(businessId: string) {
  const { data, error } = await serviceClient()
    .from("conversations")
    .insert({
      business_id: businessId,
      channel: "widget",
      visitor_token_hash: randomBytes(32).toString("hex"),
      visitor_hash: randomBytes(32).toString("hex"),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Runs a tool directly, as the agent would after validating the input. */
export async function run<OUTPUT>(
  tool: { execute?: unknown },
  input: unknown,
  options: { toolCallId?: string; messages?: ModelMessage[] } = {},
) {
  const execute = tool.execute as
    ((input: unknown, options: object) => unknown) | undefined;
  if (!execute) throw new Error("This tool has no execute function");
  return (await execute(input, {
    toolCallId: options.toolCallId ?? `test-${crypto.randomUUID()}`,
    messages: options.messages ?? [],
    context: undefined,
  })) as OUTPUT;
}

export function userSaid(text: string): ModelMessage[] {
  return [{ role: "user", content: text }];
}

export async function toolCallsOf(conversationId: string) {
  const { data, error } = await serviceClient()
    .from("tool_calls")
    .select("tool_name, status, approved")
    .eq("conversation_id", conversationId)
    .order("id");
  if (error) throw error;
  return data;
}
