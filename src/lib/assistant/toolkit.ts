import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type ModelMessage, tool } from "ai";
import { z } from "zod";
import { refusalFor } from "@/lib/assistant/refusals";
import {
  bookingSummary,
  type CustomerLanguage,
  cancellationSummary,
  languageOfText,
  rescheduleSummary,
  serviceNameIn,
} from "@/lib/assistant/summaries";
import { describeCancellation, describeNotice } from "@/lib/booking-rules";
import {
  addDays,
  formatDay,
  formatLocalDateTime,
  formatLocalTime,
  isIsoDate,
  todayIn,
} from "@/lib/dates";
import { WEEKDAYS } from "@/lib/hours";
import { searchKnowledge } from "@/lib/knowledge/search";
import { formatAmount } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import type { Database, Tables } from "@/lib/supabase/database.types";

// The assistant's tools: the only way it can learn about the business or act for a customer.
// The model only ever requests a tool call. Each tool validates its input (Zod), scopes every
// query to the conversation's business, and leaves the rules to the database functions that the
// dashboard uses too. Booking, moving and cancelling first need the customer's approval: the
// approval check below confirms the request can go ahead and words it for the customer, from the
// database, never from the model. Every call is recorded in tool_calls.

export type AssistantBusiness = Pick<
  Tables<"businesses">,
  | "id"
  | "name"
  | "timezone"
  | "default_language"
  | "booking_notice_minutes"
  | "booking_horizon_days"
  | "cancellation_notice_hours"
>;

export type AssistantContext = {
  /** The service-role client: the assistant acts for customers, as server code. */
  supabase: SupabaseClient<Database>;
  business: AssistantBusiness;
  conversationId: string;
};

/** Failed attempts to prove a booking is theirs before the assistant stops trying. */
export const MAX_VERIFICATION_FAILURES = 5;

/** The most start times one availability check returns, to keep answers (and tokens) small. */
const MAX_TIMES = 48;

/** The tools that need the customer's approval before they run. */
export const APPROVAL_TOOLS = [
  "book_appointment",
  "reschedule_booking",
  "cancel_booking",
] as const;

const reference = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[2-9A-HJ-NP-Z]{6}$/,
    "A booking reference is six letters and digits.",
  )
  .describe("The booking's six-character reference, like 7KQ2MX.");

const isoMoment = z.iso
  .datetime({ offset: true })
  .describe(
    "A start time exactly as check_availability returned it (starts_at).",
  );

const phone = z
  .string()
  .transform((text, context) => {
    const normalized = normalizePhone(text);
    if (!normalized) {
      context.addIssue(
        "Not a valid phone number. Ask for it with the country code, like +20 10 1234 5678.",
      );
      return z.NEVER;
    }
    return normalized;
  })
  .describe(
    "The customer's phone number with its country code. If they give a local number, add the code for the business's country.",
  );

// The inputs of the tools that need approval, named so the approval checks share their types.
const bookInput = z.object({
  service_id: z.uuid().describe("A service id from business_info."),
  starts_at: isoMoment,
  staff_id: z
    .uuid()
    .optional()
    .describe(
      "The staff member the customer chose; leave out for anyone free.",
    ),
  customer_name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe("The customer's name."),
  customer_phone: phone,
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .describe("Anything the business should know."),
});

const rescheduleInput = z.object({
  reference,
  new_starts_at: isoMoment,
  staff_id: z
    .uuid()
    .optional()
    .describe("A different staff member; leave out to keep the same one."),
});

const cancelInput = z.object({ reference });

/** The language of the customer's latest message, for what they are shown. */
function customerLanguage(messages: ModelMessage[]): CustomerLanguage {
  const latest = messages.findLast((message) => message.role === "user");
  if (!latest) return "en";
  const text =
    typeof latest.content === "string"
      ? latest.content
      : latest.content
          .map((part) => ("text" in part ? part.text : ""))
          .join(" ");
  return languageOfText(text);
}

function sameMoment(first: string, second: string) {
  return new Date(first).getTime() === new Date(second).getTime();
}

