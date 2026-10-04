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
