import { describe, expect, it } from "vitest";
import {
  contentHash,
  MAX_PASSAGE_CHARACTERS,
  needsReindexing,
  passagesOf,
} from "@/lib/knowledge/chunks";

describe("passagesOf", () => {
  it("keeps an FAQ's question and answer together in one passage", () => {
    expect(
      passagesOf({
        kind: "faq",
        title: " Is there parking? ",
        body: "Yes, free parking behind the salon.\n\nAsk at reception for a pass.",
      }),
    ).toEqual([
      "Is there parking?\nYes, free parking behind the salon.\n\nAsk at reception for a pass.",
    ]);
  });

  it("keeps a short policy in one passage, starting with its title", () => {
    expect(
      passagesOf({
        kind: "policy",
        title: "Cancellations",
        body: "Cancel up to a day before.\n\nLate cancellations are charged half.",
      }),
    ).toEqual([
      "Cancellations\nCancel up to a day before.\n\nLate cancellations are charged half.",
    ]);
  });

  it("packs a long policy into passages of whole paragraphs, each with the title", () => {
    const paragraph = (letter: string) => `${letter.repeat(500)}.`;
    const passages = passagesOf({
      kind: "policy",
      title: "Payments",
      body: ["a", "b", "c", "d"].map(paragraph).join("\n\n"),
    });
    expect(passages).toEqual([
      `Payments\n${paragraph("a")}\n\n${paragraph("b")}`,
      `Payments\n${paragraph("c")}\n\n${paragraph("d")}`,
    ]);
  });

  it("splits a paragraph too long for one passage between sentences, Arabic ones too", () => {
    const sentence = `${"كلمة ".repeat(100).trim()}؟`;
    const passages = passagesOf({
      kind: "policy",
      title: "سياسة الإلغاء",
      body: Array(5).fill(sentence).join(" "),
    });
    expect(passages).toHaveLength(3);
    for (const passage of passages) {
      expect(passage.startsWith("سياسة الإلغاء\n")).toBe(true);
      expect(passage.endsWith("؟")).toBe(true);
      expect(passage.length).toBeLessThanOrEqual(
        "سياسة الإلغاء\n".length + MAX_PASSAGE_CHARACTERS,
      );
    }
  });

  it("cuts a sentence with no punctuation at all between words", () => {
    const passages = passagesOf({
      kind: "policy",
      title: "Notes",
      body: "word ".repeat(600).trim(),
    });
    expect(passages.length).toBeGreaterThan(1);
    for (const passage of passages) {
      expect(passage.length).toBeLessThanOrEqual(
        "Notes\n".length + MAX_PASSAGE_CHARACTERS,
      );
      expect(passage).toMatch(/^Notes\n(word )*word$/);
    }
  });
});

describe("contentHash", () => {
  it("is the SHA-256 of the text, in hex", () => {
    expect(contentHash("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("needsReindexing", () => {
  it("is false when every passage was embedded by the model in use", () => {
    expect(needsReindexing(["offline", "offline"], "offline")).toBe(false);
  });

  it("is true when any passage came from another model, or there are none", () => {
    expect(
      needsReindexing(["offline", "openai/text-embedding-3-small"], "offline"),
    ).toBe(true);
    expect(needsReindexing([], "offline")).toBe(true);
  });
});
