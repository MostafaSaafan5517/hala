import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { saveKnowledgeDocument } from "@/app/(app)/dashboard/b/[slug]/knowledge/actions";
import { DocumentForm } from "@/app/(app)/dashboard/b/[slug]/knowledge/document-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireMemberBusiness } from "@/lib/business";
import { knowledgeKinds } from "@/lib/knowledge/kinds";

export const metadata: Metadata = { title: "Edit knowledge document" };

export default async function EditDocumentPage({
  params,
}: PageProps<"/dashboard/b/[slug]/knowledge/[documentId]">) {
  const { slug, documentId } = await params;
  const { supabase, business } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/knowledge/${documentId}`,
    ["owner", "admin"],
  );

  const { data: document, error } = await supabase
    .from("knowledge_documents")
    .select("id, kind, language, title, body")
    .eq("id", documentId)
    .eq("business_id", business.id)
    .maybeSingle();
  // A malformed id is just a document that doesn't exist.
  if (error && error.code !== "22P02") {
    throw new Error(`Could not load the document: ${error.message}`);
  }
  if (!document) notFound();

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{knowledgeKinds[document.kind].editLabel}</CardTitle>
        <CardDescription>
          Saving re-indexes it, so the assistant answers from the new version
          straight away.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DocumentForm
          action={saveKnowledgeDocument.bind(
            null,
            business.slug,
            document.kind,
            document.id,
          )}
          kind={document.kind}
          initial={{
            language: document.language,
            title: document.title,
            body: document.body,
          }}
          submitLabel="Save"
          pendingLabel="Saving..."
        />
      </CardContent>
    </Card>
  );
}
