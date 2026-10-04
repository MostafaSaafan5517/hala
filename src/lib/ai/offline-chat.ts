import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";

/** A passage as the assistant's search_knowledge tool returns it. */
export type FoundPassage = { source: number; title: string; text: string };

const ARABIC = /[؀-ۿ]/;

// The one booking request the offline model understands, word for word, so the whole booking
// flow (availability, approval, booking) can be tried and tested without a real model:
// "book Haircut on 2026-10-05 at 10:00 for Mona Adel, +20 10 1234 5678".
const BOOK_COMMAND =
  /^book (.+) on (\d{4}-\d{2}-\d{2}) at (\d{2}:\d{2}) for (.+), (\+[\d ]+)$/i;

const replies = {
  found: {
    en: (passage: FoundPassage) =>
      `Here's what I found in "${passage.title}" [${passage.source}]:\n${passage.text}`,
    ar: (passage: FoundPassage) =>
      `هذا ما وجدته في «${passage.title}» [${passage.source}]:\n${passage.text}`,
  },
  unknown: {
    en: "I'm sorry, I don't know the answer to that. Would you like me to put you in touch with someone from the team?",
    ar: "عذرًا، لا أعرف الإجابة عن ذلك. هل تريد أن أوصلك بأحد من فريق العمل؟",
  },
};

type Step = {
  content: LanguageModelV4Content[];
  finishReason: LanguageModelV4FinishReason;
};

function textOf(content: readonly { type: string; text?: string }[]) {
  return content
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join(" ");
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function say(text: string): Step {
  return {
    content: [{ type: "text", text }],
    finishReason: { unified: "stop", raw: undefined },
  };
}

function call(toolName: string, input: unknown): Step {
  return {
    content: [
      {
        type: "tool-call",
        toolCallId: `offline-${crypto.randomUUID()}`,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls", raw: undefined },
  };
}

/**
 * The tools' results since the customer's latest message, by tool name: their JSON output, or
 * "declined" when the customer didn't approve.
 */
function resultsSinceLatestQuestion(prompt: LanguageModelV4Prompt) {
  const latest = prompt.findLastIndex((message) => message.role === "user");
  const results = new Map<string, unknown>();
  for (const message of prompt.slice(latest + 1)) {
    if (message.role !== "tool") continue;
    for (const part of message.content) {
      if (part.type !== "tool-result") continue;
      results.set(
        part.toolName,
        part.output.type === "json"
          ? part.output.value
          : part.output.type === "execution-denied"
            ? "declined"
            : null,
      );
    }
  }
  return results;
}

function bookingStep(
  command: RegExpExecArray,
  results: Map<string, unknown>,
): Step {
  const [, serviceName = "", date = "", time = "", name = "", phone = ""] =
    command;
  const booked = results.get("book_appointment") as
    | { ok?: boolean; reference?: string; message?: string }
    | "declined"
    | undefined;
  if (booked !== undefined) {
    return say(
      booked !== "declined" && booked.ok
        ? `Booked! Your reference is ${booked.reference}.`
        : "I haven't booked it.",
    );
  }
  const availability = results.get("check_availability") as
    { days?: { times: { time: string; starts_at: string }[] }[] } | undefined;
  const info = results.get("business_info") as
    | {
        services?: {
          id: string;
          name_en: string | null;
          name_ar: string | null;
        }[];
      }
    | undefined;
  const service = info?.services?.find((candidate) =>
    [candidate.name_en, candidate.name_ar].some(
      (known) => known?.toLowerCase() === serviceName.trim().toLowerCase(),
    ),
  );
  if (!info) return call("business_info", {});
  if (!service) return say(`I couldn't find a service called ${serviceName}.`);
  if (!availability) {
    return call("check_availability", {
      service_id: service.id,
      date,
      days: 1,
    });
  }
  const slot = availability.days
    ?.flatMap((day) => day.times)
    .find((candidate) => candidate.time === time);
  if (!slot) return say(`${time} isn't free on ${date}.`);
  return call("book_appointment", {
    service_id: service.id,
    starts_at: slot.starts_at,
    customer_name: name.trim(),
    customer_phone: phone.trim(),
  });
}

/** Decides the next step from the conversation so far. */
function nextStep(options: LanguageModelV4CallOptions): Step {
  const lastUser = options.prompt.findLast(
    (message) => message.role === "user",
  );
  const question = lastUser ? textOf(lastUser.content).trim() : "";
  const results = resultsSinceLatestQuestion(options.prompt);

  const command = BOOK_COMMAND.exec(question);
  if (command) return bookingStep(command, results);

  if (!results.has("search_knowledge")) {
    return call("search_knowledge", { question });
  }
  const language = ARABIC.test(question) ? "ar" : "en";
  const found = results.get("search_knowledge") as {
    passages?: FoundPassage[];
  } | null;
  const best = found?.passages?.[0];
  return say(best ? replies.found[language](best) : replies.unknown[language]);
}

function usageOf(
  options: LanguageModelV4CallOptions,
  content: LanguageModelV4Content[],
): LanguageModelV4Usage {
  const input = wordCount(JSON.stringify(options.prompt));
  const output = wordCount(
    content.map((part) => ("text" in part ? part.text : "")).join(" "),
  );
  return {
    inputTokens: {
      total: input,
      noCache: input,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: output, text: output, reasoning: undefined },
  };
}

/**
 * A rule-based stand-in for a chat model, for tests and for developing without an API key
 * (CHAT_MODEL=offline). It looks every question up with search_knowledge and answers with the
 * best passage, citing it, or says it doesn't know and offers a person. It understands one
 * booking request, word for word ("book Haircut on 2026-10-05 at 10:00 for Mona Adel, +20 10
 * 1234 5678"), which it carries out through the real tools, approval included. Anything else
 * takes a real model.
 */
export const offlineChatModel: LanguageModelV4 = {
  specificationVersion: "v4",
  provider: "hala",
  modelId: "offline",
  supportedUrls: {},
  async doGenerate(options) {
    const step = nextStep(options);
    return {
      ...step,
      usage: usageOf(options, step.content),
      warnings: [],
    };
  },
  async doStream(options) {
    const step = nextStep(options);
    const parts: LanguageModelV4StreamPart[] = [
      { type: "stream-start", warnings: [] },
    ];
    for (const part of step.content) {
      if (part.type === "text") {
        const id = crypto.randomUUID();
        parts.push(
          { type: "text-start", id },
          { type: "text-delta", id, delta: part.text },
          { type: "text-end", id },
        );
      } else if (part.type === "tool-call") {
        parts.push(part);
      }
    }
    parts.push({
      type: "finish",
      finishReason: step.finishReason,
      usage: usageOf(options, step.content),
    });
    return {
      stream: new ReadableStream({
        start(controller) {
          for (const part of parts) controller.enqueue(part);
          controller.close();
        },
      }),
    };
  },
};
