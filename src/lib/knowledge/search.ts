import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  embeddingModelId,
  embedTexts,
  minSimilarity,
} from "@/lib/ai/embeddings";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The passages of a business's knowledge that answer a question, best first (search_knowledge:
 * by meaning and by rare keywords). An empty list means nothing relevant was found. The question
 * is embedded with the model in use, and the call is logged like every model call.
 */
export async function searchKnowledge(
  supabase: SupabaseClient<Database>,
  options: { businessId: string; question: string; limit?: number },
) {
  const model = embeddingModelId();
  const { embeddings } = await embedTexts({
    businessId: options.businessId,
    purpose: "search",
    values: [options.question],
  });
  const { data, error } = await supabase.rpc("search_knowledge", {
    target_business_id: options.businessId,
    query_text: options.question,
    query_embedding: JSON.stringify(embeddings[0]),
    query_model: model,
    min_similarity: minSimilarity(),
    match_count: options.limit,
  });
  if (error)
    throw new Error(`Could not search the knowledge: ${error.message}`);
  return data;
}
