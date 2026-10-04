import { describe, expect, it } from "vitest";
import { embeddingCostUsd, isEmbeddingModelId } from "@/lib/ai/catalog";

describe("isEmbeddingModelId", () => {
  it("accepts only the models we know the price of", () => {
    expect(isEmbeddingModelId("openai/text-embedding-3-small")).toBe(true);
    expect(isEmbeddingModelId("offline")).toBe(true);
    expect(isEmbeddingModelId("openai/text-embedding-3-large")).toBe(false);
    expect(isEmbeddingModelId("toString")).toBe(false);
  });
});

describe("embeddingCostUsd", () => {
  it("prices tokens at the model's rate per million", () => {
    expect(
      embeddingCostUsd("openai/text-embedding-3-small", 1_000_000),
    ).toBeCloseTo(0.02);
    expect(embeddingCostUsd("openai/text-embedding-3-small", 500)).toBeCloseTo(
      0.00001,
    );
    expect(embeddingCostUsd("offline", 10_000)).toBe(0);
  });
});
