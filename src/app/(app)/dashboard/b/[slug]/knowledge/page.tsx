import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import {
  reindexKnowledge,
  setDocumentActive,
} from "@/app/(app)/dashboard/b/[slug]/knowledge/actions";
import { ActionButton } from "@/components/action-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { embeddingModelId } from "@/lib/ai/embeddings";
import { requireMemberBusiness } from "@/lib/business";
import { needsReindexing } from "@/lib/knowledge/chunks";
import { type KnowledgeKind, knowledgeKinds } from "@/lib/knowledge/kinds";
import { searchKnowledge } from "@/lib/knowledge/search";
import { languageNames } from "@/lib/languages";

export const metadata: Metadata = { title: "Knowledge" };

/** The longest question "Try a question" takes. */
const MAX_QUESTION_LENGTH = 500;

export default async function KnowledgePage({
  params,
  searchParams,
}: PageProps<"/dashboard/b/[slug]/knowledge">) {
  const { slug } = await params;
  const { q, saved } = await searchParams;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/knowledge`,
  );

  // Through RLS as the user: members see their business's knowledge, archived documents included.
  const { data: documents, error } = await supabase
    .from("knowledge_documents")
    .select(
      "id, kind, language, title, active, knowledge_chunks (embedding_model)",
    )
    .eq("business_id", business.id)
    .order("active", { ascending: false })
    .order("created_at");
  if (error) throw new Error(`Could not load the knowledge: ${error.message}`);

  const model = embeddingModelId();
  const outdated = new Set(
    documents
      .filter((document) =>
        needsReindexing(
          document.knowledge_chunks.map((chunk) => chunk.embedding_model),
          model,
        ),
      )
      .map((document) => document.id),
  );
  const languageOf = new Map(
    documents.map((document) => [document.id, document.language]),
  );
  const canManage = role !== "staff";
  const base = `/dashboard/b/${business.slug}/knowledge`;

  const question =
    typeof q === "string" ? q.trim().slice(0, MAX_QUESTION_LENGTH) : "";
  let results: Awaited<ReturnType<typeof searchKnowledge>> = [];
  let searchFailed = false;
  if (question) {
    try {
      results = await searchKnowledge(supabase, {
        businessId: business.id,
        question,
      });
    } catch (searchError) {
      console.error("Trying a knowledge question failed", {
        name: searchError instanceof Error ? searchError.name : "UnknownError",
      });
      searchFailed = true;
    }
  }

  return (
    <>
      <BusinessHeader business={business} role={role} current="knowledge" />

      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          Saved.
        </p>
      )}
      {canManage && outdated.size > 0 && (
        <div className="grid gap-2 rounded-lg border p-4 text-sm">
          <p>
            {outdated.size === 1
              ? "One document isn't indexed"
              : `${outdated.size} documents aren't indexed`}{" "}
            with the current search model, so the assistant can&apos;t find
            {outdated.size === 1 ? " it" : " them"} yet.
          </p>
          <ActionButton
            action={reindexKnowledge.bind(null, business.slug)}
            label="Re-index now"
            pendingLabel="Re-indexing..."
            variant="outline"
          />
        </div>
      )}

      <section className="grid gap-3" aria-labelledby="try-heading">
        <div className="grid gap-1">
          <h2 id="try-heading" className="text-lg font-semibold">
            Try a question
          </h2>
          <p className="text-sm text-muted-foreground">
            See which passages the assistant would answer a customer from.
            Customers can ask in English or Arabic.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-0 flex-1 gap-2">
            <Label htmlFor="q">Question</Label>
            <Input
              id="q"
              name="q"
              dir="auto"
              defaultValue={question}
              maxLength={MAX_QUESTION_LENGTH}
              placeholder="Is there parking?"
              required
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        {searchFailed && (
          <p role="alert" className="text-sm text-destructive">
            Search isn&apos;t available right now: the AI model couldn&apos;t be
            reached. Please try again.
          </p>
        )}
        {question &&
          !searchFailed &&
          (results.length === 0 ? (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              Nothing relevant found. The assistant would say it doesn&apos;t
              know, and offer to put the customer in touch with someone.
            </p>
          ) : (
            <ol className="grid gap-2" aria-label="Passages found">
              {results.map((result) => {
                const language = languageOf.get(result.document_id);
                return (
                  <li
                    key={result.chunk_id}
                    className="grid gap-1 rounded-lg border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="font-medium" lang={language} dir="auto">
                        {result.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {knowledgeKinds[result.kind].name} · similarity{" "}
                        {result.similarity.toFixed(2)}
                        {result.keyword_match && " · keyword match"}
                      </span>
                    </div>
                    <p
                      className="whitespace-pre-line text-muted-foreground"
                      lang={language}
                      dir="auto"
                    >
                      {/* The passage starts with the document's title, shown above. */}
                      {result.content.slice(result.content.indexOf("\n") + 1)}
                    </p>
                  </li>
                );
              })}
            </ol>
          ))}
      </section>

      {(["faq", "policy"] as const satisfies KnowledgeKind[]).map((kind) => {
        const ofKind = documents.filter((document) => document.kind === kind);
        const { plural, newLabel, empty } = knowledgeKinds[kind];
        return (
          <section
            key={kind}
            className="grid gap-3"
            aria-labelledby={`${kind}-heading`}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id={`${kind}-heading`} className="text-lg font-semibold">
                {plural}
              </h2>
              {canManage && (
                <Link
                  href={`${base}/new?kind=${kind}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {newLabel}
                </Link>
              )}
            </div>
            {ofKind.length === 0 ? (
              <p className="rounded-lg border p-4 text-sm text-muted-foreground">
                {empty}
              </p>
            ) : (
              <ul className="grid gap-2">
                {ofKind.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                  >
                    <span className="grid gap-0.5">
                      <span
                        className="font-medium"
                        lang={document.language}
                        dir="auto"
                      >
                        {document.title}
                      </span>
                      <span className="text-muted-foreground">
                        <span lang={document.language}>
                          {languageNames[document.language]}
                        </span>
                        {!document.active && " · Archived"}
                        {document.active &&
                          outdated.has(document.id) &&
                          " · Not indexed yet"}
                      </span>
                    </span>
                    {canManage && (
                      <span className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`${base}/${document.id}`}
                          className={buttonVariants({ variant: "outline" })}
                        >
                          Edit
                        </Link>
                        <ActionButton
                          action={setDocumentActive.bind(
                            null,
                            business.slug,
                            document.id,
                            !document.active,
                          )}
                          label={document.active ? "Archive" : "Restore"}
                          pendingLabel={
                            document.active ? "Archiving..." : "Restoring..."
                          }
                          variant="outline"
                        />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
