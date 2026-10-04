import type { Enums } from "@/lib/supabase/database.types";

export type KnowledgeKind = Enums<"knowledge_kind">;

/** The longest title a document can have (the database's limit). */
export const MAX_TITLE_LENGTH = 200;

/**
 * How each kind of document is named and edited. An FAQ answer is kept short (it is one
 * passage); a policy can be long, and is split into passages by its blank lines.
 */
export const knowledgeKinds = {
  faq: {
    name: "FAQ",
    plural: "FAQs",
    newLabel: "New FAQ",
    editLabel: "Edit FAQ",
    empty: "No FAQs yet.",
    titleLabel: "Question",
    bodyLabel: "Answer",
    maxBody: 2000,
    hint: "Write the question the way customers ask it, and answer it fully.",
  },
  policy: {
    name: "Policy",
    plural: "Policies",
    newLabel: "New policy",
    editLabel: "Edit policy",
    empty: "No policies yet.",
    titleLabel: "Title",
    bodyLabel: "Text",
    maxBody: 20000,
    hint: "Separate topics with a blank line: each part can be found on its own.",
  },
} as const satisfies Record<KnowledgeKind, unknown>;

export function isKnowledgeKind(value: unknown): value is KnowledgeKind {
  return value === "faq" || value === "policy";
}
