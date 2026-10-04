import { cosineSimilarity, embedMany } from "ai";
import { describe, expect, it } from "vitest";
import {
  EMBEDDING_DIMENSIONS,
  offlineEmbedding,
  offlineEmbeddingModel,
  wordsOf,
} from "@/lib/ai/offline-embedding";

describe("wordsOf", () => {
  it("lowercases and splits on anything that isn't a letter or digit", () => {
    expect(wordsOf("Free parking, Visa accepted!")).toEqual([
      "free",
      "parking",
      "visa",
      "accepted",
    ]);
  });

  it("normalizes Arabic spelling variants and vowel marks", () => {
    expect(wordsOf("إلغاء")).toEqual(wordsOf("الغاء"));
    expect(wordsOf("مَوْقِف")).toEqual(wordsOf("موقف"));
  });

  it("keeps words that start like the article both whole and without it", () => {
    expect(wordsOf("للسيارات")).toEqual(["للسيارات", "سيارات"]);
    expect(wordsOf("السيارات")).toContain("سيارات");
    expect(wordsOf("الساعة")).toContain("ساعه");
    expect(wordsOf("الإلغاء")).toContain("الغاء");
  });
});

describe("offlineEmbedding", () => {
  it("is deterministic, of the stored length, and of length 1", () => {
    const embedding = offlineEmbedding("Do you have parking?");
    expect(embedding).toEqual(offlineEmbedding("Do you have parking?"));
    expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(Math.hypot(...embedding)).toBeCloseTo(1);
  });

  it("puts texts that share words closer than texts that don't", () => {
    const question = offlineEmbedding("Is there parking near the salon?");
    const parking = offlineEmbedding(
      "Free parking is available behind the salon.",
    );
    const payment = offlineEmbedding("We accept cash and Visa cards.");
    expect(cosineSimilarity(question, parking)).toBeGreaterThan(
      cosineSimilarity(question, payment) + 0.2,
    );
  });

  it("matches Arabic however it is spelled", () => {
    expect(
      cosineSimilarity(
        offlineEmbedding("هل يوجد موقف للسيارات؟"),
        offlineEmbedding("يوجد مَوْقِف سيارات مجاني خلف الصالون"),
      ),
    ).toBeGreaterThan(0.3);
  });

  it("still has a direction when there are no words", () => {
    expect(Math.hypot(...offlineEmbedding("?!"))).toBeCloseTo(1);
  });
});

describe("offlineEmbeddingModel", () => {
  it("works as an AI SDK embedding model, reporting words as tokens", async () => {
    const { embeddings, usage } = await embedMany({
      model: offlineEmbeddingModel,
      values: ["free parking", "cash or card"],
    });
    expect(embeddings).toEqual([
      offlineEmbedding("free parking"),
      offlineEmbedding("cash or card"),
    ]);
    expect(usage.tokens).toBe(5);
  });
});
