"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/action-button";
import { memberForAction } from "@/lib/business";
import { reindexOutdated, saveDocument } from "@/lib/knowledge/indexing";
import {
  type KnowledgeKind,
  knowledgeKinds,
  MAX_TITLE_LENGTH,
} from "@/lib/knowledge/kinds";

export type DocumentFormFields = {
  language?: string;
  title?: string;
  body?: string;
};

export type DocumentFormState = {
  error: string | null;
  fields: DocumentFormFields;
};

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** The signed-in user's business, when they may change its knowledge base (owners and admins). */
async function managerFor(slug: string, currentPath: string) {
  const { supabase, member } = await memberForAction(slug, currentPath);
  return {
    supabase,
    business: member && member.role !== "staff" ? member.business : null,
  };
}

function documentSchema(kind: KnowledgeKind) {
  const { titleLabel, bodyLabel, maxBody } = knowledgeKinds[kind];
  return z.object({
    language: z.enum(["en", "ar"], "Choose English or Arabic."),
    title: z
      .string()
      .trim()
      .min(1, `Enter the ${titleLabel.toLowerCase()}.`)
      .max(
        MAX_TITLE_LENGTH,
        `Keep the ${titleLabel.toLowerCase()} under ${MAX_TITLE_LENGTH} characters.`,
      ),
    body: z
      .string()
      .trim()
      .min(1, `Enter the ${bodyLabel.toLowerCase()}.`)
      .max(
        maxBody,
        `Keep the ${bodyLabel.toLowerCase()} under ${maxBody} characters.`,
      ),
  });
}

/** Adds a document (documentId null) or edits one, and indexes it for search. */
export async function saveKnowledgeDocument(
  slug: string,
  kind: KnowledgeKind,
  documentId: string | null,
  _previous: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const fields: DocumentFormFields = {
    language: formText(formData, "language"),
    title: formText(formData, "title"),
    body: formText(formData, "body"),
  };
  const { supabase, business } = await managerFor(
    slug,
    `/dashboard/b/${slug}/knowledge`,
  );
  if (!business) {
    return {
      error: "Only owners and admins can change the knowledge base.",
      fields,
    };
  }
  const parsed = documentSchema(kind).safeParse(fields);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, fields };
  }

  let savedId: string | null;
  try {
    savedId = await saveDocument(supabase, {
      businessId: business.id,
      documentId,
      kind,
      ...parsed.data,
    });
  } catch (error) {
    console.error("Saving a knowledge document failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      error: "We couldn't save and index it. Please try again.",
      fields,
    };
  }
  if (!savedId) return { error: "That document no longer exists.", fields };

  redirect(`/dashboard/b/${slug}/knowledge?saved=1`);
}

/** Archives a document (search skips it) or restores it. */
export async function setDocumentActive(
  slug: string,
  documentId: string,
  active: boolean,
): Promise<ActionState> {
  const { supabase, business } = await managerFor(
    slug,
    `/dashboard/b/${slug}/knowledge`,
  );
  if (!business) {
    return { error: "Only owners and admins can change the knowledge base." };
  }

  const { data: changed, error } = await supabase
    .from("knowledge_documents")
    .update({ active })
    .eq("id", documentId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Archiving a knowledge document failed", {
      code: error.code,
    });
    return { error: "We couldn't change it. Please try again." };
  }
  if (!changed) return { error: "That document no longer exists." };

  refresh();
  return { error: null };
}

/** Re-embeds the documents indexed with another model, so search finds them again. */
export async function reindexKnowledge(slug: string): Promise<ActionState> {
  const { supabase, business } = await managerFor(
    slug,
    `/dashboard/b/${slug}/knowledge`,
  );
  if (!business) {
    return { error: "Only owners and admins can re-index the knowledge base." };
  }

  try {
    await reindexOutdated(supabase, business.id);
  } catch (error) {
    console.error("Re-indexing the knowledge base failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { error: "We couldn't re-index everything. Please try again." };
  }

  refresh();
  return { error: null };
}
