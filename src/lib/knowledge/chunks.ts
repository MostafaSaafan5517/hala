import { createHash } from "node:crypto";

/**
 * The most characters of a policy's text in one passage: about 300 tokens. Small enough that a
 * match points at the part of a policy that answers the question, large enough to keep related
 * sentences together.
 */
export const MAX_PASSAGE_CHARACTERS = 1200;

export type DocumentText = {
  kind: "faq" | "policy";
  title: string;
  body: string;
};

// A sentence ends at . ! ? or the Arabic question mark ؟, keeping its punctuation.
function sentencesOf(paragraph: string) {
  return (paragraph.match(/[^.!?؟]+[.!?؟]*/g) ?? [paragraph])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

// A sentence too long for a passage (rare: no punctuation at all) is cut between words.
function piecesOf(sentence: string) {
  if (sentence.length <= MAX_PASSAGE_CHARACTERS) return [sentence];
  const pieces: string[] = [];
  let piece = "";
  for (const word of sentence.split(/\s+/)) {
    if (piece && piece.length + 1 + word.length > MAX_PASSAGE_CHARACTERS) {
      pieces.push(piece);
      piece = "";
    }
    piece = piece ? `${piece} ${word}` : word;
  }
  if (piece) pieces.push(piece);
  return pieces;
}

// Packs pieces of text, in order, into passages of at most MAX_PASSAGE_CHARACTERS.
function pack(pieces: string[], separator: string) {
  const passages: string[] = [];
  let passage = "";
  for (const piece of pieces) {
    if (
      passage &&
      passage.length + separator.length + piece.length > MAX_PASSAGE_CHARACTERS
    ) {
      passages.push(passage);
      passage = "";
    }
    passage = passage ? `${passage}${separator}${piece}` : piece;
  }
  if (passage) passages.push(passage);
  return passages;
}

/**
 * Splits a document into the passages search returns.
 *
 * An FAQ is one passage, the question and its answer together: customers' questions match the
 * question, and the answer is what gets cited.
 *
 * A policy is packed into passages of whole paragraphs; a paragraph too long for one passage is
 * split between sentences. Each passage starts with the policy's title, so it still makes sense
 * when it's the only part retrieved.
 */
export function passagesOf(document: DocumentText): string[] {
  const title = document.title.trim();
  const body = document.body.trim();
  if (document.kind === "faq") return [`${title}\n${body}`];

  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) =>
      paragraph.length <= MAX_PASSAGE_CHARACTERS
        ? [paragraph]
        : pack(sentencesOf(paragraph).flatMap(piecesOf), " "),
    );
  return pack(paragraphs, "\n\n").map((passage) => `${title}\n${passage}`);
}

/** A passage's SHA-256, in hex: unchanged passages keep their embedding when a document is edited. */
export function contentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}
