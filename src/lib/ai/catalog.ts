// The embedding models Hala supports, with what we need to know about each: its price, to log
// what every call costs, and how similar a passage must be to a question to count as relevant.
// Prices are from the AI Gateway's model list (checked 2026-10-04). The similarity thresholds
// are starting points; the evaluation suite (Phase 6) tunes them against real questions.
export const EMBEDDING_MODELS = {
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
// tokens (from the AI Gateway's model list, checked 2026-10-04). Claude Sonnet is the default;
// the others are there to switch provider or cost by configuration, and the evaluation suite
// (Phase 6) compares them. "offline" is the rule-based stand-in used by the tests.
export const CHAT_MODELS = {
  "anthropic/claude-sonnet-5.5": {
    usdPerMillionInput: 2,
    usdPerMillionOutput: 10,
  },
  "anthropic/claude-haiku-4.5": {
    usdPerMillionInput: 1,
    usdPerMillionOutput: 5,
  },
  "openai/gpt-5.4-mini": { usdPerMillionInput: 0.75, usdPerMillionOutput: 4.5 },
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
