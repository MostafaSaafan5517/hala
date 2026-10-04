import "server-only";
import { embedMany, gateway } from "ai";
import {
  EMBEDDING_MODELS,
  type EmbeddingModelId,
  embeddingCostUsd,
  isEmbeddingModelId,
} from "@/lib/ai/catalog";
import { offlineEmbeddingModel } from "@/lib/ai/offline-embedding";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The embedding model in use, from EMBEDDING_MODEL: a model ID from the catalog, called through
 * the Vercel AI Gateway, or "offline". Unset or unknown is an error, never a silent default.
 */
export function embeddingModelId(): EmbeddingModelId {
  const id = process.env.EMBEDDING_MODEL;
  if (!id || !isEmbeddingModelId(id)) {
    throw new Error(
      `EMBEDDING_MODEL must be one of ${Object.keys(EMBEDDING_MODELS).join(", ")} (see .env.example).`,
    );
  }
  return id;
}

/** How similar a passage must be to a question to count as relevant, for the model in use. */
export function minSimilarity() {
  return EMBEDDING_MODELS[embeddingModelId()].minSimilarity;
}

/**
 * Embeds texts for a business, and records the call (tokens, cost, time, failure) in the model
 * usage log. A failed call is recorded too, then rethrown.
 */
export async function embedTexts(options: {
  businessId: string;
  purpose: "index" | "search";
  values: string[];
}) {
  const model = embeddingModelId();
  const started = performance.now();
  let tokens = 0;
  let failure: string | null = null;
  try {
    const result = await embedMany({
      model:
        model === "offline"
          ? offlineEmbeddingModel
          : gateway.embeddingModel(model),
      values: options.values,
    });
    tokens = result.usage.tokens;
    return { model, embeddings: result.embeddings };
  } catch (error) {
    failure = error instanceof Error ? error.name : "UnknownError";
    throw error;
  } finally {
    const { error } = await createAdminClient()
      .from("model_calls")
      .insert({
        business_id: options.businessId,
        purpose: options.purpose,
        model,
        input_tokens: tokens,
        cost_usd: embeddingCostUsd(model, tokens),
        latency_ms: Math.round(performance.now() - started),
        error: failure,
      });
    // The call has already happened (and cost what it cost): a logging failure is reported, but
    // doesn't undo the user's request.
    if (error) {
      console.error("Recording a model call failed", { code: error.code });
    }
  }
}
