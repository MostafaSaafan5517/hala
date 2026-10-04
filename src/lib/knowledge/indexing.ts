import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embeddingModelId, embedTexts } from "@/lib/ai/embeddings";
import {
  contentHash,
  type DocumentText,
  needsReindexing,
  passagesOf,
} from "@/lib/knowledge/chunks";
import type { Database, Enums } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type DocumentInput = DocumentText & {
  businessId: string;
  /** Null for a new document. */
  documentId: string | null;
  language: Enums<"language">;
};

/**
 * Splits a document into passages, embeds the ones that need it, and saves the document with its
 * passages in one transaction. Runs as the signed-in user: the database checks they may change
 * the knowledge base. Returns the document's id, or null when it no longer exists.
 */
export async function saveDocument(supabase: Client, input: DocumentInput) {
  const model = embeddingModelId();
  const passages = passagesOf(input);

  // A passage that hasn't changed (same text, same model) keeps its embedding, so editing one
  // paragraph of a long policy re-embeds only that paragraph.
  const embeddings = new Map<string, string>();
  if (input.documentId) {
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("content_hash, embedding")
      .eq("document_id", input.documentId)
      .eq("embedding_model", model);
    if (error) {
      throw new Error(
        `Could not load the document's passages: ${error.message}`,
      );
    }
    for (const chunk of data)
      embeddings.set(chunk.content_hash, chunk.embedding);
  }
  const toEmbed = [
    ...new Set(
      passages.filter((passage) => !embeddings.has(contentHash(passage))),
    ),
  ];
  if (toEmbed.length > 0) {
    const result = await embedTexts({
      businessId: input.businessId,
      purpose: "index",
      values: toEmbed,
    });
    toEmbed.forEach((passage, index) => {
      embeddings.set(
        contentHash(passage),
        JSON.stringify(result.embeddings[index]),
      );
    });
  }

  const { data: documentId, error } = await supabase.rpc(
    "save_knowledge_document",
    {
      target_business_id: input.businessId,
      document_kind: input.kind,
      document_language: input.language,
      document_title: input.title,
      document_body: input.body,
      chunks: passages.map((content) => ({
        content,
        content_hash: contentHash(content),
        embedding: embeddings.get(contentHash(content)),
      })),
      chunks_model: model,
      target_document_id: input.documentId ?? undefined,
    },
  );
  if (error) throw new Error(`Could not save the document: ${error.message}`);
  return documentId;
}

/**
 * Re-embeds every document of a business whose passages were embedded by another model (after
 * EMBEDDING_MODEL changes): until then, search skips them. Returns how many were re-indexed.
 */
export async function reindexOutdated(supabase: Client, businessId: string) {
  const model = embeddingModelId();
  const { data: documents, error } = await supabase
    .from("knowledge_documents")
    .select(
      "id, kind, language, title, body, knowledge_chunks (embedding_model)",
    )
    .eq("business_id", businessId);
  if (error) throw new Error(`Could not load the documents: ${error.message}`);

  const outdated = documents.filter((document) =>
    needsReindexing(
      document.knowledge_chunks.map((chunk) => chunk.embedding_model),
      model,
    ),
  );
  for (const document of outdated) {
    await saveDocument(supabase, {
      businessId,
      documentId: document.id,
      kind: document.kind,
      language: document.language,
      title: document.title,
      body: document.body,
    });
  }
  return outdated.length;
}
