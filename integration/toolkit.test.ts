import { beforeAll, describe, expect, it } from "vitest";
import { createAssistantToolkit } from "@/lib/assistant/toolkit";
import {
  createSalon,
  localAt,
  run,
  serviceClient,
  startConversation,
  toolCallsOf,
  userSaid,
} from "./support";

// The assistant's tools against a real local database: what they return, what they refuse,
// and that nothing ever crosses into another business.

type Salon = Awaited<ReturnType<typeof createSalon>>;
let salon: Salon;
let other: Salon;

beforeAll(async () => {
  [salon, other] = await Promise.all([
    createSalon("Palm Salon"),
    createSalon("Other Salon"),
  ]);
});

async function toolkitFor(business = salon) {
  const conversationId = await startConversation(business.business.id);
  const toolkit = createAssistantToolkit({
    supabase: serviceClient(),
    business: business.business,
    conversationId,
  });
  return { conversationId, ...toolkit };
}

async function conversationRow(conversationId: string) {
  const { data, error } = await serviceClient()
    .from("conversations")
    .select("customer_id, status, verification_failures")
    .eq("id", conversationId)
    .single();
  if (error) throw error;
  return data;
}

describe("looking things up", () => {
  it("search_knowledge returns this business's passages, numbered as sources", async () => {
    const { tools } = await toolkitFor();
    const result = await run<{
      passages: {
        source: number;
        cite_as: string;
        title: string;
        text: string;
      }[];
    }>(tools.search_knowledge, { question: "Is there parking?" });
    expect(result.passages).toEqual([
      {
        source: 1,
        cite_as: "[1]",
        title: "Is there parking?",
        text: "Yes, Palm Salon has free parking behind the building.",
      },
    ]);
  });

  it("and nothing when nothing is relevant", async () => {
    const { tools } = await toolkitFor();
    const result = await run<{ passages: unknown[] }>(tools.search_knowledge, {
      question: "Can I bring my dog?",
    });
    expect(result.passages).toEqual([]);
  });

  it("business_info lists this business's services, staff, hours and rules", async () => {
    const { tools } = await toolkitFor();
    const info = await run<{
      name: string;
      services: { id: string; name_en: string; staff: { name: string }[] }[];
      hours: { day: string; hours: string }[];
      rules: { customersCanCancelOrMove: string };
    }>(tools.business_info, {});
    expect(info.name).toBe(salon.business.name);
    expect(info.services).toHaveLength(1);
    expect(info.services[0]).toMatchObject({
      id: salon.serviceId,
      name_en: "Haircut",
      staff: [{ name: "Layla" }],
    });
    expect(info.hours[0]).toEqual({ day: "Sunday", hours: "09:00-17:00" });
    expect(info.rules.customersCanCancelOrMove).toBe(
      "Up to 72 h before it starts",
    );
  });

  it("check_availability lists free times, and refuses another business's service", async () => {
    const { tools } = await toolkitFor();
    const free = await run<{
      ok: boolean;
      days: { times: { time: string; staff: string[] }[] }[];
    }>(tools.check_availability, {
      service_id: salon.serviceId,
      date: localAt(2, "00:00").slice(0, 10),
      days: 1,
    });
    expect(free.ok).toBe(true);
    expect(free.days[0]?.times[0]).toMatchObject({
      time: "09:00",
      staff: ["Layla"],
    });

    const foreign = await run<{ ok: boolean }>(tools.check_availability, {
      service_id: other.serviceId,
      date: localAt(2, "00:00").slice(0, 10),
      days: 1,
    });
    expect(foreign.ok).toBe(false);
  });
});

describe("booking", () => {
  const request = () => ({
    service_id: salon.serviceId,
    starts_at: localAt(5, "10:00"),
    customer_name: "Mona Adel",
    customer_phone: "+966501234567",
  });

  it("asks the customer to approve a request worded from the database, in their language", async () => {
    const { toolApproval } = await toolkitFor();
    const english = await toolApproval.book_appointment(request(), {
      toolCallId: "approval-en",
      messages: userSaid("Book me a haircut please"),
    });
    expect(english.type).toBe("user-approval");
    expect(english.reason?.replace(/\s/g, " ")).toMatch(
      /^Haircut on .+, 10:00 to 10:45, SAR 120\.00, for Mona Adel \(\+966 50 123 4567\)\.$/,
    );

    const arabic = await toolApproval.book_appointment(request(), {
      toolCallId: "approval-ar",
      messages: userSaid("أريد حجز قص شعر"),
    });
    expect(arabic.reason).toContain("قص شعر");
    expect(arabic.reason).toContain("باسم Mona Adel");
  });

  it("refuses before asking when the request can't go ahead, and records why", async () => {
    const { toolApproval, conversationId } = await toolkitFor();
    const foreign = await toolApproval.book_appointment(
      { ...request(), service_id: other.serviceId },
      { toolCallId: "foreign", messages: [] },
    );
    expect(foreign.type).toBe("denied");
    const closed = await toolApproval.book_appointment(
      { ...request(), starts_at: localAt(5, "20:00") },
      { toolCallId: "closed", messages: [] },
    );
    expect(closed).toMatchObject({
      type: "denied",
      reason: expect.stringContaining("isn't available"),
    });
    expect(await toolCallsOf(conversationId)).toEqual([
      { tool_name: "book_appointment", status: "failed", approved: false },
      { tool_name: "book_appointment", status: "failed", approved: false },
    ]);
  });

  it("books once approved, once only per tool call, and the conversation then acts for the customer", async () => {
    const { tools, conversationId } = await toolkitFor();
    const input = { ...request(), starts_at: localAt(5, "11:00") };
    const first = await run<{ ok: boolean; reference: string; staff: string }>(
      tools.book_appointment,
      input,
      { toolCallId: "book-once" },
    );
    expect(first).toMatchObject({ ok: true, staff: "Layla" });
    // The same tool call running again (a retry) returns the same booking.
    const again = await run<{ reference: string }>(
      tools.book_appointment,
      input,
      {
        toolCallId: "book-once",
      },
    );
    expect(again.reference).toBe(first.reference);
    const { count } = await serviceClient()
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", salon.business.id)
      .eq("starts_at", input.starts_at);
    expect(count).toBe(1);

    expect((await conversationRow(conversationId)).customer_id).not.toBeNull();
    expect(await toolCallsOf(conversationId)).toEqual([
      { tool_name: "book_appointment", status: "succeeded", approved: true },
      { tool_name: "book_appointment", status: "succeeded", approved: true },
    ]);
  });

  it("never books another business's service, even if asked directly", async () => {
    const { tools } = await toolkitFor();
    const result = await run<{ ok: boolean }>(tools.book_appointment, {
      ...request(),
      service_id: other.serviceId,
    });
    expect(result.ok).toBe(false);
    const { count } = await serviceClient()
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", other.business.id);
    expect(count).toBe(0);
  });
});

