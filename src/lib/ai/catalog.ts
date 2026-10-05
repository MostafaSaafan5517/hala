// The embedding models Hala supports, with what we need to know about each: its price, to log
// what every call costs, and how similar a passage must be to a question to count as relevant.
// Prices are from the AI Gateway's model list (checked 2026-10-05). Each must return 1536
// dimensions, the size the database stores. Cohere's embed-v4.0 (multilingual) is on the
// gateway's free tier; OpenAI's isn't. The evaluation suite's retrieval report sets the
// thresholds.
export const EMBEDDING_MODELS = {
  // 0.3, from the retrieval report (2026-10-05): the right passage ranked first for all 13
  // answerable questions, but scores sit in a narrow band; 0.3 keeps 12 of them, while 0.4 would
  // drop three ("Where can I leave my car?"). An unanswerable question may still get a passage
  // on a nearby topic (gift cards: the card-payment FAQ); the assistant answers only from what
  // a passage says, which the evaluation's "unknown" cases check.
  "cohere/embed-v4.0": { usdPerMillionTokens: 0.12, minSimilarity: 0.3 },
  "openai/text-embedding-3-small": {
    usdPerMillionTokens: 0.02,
    minSimilarity: 0.3,
  },
  offline: { usdPerMillionTokens: 0, minSimilarity: 0.2 },
} as const;

export type EmbeddingModelId = keyof typeof EMBEDDING_MODELS;

export function isEmbeddingModelId(id: string): id is EmbeddingModelId {
  return Object.hasOwn(EMBEDDING_MODELS, id);
}

/** What an embedding call cost, in US dollars. */
export function embeddingCostUsd(model: EmbeddingModelId, tokens: number) {
  return (tokens * EMBEDDING_MODELS[model].usdPerMillionTokens) / 1_000_000;
}

// The chat models the assistant can run on, with their prices per million input and output
// tokens (from the AI Gateway's model list, checked 2026-10-05). The gateway's free monthly
// credit covers only some models: GPT-4.1 mini, GPT-5 mini and Gemini 2.5 Flash, not Claude,
// and the evaluation suite compares them. Claude Haiku and Sonnet need paid credit. Ling 3.1
// Flash costs nothing, but unlike the others it promises neither zero data retention nor no
// training on prompts, so it suits tests and evaluations more than real customers. "offline"
// is the rule-based stand-in for tests.
export const CHAT_MODELS = {
  "openai/gpt-4.1-mini": { usdPerMillionInput: 0.4, usdPerMillionOutput: 1.6 },
  "openai/gpt-5-mini": { usdPerMillionInput: 0.25, usdPerMillionOutput: 2 },
  "google/gemini-2.5-flash": {
    usdPerMillionInput: 0.3,
    usdPerMillionOutput: 2.5,
  },
  "anthropic/claude-haiku-4.5": {
    usdPerMillionInput: 1,
    usdPerMillionOutput: 5,
  },
  "anthropic/claude-sonnet-5.5": {
    usdPerMillionInput: 2,
    usdPerMillionOutput: 10,
  },
  "openai/gpt-5.4-mini": { usdPerMillionInput: 0.75, usdPerMillionOutput: 4.5 },
  "inclusionai/ling-3.1-flash-free": {
    usdPerMillionInput: 0,
    usdPerMillionOutput: 0,
  },
  offline: { usdPerMillionInput: 0, usdPerMillionOutput: 0 },
} as const;

export type ChatModelId = keyof typeof CHAT_MODELS;

export function isChatModelId(id: string): id is ChatModelId {
  return Object.hasOwn(CHAT_MODELS, id);
}

/** What a chat call cost, in US dollars. */
export function chatCostUsd(
  model: ChatModelId,
  inputTokens: number,
  outputTokens: number,
) {
  const { usdPerMillionInput, usdPerMillionOutput } = CHAT_MODELS[model];
  return (
    (inputTokens * usdPerMillionInput + outputTokens * usdPerMillionOutput) /
    1_000_000
  );
}
