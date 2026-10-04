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
