import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";

/** A passage as the assistant's search_knowledge tool returns it. */
export type FoundPassage = { source: number; title: string; text: string };

const ARABIC = /[؀-ۿ]/;

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

function textOf(content: readonly { type: string; text?: string }[]) {
  return content
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join(" ");
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Decides the next step: look the latest question up, or answer from what the lookup found.
 */
function nextStep(options: LanguageModelV4CallOptions): {
  content: LanguageModelV4Content[];
  finishReason: LanguageModelV4FinishReason;
} {
  const messages = options.prompt;
  const lastUser = messages.findLast((message) => message.role === "user");
  const question = lastUser ? textOf(lastUser.content) : "";
  const language = ARABIC.test(question) ? "ar" : "en";
  const last = messages.at(-1);

  const searchResult =
    last?.role === "tool"
      ? last.content.find(
          (part) =>
            part.type === "tool-result" && part.toolName === "search_knowledge",
        )
      : undefined;
  if (searchResult?.type === "tool-result") {
    const output = searchResult.output;
    const passages =
      output.type === "json"
        ? ((output.value as { passages?: FoundPassage[] }).passages ?? [])
        : [];
    const best = passages[0];
    return {
      content: [
        {
          type: "text",
          text: best
            ? replies.found[language](best)
            : replies.unknown[language],
        },
      ],
      finishReason: { unified: "stop", raw: undefined },
    };
  }

  return {
    content: [
      {
        type: "tool-call",
        toolCallId: `offline-${crypto.randomUUID()}`,
        toolName: "search_knowledge",
        input: JSON.stringify({ question }),
      },
    ],
    finishReason: { unified: "tool-calls", raw: undefined },
  };
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
 * (CHAT_MODEL=offline). It only does what the knowledge base can do on its own: it looks every
 * question up with search_knowledge and answers with the best passage, citing it, or says it
 * doesn't know and offers a person. It never books, moves or cancels: that takes a real model.
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