describe("managing a booking", () => {
  let bookingReference: string;
  let soonReference: string;

  beforeAll(async () => {
    const { tools } = await toolkitFor();
    const book = (startsAt: string) =>
      run<{ reference: string }>(tools.book_appointment, {
        service_id: salon.serviceId,
        starts_at: startsAt,
        customer_name: "Omar Said",
        customer_phone: "+966551112233",
      });
    bookingReference = (await book(localAt(6, "12:00"))).reference;
    soonReference = (await book(localAt(1, "12:00"))).reference;
  });

  it("refuses to move or cancel a booking the conversation hasn't verified", async () => {
    const { tools, toolApproval } = await toolkitFor();
    const denied = await toolApproval.cancel_booking(
      { reference: bookingReference },
      { toolCallId: "unverified", messages: [] },
    );
    expect(denied.type).toBe("denied");
    const direct = await run<{ ok: boolean }>(tools.cancel_booking, {
      reference: bookingReference,
    });
    expect(direct.ok).toBe(false);
  });

  it("verifies with the reference and phone number, and stops after five failures", async () => {
    const { tools, conversationId } = await toolkitFor();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await run<{ ok: boolean }>(tools.find_bookings, {
        reference: bookingReference,
        phone: "+966500000000",
      });
      expect(wrong.ok).toBe(false);
    }
    const locked = await run<{ ok: boolean; message: string }>(
      tools.find_bookings,
      {
        reference: bookingReference,
        phone: "+966551112233",
      },
    );
    expect(locked).toMatchObject({
      ok: false,
      message: expect.stringContaining("Too many"),
    });
    expect((await conversationRow(conversationId)).customer_id).toBeNull();
  });

  it("once verified, lists the customer's bookings and moves or cancels them after approval", async () => {
    const { tools, toolApproval, conversationId } = await toolkitFor();
    const found = await run<{ ok: boolean; bookings: { reference: string }[] }>(
      tools.find_bookings,
      { reference: bookingReference, phone: "0096655 111 2233" },
    );
    expect(found.ok).toBe(true);
    expect(
      found.bookings.map((booking) => booking.reference).toSorted(),
    ).toEqual([bookingReference, soonReference].toSorted());
    // Later in the conversation, no need to prove it again.
    const again = await run<{ ok: boolean }>(tools.find_bookings, {});
    expect(again.ok).toBe(true);

    const move = {
      reference: bookingReference,
      new_starts_at: localAt(6, "14:00"),
    };
    const moveApproval = await toolApproval.reschedule_booking(move, {
      toolCallId: "move",
      messages: userSaid("Can you move it to 2pm?"),
    });
    expect(moveApproval.type).toBe("user-approval");
    expect(moveApproval.reason).toMatch(
      new RegExp(
        `^Move booking ${bookingReference} \\(Haircut, .+ 12:00\\) to .+ 14:00\\.$`,
      ),
    );
    const moved = await run<{ ok: boolean; starts: string }>(
      tools.reschedule_booking,
      move,
    );
    expect(moved.ok).toBe(true);
    expect(moved.starts).toMatch(/14:00$/);

    // Inside the 72-hour window, customers can't change a booking themselves.
    const tooLate = await toolApproval.cancel_booking(
      { reference: soonReference },
      { toolCallId: "too-late", messages: [] },
    );
    expect(tooLate).toMatchObject({
      type: "denied",
      reason: expect.stringContaining("too late"),
    });

    const cancelApproval = await toolApproval.cancel_booking(
      { reference: bookingReference },
      { toolCallId: "cancel", messages: [] },
    );
    expect(cancelApproval.reason).toMatch(
      new RegExp(`^Cancel booking ${bookingReference} `),
    );
    const cancelled = await run<{ ok: boolean; status: string }>(
      tools.cancel_booking,
      {
        reference: bookingReference,
      },
    );
    expect(cancelled).toMatchObject({ ok: true, status: "cancelled" });
    expect((await conversationRow(conversationId)).customer_id).not.toBeNull();
  });
});

describe("handing over", () => {
  it("request_human flags the conversation for the team", async () => {
    const { tools, conversationId } = await toolkitFor();
    const result = await run<{ ok: boolean }>(tools.request_human, {
      reason: "The customer wants to talk about a complaint.",
    });
    expect(result.ok).toBe(true);
    expect((await conversationRow(conversationId)).status).toBe("needs_human");
  });
});
