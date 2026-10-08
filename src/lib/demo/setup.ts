import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { demoConfig } from "@/config/demo";
import { addDays, todayIn } from "@/lib/dates";
import {
  DEMO_BOOKINGS,
  DEMO_BUSINESS,
  DEMO_CONVERSATION,
  DEMO_CURRENCY,
  DEMO_DOCUMENTS,
  DEMO_HOURS,
  DEMO_SERVICES,
  DEMO_STAFF,
} from "@/lib/demo/salon";
import { saveDocument } from "@/lib/knowledge/indexing";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createToken } from "@/lib/tokens";

// Sets the public demo up, and clears it each night: run by /api/demo/reset with the service role.
// The first run creates the read-only owner and the salon; later runs clear what visitors left
// (conversations, bookings, customers) and add the sample activity back. The salon itself can't
// change in between: its only account is read-only.

type Admin = SupabaseClient<Database>;

function fail(step: string, error: { message: string }): never {
  throw new Error(`${step} failed: ${error.message}`);
}

/** The demo owner's id, creating the account (read-only) or bringing it back in line. */
async function demoOwner(admin: Admin) {
  const account = {
    password: demoConfig.password,
    email_confirm: true,
    app_metadata: { read_only: true },
  };
  const created = await admin.auth.admin.createUser({
    email: demoConfig.email,
    user_metadata: { full_name: "Demo visitor" },
    ...account,
  });
  if (created.data.user) return created.data.user.id;
  if (created.error?.code !== "email_exists") {
    fail("Creating the demo account", created.error ?? { message: "no user" });
  }
  // Its profile has its id: triggers keep a profile's email the same as its account's, and one
  // query finds it however many accounts there are (auth's own list comes a page at a time).
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", demoConfig.email)
    .maybeSingle();
  if (error) fail("Finding the demo account", error);
  if (!profile) fail("Finding the demo account", { message: "not found" });
  const updated = await admin.auth.admin.updateUserById(profile.id, account);
  if (updated.error) fail("Updating the demo account", updated.error);
  return profile.id;
}

async function createSalon(admin: Admin, ownerId: string) {
  const { data: business, error } = await admin
    .from("businesses")
    .insert({ ...DEMO_BUSINESS, slug: demoConfig.slug, is_demo: true })
    .select("id")
    .single();
  if (error) fail("Creating the demo salon", error);
  const member = await admin
    .from("business_members")
    .insert({ business_id: business.id, user_id: ownerId, role: "owner" });
  if (member.error) fail("Adding the demo owner", member.error);

  const staff = await admin
    .from("staff")
    .insert(DEMO_STAFF.map((name) => ({ business_id: business.id, name })))
    .select("id, name");
  if (staff.error) fail("Adding the demo staff", staff.error);
  for (const { staff: performers, ...service } of DEMO_SERVICES) {
    const saved = await admin
      .from("services")
      .insert({ ...service, business_id: business.id, currency: DEMO_CURRENCY })
      .select("id")
      .single();
    if (saved.error) fail("Adding a demo service", saved.error);
    const links = await admin.from("staff_services").insert(
      staff.data
        .filter((person) => performers.includes(person.name))
        .map((person) => ({
          business_id: business.id,
          staff_id: person.id,
          service_id: saved.data.id,
        })),
    );
    if (links.error) fail("Linking demo staff to services", links.error);
  }
  const hours = await admin
    .from("working_hours")
    .insert(DEMO_HOURS.map((span) => ({ ...span, business_id: business.id })));
  if (hours.error) fail("Adding the demo hours", hours.error);
  return business.id;
}

/** The salon's FAQs and policies, embedded with the model in use, unless they're there already. */
async function ensureKnowledge(admin: Admin, businessId: string) {
  const { count, error } = await admin
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (error) fail("Counting the demo knowledge", error);
  if (count) return;
  for (const document of DEMO_DOCUMENTS) {
    await saveDocument(admin, { businessId, documentId: null, ...document });
  }
}

/** Two upcoming bookings and a conversation waiting for the team. */
async function addSampleActivity(admin: Admin, businessId: string) {
  const [services, staff] = await Promise.all([
    admin.from("services").select("id, name_en").eq("business_id", businessId),
    admin.from("staff").select("id, name").eq("business_id", businessId),
  ]);
  if (services.error) fail("Reading the demo services", services.error);
  if (staff.error) fail("Reading the demo staff", staff.error);
  const today = todayIn(DEMO_BUSINESS.timezone);
  for (const booking of DEMO_BOOKINGS) {
    const { error } = await admin.rpc("book_appointment", {
      target_service_id: services.data.find(
        (s) => s.name_en === booking.service,
      )!.id,
      target_staff_id: staff.data.find((s) => s.name === booking.staff)!.id,
      // Riyadh is UTC+3 all year.
      requested_start: `${addDays(today, booking.daysAhead)}T${booking.time}:00+03:00`,
      customer_name: booking.customer,
      customer_phone: booking.phone,
      idempotency_key: `demo:${randomUUID()}`,
    });
    if (error) fail("Adding a demo booking", error);
  }

  const { data: conversation, error } = await admin
    .from("conversations")
    .insert({
      business_id: businessId,
      channel: "widget",
      status: "needs_human",
      visitor_token_hash: createToken().tokenHash,
      visitor_hash: createToken().tokenHash,
    })
    .select("id")
    .single();
  if (error) fail("Adding the demo conversation", error);
  const saved = await admin.rpc("save_conversation_messages", {
    target_conversation_id: conversation.id,
    messages: DEMO_CONVERSATION.map((message) => ({
      id: randomUUID(),
      role: message.role,
      parts: [{ type: "text", text: message.text }],
    })),
  });
  if (saved.error) fail("Adding the demo messages", saved.error);
}

/** Sets the demo up, or resets it. Says whether the salon was created this time. */
export async function setUpDemo() {
  const admin = createAdminClient();
  const ownerId = await demoOwner(admin);
  const { data: existing, error } = await admin
    .from("businesses")
    .select("id")
    .eq("slug", demoConfig.slug)
    .eq("is_demo", true)
    .maybeSingle();
  if (error) fail("Finding the demo salon", error);

  let businessId = existing?.id;
  if (businessId) {
    const reset = await admin.rpc("reset_demo_business", {
      target_business_id: businessId,
    });
    if (reset.error) fail("Resetting the demo salon", reset.error);
  } else {
    businessId = await createSalon(admin, ownerId);
  }
  await ensureKnowledge(admin, businessId);
  await addSampleActivity(admin, businessId);
  return { created: !existing };
}
