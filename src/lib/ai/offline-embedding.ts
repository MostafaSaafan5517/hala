import type { EmbeddingModelV4 } from "@ai-sdk/provider";

/** The length of every embedding we store: the database column is vector(1536). */
export const EMBEDDING_DIMENSIONS = 1536;

// Arabic is written with optional vowel marks and several forms of some letters, and words take
// the article "ال" (often with a preposition: "لل", "بال", ...). A word that starts like the
// article is kept both whole and without it, since the letters alone can't tell an article from
// a word that starts that way (إلغاء normalizes to الغاء). The database's keyword search
// (private.search_words) normalizes the same way.
function formsOf(word: string) {
  const plain = word
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replaceAll("ة", "ه")
    .replaceAll("ى", "ي");
  const stem = plain.replace(/^(?:وال|بال|كال|فال|لل|ال)/, "");
  return stem !== plain && stem.length >= 2 ? [plain, stem] : [plain];
}

/** The words of a text, lowercased and normalized (with both forms of article-like words). */
export function wordsOf(text: string) {
  return (
    text
      .toLowerCase()
      // Marks (Arabic vowel marks) belong to their word; formsOf removes them.
      .split(/[^\p{L}\p{M}\p{N}]+/u)
      .filter(Boolean)
      .flatMap(formsOf)
  );
}

// FNV-1a: a small, fast, well-spread string hash.
function hash(text: string) {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/**
 * A deterministic stand-in for an embedding: each word adds +1 or -1 to one of the 1536
 * dimensions, chosen by its hash, and the result has length 1. Texts that share words point the
 * same way; texts that don't are close to unrelated.
 */
export function offlineEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const word of wordsOf(text)) {
    const wordHash = hash(word);
    vector[wordHash % EMBEDDING_DIMENSIONS]! +=
      hash(`sign:${word}`) % 2 === 0 ? 1 : -1;
  }
  const length = Math.hypot(...vector);
  // A text without words still needs a direction: cosine distance is undefined for zero.
  if (length === 0) return vector.map((_, index) => (index === 0 ? 1 : 0));
  return vector.map((value) => value / length);
}

/**
 * An embedding model that runs offline, for tests and for developing without an API key. It
 * only knows words, not meaning ("parking" won't find "car park"), so retrieval quality is only
 * ever judged with a real model. Selected with EMBEDDING_MODEL=offline.
 */
export const offlineEmbeddingModel: EmbeddingModelV4 = {
  specificationVersion: "v4",
  provider: "hala",
  modelId: "offline",
  maxEmbeddingsPerCall: Infinity,
  supportsParallelCalls: true,
  async doEmbed({ values }) {
    return {
      embeddings: values.map(offlineEmbedding),
      usage: {
        tokens: values.reduce((sum, value) => sum + wordsOf(value).length, 0),
      },
      warnings: [],
    };
  },
};
