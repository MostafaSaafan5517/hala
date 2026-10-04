import { streamText, tool, ToolLoopAgent } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { type FoundPassage, offlineChatModel } from "@/lib/ai/offline-chat";

function receptionist(passages: FoundPassage[]) {
  const questions: string[] = [];
  const agent = new ToolLoopAgent({
    model: offlineChatModel,
    tools: {
      search_knowledge: tool({
        inputSchema: z.object({ question: z.string() }),
        execute: async ({ question }) => {
          questions.push(question);
          return { passages };
        },
      }),
    },
  });
  return { agent, questions };
}

const parking: FoundPassage = {
  source: 1,
  title: "Is there parking?",
  text: "Yes, free parking behind the salon.",
};

describe("offlineChatModel", () => {
  it("looks the question up, then answers from the best passage, citing it", async () => {
    const { agent, questions } = receptionist([parking]);
    const result = await agent.generate({ prompt: "Where can I park?" });
    expect(questions).toEqual(["Where can I park?"]);
    expect(result.text).toBe(
      'Here\'s what I found in "Is there parking?" [1]:\nYes, free parking behind the salon.',
    );
    expect(result.steps).toHaveLength(2);
  });

  it("says it doesn't know, and offers a person, when nothing was found", async () => {
    const { agent } = receptionist([]);
    const result = await agent.generate({ prompt: "Can I bring my dog?" });
    expect(result.text).toContain("I don't know");
    expect(result.text).toContain("someone from the team");
  });

  it("answers in Arabic when asked in Arabic", async () => {
    const { agent } = receptionist([]);
    const result = await agent.generate({ prompt: "هل يمكنني إحضار كلبي؟" });
    expect(result.text).toContain("لا أعرف");
  });

  it("streams, and reports its usage", async () => {
    const result = streamText({
      model: offlineChatModel,
      prompt: "Hello there",
    });
    const parts: string[] = [];
    for await (const part of result.fullStream) parts.push(part.type);
    expect(parts).toContain("tool-call");
    expect((await result.usage).inputTokens).toBeGreaterThan(0);
  });
});

describe("offlineChatModel's one booking request", () => {
  function bookingAgent(times: string[]) {
    const calls: string[] = [];
    const agent = new ToolLoopAgent({
      model: offlineChatModel,
      tools: {
        business_info: tool({
          inputSchema: z.object({}),
          execute: async () => {
            calls.push("business_info");
            return {
              services: [
                { id: "service-1", name_en: "Haircut", name_ar: "قص شعر" },
              ],
            };
          },
        }),
        check_availability: tool({
          inputSchema: z.object({
            service_id: z.string(),
            date: z.string(),
            days: z.number(),
          }),
          execute: async (input) => {
            calls.push(`check_availability ${input.service_id} ${input.date}`);
            return {
              days: [
                {
                  times: times.map((time) => ({
                    time,
                    starts_at: `2026-10-05T${time}:00+03:00`,
                  })),
                },
              ],
            };
          },
        }),
        book_appointment: tool({
          inputSchema: z.object({
            service_id: z.string(),
            starts_at: z.string(),
            customer_name: z.string(),
            customer_phone: z.string(),
          }),
          execute: async (input) => {
            calls.push(
              `book_appointment ${input.starts_at} ${input.customer_name} ${input.customer_phone}`,
            );
            return { ok: true, reference: "7KQ2MX" };
          },
        }),
      },
    });
    return { agent, calls };
  }

  it("carries it out through the real tools, in order", async () => {
    const { agent, calls } = bookingAgent(["09:45", "10:00"]);
    const result = await agent.generate({
      prompt:
        "book haircut on 2026-10-05 at 10:00 for Mona Adel, +20 10 1234 5678",
    });
    expect(calls).toEqual([
      "business_info",
      "check_availability service-1 2026-10-05",
      "book_appointment 2026-10-05T10:00:00+03:00 Mona Adel +20 10 1234 5678",
    ]);
    expect(result.text).toBe("Booked! Your reference is 7KQ2MX.");
  });

  it("stops when the time isn't free, without booking", async () => {
    const { agent, calls } = bookingAgent(["09:45"]);
    const result = await agent.generate({
      prompt:
        "book Haircut on 2026-10-05 at 10:00 for Mona Adel, +20 10 1234 5678",
    });
    expect(calls).toEqual([
      "business_info",
      "check_availability service-1 2026-10-05",
    ]);
    expect(result.text).toBe("10:00 isn't free on 2026-10-05.");
  });
});
