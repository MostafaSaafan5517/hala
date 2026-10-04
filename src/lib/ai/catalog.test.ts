import { describe, expect, it } from "vitest";
import {
  chatCostUsd,
  embeddingCostUsd,
  isChatModelId,
  isEmbeddingModelId,
} from "@/lib/ai/catalog";

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

describe("chatCostUsd", () => {
  it("prices input and output tokens at the model's own rates", () => {
    expect(
      chatCostUsd("anthropic/claude-sonnet-5.5", 1_000_000, 100_000),
    ).toBeCloseTo(3);
    expect(chatCostUsd("openai/gpt-5.4-mini", 2000, 500)).toBeCloseTo(0.00375);
    expect(chatCostUsd("offline", 5000, 5000)).toBe(0);
  });

  it("knows only the chat models in the catalog", () => {
    expect(isChatModelId("anthropic/claude-sonnet-5.5")).toBe(true);
    expect(isChatModelId("anthropic/claude-opus-5.5")).toBe(false);
  });
});