export function createAssistantToolkit(context: AssistantContext) {
  const { supabase, business, conversationId } = context;
  const timeZone = business.timezone;

  async function record(call: {
    toolCallId: string;
    toolName: string;
    input: unknown;
    output: unknown;
    status: "succeeded" | "failed" | "declined";
    approved: boolean;
    started?: number;
  }) {
    const { error } = await supabase.from("tool_calls").insert({
      business_id: business.id,
      conversation_id: conversationId,
      tool_call_id: call.toolCallId,
      tool_name: call.toolName,
      input: call.input as never,
      output: call.output as never,
      status: call.status,
      approved: call.approved,
      latency_ms: call.started
        ? Math.round(performance.now() - call.started)
        : 0,
    });
    if (error)
      console.error("Recording a tool call failed", { code: error.code });
  }

  /** Runs a tool and records it: succeeded, or failed when it refused (ok: false) or threw. */
  async function audited<OUTPUT extends { ok: boolean }>(
    toolName: string,
    toolCallId: string,
    input: unknown,
    run: () => Promise<OUTPUT>,
  ): Promise<OUTPUT> {
    const started = performance.now();
    const approved = (APPROVAL_TOOLS as readonly string[]).includes(toolName);
    try {
      const output = await run();
      await record({
        toolCallId,
        toolName,
        input,
        output,
        status: output.ok ? "succeeded" : "failed",
        approved,
        started,
      });
      return output;
    } catch (error) {
      await record({
        toolCallId,
        toolName,
        input,
        output: { error: error instanceof Error ? error.name : "UnknownError" },
        status: "failed",
        approved,
        started,
      });
      throw error;
    }
  }

  async function serviceOf(serviceId: string) {
    const { data, error } = await supabase
      .from("services")
      .select(
        "id, name_en, name_ar, duration_minutes, price, currency, staff_services (staff (id, name, active))",
      )
      .eq("id", serviceId)
      .eq("business_id", business.id)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(`Could not load the service: ${error.message}`);
    if (!data) return null;
    const performers = data.staff_services
      .map((link) => link.staff)
      .filter((person) => person.active);
    return { ...data, performers };
  }

  async function bookingOf(bookingReference: string) {
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, reference, customer_id, service_id, staff_id, starts_at, status, services (name_en, name_ar)",
      )
      .eq("business_id", business.id)
      .eq("reference", bookingReference)
      .maybeSingle();
    if (error) throw new Error(`Could not load the booking: ${error.message}`);
    return data;
  }

  async function conversation() {
    const { data, error } = await supabase
      .from("conversations")
      .select("customer_id, verification_failures")
      .eq("id", conversationId)
      .single();
    if (error)
      throw new Error(`Could not load the conversation: ${error.message}`);
    return data;
  }

  async function updateConversation(
    changes: Partial<
      Pick<
        Tables<"conversations">,
        "customer_id" | "status" | "verification_failures"
      >
    >,
  ) {
    const { error } = await supabase
      .from("conversations")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    if (error)
      throw new Error(`Could not update the conversation: ${error.message}`);
  }

  /** Whether a start time is free, by the same availability function the booking uses. */
  async function isFree(options: {
    serviceId: string;
    startsAt: string;
    staffId?: string;
    ignoredBookingId?: string;
  }) {
    const day = todayIn(timeZone, new Date(options.startsAt));
    const { data, error } = await supabase.rpc("available_slots", {
      target_service_id: options.serviceId,
      from_date: day,
      to_date: day,
      target_staff_id: options.staffId,
      ignored_booking_id: options.ignoredBookingId,
    });
    if (error)
      throw new Error(`Could not check availability: ${error.message}`);
    return data.some((slot) => sameMoment(slot.starts_at, options.startsAt));
  }

  /** The booking, when it belongs to the customer this conversation has verified. */
  async function ownBooking(bookingReference: string) {
    const [booking, current] = await Promise.all([
      bookingOf(bookingReference),
      conversation(),
    ]);
    if (
      !booking ||
      !current.customer_id ||
      booking.customer_id !== current.customer_id
    ) {
      return null;
    }
    return booking;
  }

  const notVerified = {
    ok: false as const,
    message:
      "This conversation hasn't verified that booking. Ask the customer for its reference and their phone number, and use find_bookings first.",
  };

  function tooLate(startsAt: string) {
    const window = business.cancellation_notice_hours * 60 * 60 * 1000;
    return new Date(startsAt).getTime() - Date.now() < window;
  }

  async function staffName(staffId: string) {
    const { data } = await supabase
      .from("staff")
      .select("name")
      .eq("id", staffId)
      .eq("business_id", business.id)
      .maybeSingle();
    return data?.name ?? null;
  }

  async function upcomingBookings(
    customerId: string,
    language: CustomerLanguage,
  ) {
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "reference, starts_at, ends_at, services (name_en, name_ar), staff (name)",
      )
      .eq("business_id", business.id)
      .eq("customer_id", customerId)
      .eq("status", "confirmed")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at");
    if (error) throw new Error(`Could not load the bookings: ${error.message}`);
    return data.map((booking) => ({
      reference: booking.reference,
      service: serviceNameIn(booking.services, language),
      staff: booking.staff.name,
      starts: formatLocalDateTime(booking.starts_at, timeZone),
      ends: formatLocalTime(booking.ends_at, timeZone),
    }));
  }

  /** Records a request the approval check refused before asking the customer, and refuses it. */
  async function refuse(
    toolName: string,
    toolCallId: string,
    input: unknown,
    reason: string,
  ) {
    await record({
      toolCallId,
      toolName,
      input,
      output: { ok: false, message: reason },
      status: "failed",
      approved: false,
    });
    return { type: "denied" as const, reason };
  }

  const tools = {
    search_knowledge: tool({
      description:
        "Search the business's FAQs and policies. Use it for every question about the business that the other tools don't answer. Answer only from the passages it returns, citing them like [1]. If it returns none, say you don't know and offer a person.",
      inputSchema: z.object({
        question: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .describe("The customer's question, in their own words."),
      }),
      execute: (input, { toolCallId }) =>
        audited("search_knowledge", toolCallId, input, async () => {
          const results = await searchKnowledge(supabase, {
            businessId: business.id,
            question: input.question,
          });
          return {
            ok: true as const,
            passages: results.map((result, index) => ({
              source: index + 1,
              title: result.title,
              // The passage starts with its document's title, given separately.
              text: result.content.slice(result.content.indexOf("\n") + 1),
            })),
          };
        }),
    }),

    business_info: tool({
      description:
        "The business's details: today's date and time, opening hours, upcoming closures, booking rules, and its services (ids, names, length, price, and who performs each).",
      inputSchema: z.object({}),
      execute: (input, { toolCallId }) =>
        audited("business_info", toolCallId, input, async () => {
          const today = todayIn(timeZone);
          const [servicesResult, hoursResult, closuresResult] =
            await Promise.all([
              supabase
                .from("services")
                .select(
                  "id, name_en, name_ar, duration_minutes, price, currency, staff_services (staff (id, name, active))",
                )
                .eq("business_id", business.id)
                .eq("active", true)
                .order("created_at"),
              supabase
                .from("working_hours")
                .select("weekday, opens_at, closes_at")
                .eq("business_id", business.id)
                .is("staff_id", null)
                .order("weekday")
                .order("opens_at"),
              supabase
                .from("closures")
                .select("starts_on, ends_on, reason")
                .eq("business_id", business.id)
                .gte("ends_on", today)
                .order("starts_on")
                .limit(10),
            ]);
          for (const { error } of [
            servicesResult,
            hoursResult,
            closuresResult,
          ]) {
            if (error)
              throw new Error(`Could not load the business: ${error.message}`);
          }
          return {
            ok: true as const,
            name: business.name,
            timeZone,
            now: formatLocalDateTime(new Date().toISOString(), timeZone),
            today,
            hours: WEEKDAYS.map((day, weekday) => {
              const spans = (hoursResult.data ?? []).filter(
                (span) => span.weekday === weekday,
              );
              return {
                day,
                hours:
                  spans.length === 0
                    ? "closed"
                    : spans
                        .map(
                          (span) =>
                            `${span.opens_at.slice(0, 5)}-${span.closes_at.slice(0, 5)}`,
                        )
                        .join(", "),
              };
            }),
            closures: (closuresResult.data ?? []).map((closure) => ({
              from: formatDay(closure.starts_on),
              to: formatDay(closure.ends_on),
              reason: closure.reason,
            })),
            rules: {
              notice: describeNotice(business.booking_notice_minutes),
              bookAheadDays: business.booking_horizon_days,
              customersCanCancelOrMove: describeCancellation(
                business.cancellation_notice_hours,
              ),
            },
            services: (servicesResult.data ?? []).map((service) => ({
              id: service.id,
              name_en: service.name_en,
              name_ar: service.name_ar,
              minutes: service.duration_minutes,
              price: formatAmount(service.price, service.currency),
              staff: service.staff_services
                .map((link) => link.staff)
                .filter((person) => person.active)
                .map((person) => ({ id: person.id, name: person.name })),
            })),
          };
        }),
    }),

    check_availability: tool({
      description:
        "Free start times for a service, on one day or a few days in a row, with who is free at each. Only offer times from this list.",
      inputSchema: z.object({
        service_id: z.uuid().describe("A service id from business_info."),
        date: z
          .string()
          .refine(isIsoDate, "Use a date like 2026-10-05.")
          .describe(
            "The first day to check, in the business's time zone (YYYY-MM-DD).",
          ),
        days: z
          .number()
          .int()
          .min(1)
          .max(7)
          .default(1)
          .describe("How many days to check."),
        staff_id: z
          .uuid()
          .optional()
          .describe("Only this staff member; leave out for anyone free."),
      }),
      execute: (input, { toolCallId }) =>
        audited("check_availability", toolCallId, input, async () => {
          const service = await serviceOf(input.service_id);
          if (!service) {
            return {
              ok: false as const,
              message: "No such service here. Use the ids from business_info.",
            };
          }
          if (
            input.staff_id &&
            !service.performers.some((person) => person.id === input.staff_id)
          ) {
            return {
              ok: false as const,
              message: "That staff member doesn't offer this service.",
            };
          }
          const { data: slots, error } = await supabase.rpc("available_slots", {
            target_service_id: service.id,
            from_date: input.date,
            to_date: addDays(input.date, input.days - 1),
            target_staff_id: input.staff_id,
          });
          if (error)
            throw new Error(`Could not check availability: ${error.message}`);

          const names = new Map(
            service.performers.map((person) => [person.id, person.name]),
          );
          const byStart = new Map<string, string[]>();
          for (const slot of slots) {
            const staff = byStart.get(slot.starts_at) ?? [];
            staff.push(names.get(slot.staff_id) ?? "");
            byStart.set(slot.starts_at, staff);
          }
          const starts = [...byStart.keys()];
          const days = new Map<
            string,
            { time: string; starts_at: string; staff: string[] }[]
          >();
          for (const startsAt of starts.slice(0, MAX_TIMES)) {
            const day = formatDay(todayIn(timeZone, new Date(startsAt)));
            const times = days.get(day) ?? [];
            times.push({
              time: formatLocalTime(startsAt, timeZone),
              starts_at: startsAt,
              staff: byStart.get(startsAt) ?? [],
            });
            days.set(day, times);
          }
          return {
            ok: true as const,
            service: serviceNameIn(service, "en"),
            minutes: service.duration_minutes,
            price: formatAmount(service.price, service.currency),
            days: [...days].map(([day, times]) => ({ day, times })),
            ...(starts.length > MAX_TIMES && {
              note: "More times are free; ask the customer to narrow it down.",
            }),
          };
        }),
    }),

    book_appointment: tool({
      description:
        "Book an appointment, once the customer has chosen a service and a time from check_availability and given their name and phone number. The customer is then asked to confirm on screen; it is only booked if the result says ok.",
      inputSchema: bookInput,
      execute: (input, { toolCallId, messages }) =>
        audited("book_appointment", toolCallId, input, async () => {
          const service = await serviceOf(input.service_id);
          if (!service) {
            return { ok: false as const, message: "No such service here." };
          }
          const { data: booking, error } = await supabase.rpc(
            "book_appointment",
            {
              target_service_id: service.id,
              requested_start: input.starts_at,
              customer_name: input.customer_name,
              customer_phone: input.customer_phone,
              // One key per tool call: if this same call runs again, it returns the same booking.
              idempotency_key: `assistant:${toolCallId}`,
              target_staff_id: input.staff_id,
              customer_language: customerLanguage(messages),
              booking_notes: input.notes,
            },
          );
          if (error) {
            const refusal = refusalFor(error);
            if (refusal) return { ok: false as const, message: refusal };
            throw new Error(`Booking failed: ${error.message}`);
          }
          // The conversation now acts for this customer: they can manage this booking here.
          await updateConversation({ customer_id: booking.customer_id });
          return {
            ok: true as const,
            reference: booking.reference,
            service: serviceNameIn(service, customerLanguage(messages)),
            staff: await staffName(booking.staff_id),
            starts: formatLocalDateTime(booking.starts_at, timeZone),
            ends: formatLocalTime(booking.ends_at, timeZone),
            price: formatAmount(booking.price, booking.currency),
          };
        }),
    }),

    find_bookings: tool({
      description:
        "The customer's upcoming bookings. To see them, the customer must first prove they are theirs: give the reference of one of their bookings and their phone number. Once verified in this conversation, call it without arguments.",
      inputSchema: z.object({
        reference: reference.optional(),
        phone: z
          .string()
          .optional()
          .describe("The phone number the booking was made with."),
      }),
      execute: (input, { toolCallId, messages }) =>
        audited("find_bookings", toolCallId, input, async () => {
          const current = await conversation();
          let customerId = current.customer_id;
          if (input.reference && input.phone) {
            if (current.verification_failures >= MAX_VERIFICATION_FAILURES) {
              return {
                ok: false as const,
                message:
                  "Too many failed attempts in this conversation. Offer to put the customer in touch with the team.",
              };
            }
            const booking = await bookingOf(input.reference);
            const { data: customer } = booking
              ? await supabase
                  .from("customers")
                  .select("id, phone")
                  .eq("id", booking.customer_id)
                  .single()
              : { data: null };
            if (!customer || customer.phone !== normalizePhone(input.phone)) {
              await updateConversation({
                verification_failures: current.verification_failures + 1,
              });
              return {
                ok: false as const,
                message: "No booking matches that reference and phone number.",
              };
            }
            customerId = customer.id;
            await updateConversation({ customer_id: customer.id });
          }
          if (!customerId) {
            return {
              ok: false as const,
              message:
                "Ask the customer for one booking's reference and their phone number.",
            };
          }
          return {
            ok: true as const,
            bookings: await upcomingBookings(
              customerId,
              customerLanguage(messages),
            ),
          };
        }),
    }),

    reschedule_booking: tool({
      description:
        "Move one of the verified customer's bookings to a new time from check_availability. The customer is then asked to confirm on screen; it only moved if the result says ok.",
      inputSchema: rescheduleInput,
      execute: (input, { toolCallId }) =>
        audited("reschedule_booking", toolCallId, input, async () => {
          const booking = await ownBooking(input.reference);
          if (!booking) return notVerified;
          const { data: moved, error } = await supabase.rpc(
            "reschedule_booking",
            {
              target_booking_id: booking.id,
              new_start: input.new_starts_at,
              idempotency_key: `assistant:${toolCallId}`,
              target_staff_id: input.staff_id,
            },
          );
          if (error) {
            const refusal = refusalFor(error);
            if (refusal) return { ok: false as const, message: refusal };
            throw new Error(`Moving the booking failed: ${error.message}`);
          }
          return {
            ok: true as const,
            reference: moved.reference,
            starts: formatLocalDateTime(moved.starts_at, timeZone),
            ends: formatLocalTime(moved.ends_at, timeZone),
            staff: await staffName(moved.staff_id),
          };
        }),
    }),

    cancel_booking: tool({
      description:
        "Cancel one of the verified customer's bookings. The customer is then asked to confirm on screen; it is only cancelled if the result says ok.",
      inputSchema: cancelInput,
      execute: (input, { toolCallId }) =>
        audited("cancel_booking", toolCallId, input, async () => {
          const booking = await ownBooking(input.reference);
          if (!booking) return notVerified;
          const { data: cancelled, error } = await supabase.rpc(
            "cancel_booking",
            {
              target_booking_id: booking.id,
              idempotency_key: `assistant:${toolCallId}`,
            },
          );
          if (error) {
            const refusal = refusalFor(error);
            if (refusal) return { ok: false as const, message: refusal };
            throw new Error(`Cancelling the booking failed: ${error.message}`);
          }
          return {
            ok: true as const,
            reference: cancelled.reference,
            status: cancelled.status,
          };
        }),
    }),

    request_human: tool({
      description:
        "Hand the conversation to a person from the business: when the customer asks for one, when you don't know the answer and they want one, or when something can't be done here.",
      inputSchema: z.object({
        reason: z
          .string()
          .trim()
          .min(1)
          .max(300)
          .describe("Why, in a sentence, for the team."),
      }),
      execute: (input, { toolCallId }) =>
        audited("request_human", toolCallId, input, async () => {
          await updateConversation({ status: "needs_human" });
          return {
            ok: true as const,
            message:
              "The team has been asked to reply in this conversation. Tell the customer.",
          };
        }),
    }),
  };

  // Before the customer is asked: is the request possible, and how is it said in their language?
  // A request that can't go ahead is refused here, with the reason, and the model is told why.
  const toolApproval = {
    book_appointment: async (
      input: z.output<typeof bookInput>,
      {
        toolCallId,
        messages,
      }: { toolCallId: string; messages: ModelMessage[] },
    ) => {
      const service = await serviceOf(input.service_id);
      if (!service) {
        return refuse(
          "book_appointment",
          toolCallId,
          input,
          "No such service here. Use the ids from business_info.",
        );
      }
      const free = await isFree({
        serviceId: service.id,
        startsAt: input.starts_at,
        staffId: input.staff_id,
      });
      if (!free) {
        return refuse(
          "book_appointment",
          toolCallId,
          input,
          "That time isn't available. Check availability again and offer the customer other times.",
        );
      }
      const language = customerLanguage(messages);
      const endsAt = new Date(
        new Date(input.starts_at).getTime() + service.duration_minutes * 60_000,
      ).toISOString();
      return {
        type: "user-approval" as const,
        reason: bookingSummary(
          {
            serviceName: serviceNameIn(service, language),
            staffName: input.staff_id
              ? (service.performers.find(
                  (person) => person.id === input.staff_id,
                )?.name ?? null)
              : null,
            startsAt: input.starts_at,
            endsAt,
            price: service.price,
            currency: service.currency,
            customerName: input.customer_name,
            customerPhone: input.customer_phone,
          },
          timeZone,
          language,
        ),
      };
    },

    reschedule_booking: async (
      input: z.output<typeof rescheduleInput>,
      {
        toolCallId,
        messages,
      }: { toolCallId: string; messages: ModelMessage[] },
    ) => {
      const booking = await ownBooking(input.reference);
      if (!booking || booking.status !== "confirmed") {
        return refuse(
          "reschedule_booking",
          toolCallId,
          input,
          notVerified.message,
        );
      }
      if (tooLate(booking.starts_at)) {
        return refuse(
          "reschedule_booking",
          toolCallId,
          input,
          refusalFor({ code: "HB007" })!,
        );
      }
      const free = await isFree({
        serviceId: booking.service_id,
        startsAt: input.new_starts_at,
        staffId: input.staff_id ?? booking.staff_id,
        ignoredBookingId: booking.id,
      });
      if (!free) {
        return refuse(
          "reschedule_booking",
          toolCallId,
          input,
          "That time isn't available. Check availability again and offer the customer other times.",
        );
      }
      const language = customerLanguage(messages);
      return {
        type: "user-approval" as const,
        reason: rescheduleSummary(
          {
            reference: booking.reference,
            serviceName: serviceNameIn(booking.services, language),
            from: booking.starts_at,
            to: input.new_starts_at,
            staffName: input.staff_id ? await staffName(input.staff_id) : null,
          },
          timeZone,
          language,
        ),
      };
    },

    cancel_booking: async (
      input: z.output<typeof cancelInput>,
      {
        toolCallId,
        messages,
      }: { toolCallId: string; messages: ModelMessage[] },
    ) => {
      const booking = await ownBooking(input.reference);
      if (!booking || booking.status !== "confirmed") {
        return refuse("cancel_booking", toolCallId, input, notVerified.message);
      }
      if (tooLate(booking.starts_at)) {
        return refuse(
          "cancel_booking",
          toolCallId,
          input,
          refusalFor({ code: "HB007" })!,
        );
      }
      const language = customerLanguage(messages);
      return {
        type: "user-approval" as const,
        reason: cancellationSummary(
          {
            reference: booking.reference,
            serviceName: serviceNameIn(booking.services, language),
            startsAt: booking.starts_at,
          },
          timeZone,
          language,
        ),
      };
    },
  };

  /** Records that the customer declined an approval request (the tool never ran). */
  async function recordDeclined(call: {
    toolCallId: string;
    toolName: string;
    input: unknown;
  }) {
    await record({
      ...call,
      output: null,
      status: "declined",
      approved: false,
    });
  }

  return { tools, toolApproval, recordDeclined };
}
