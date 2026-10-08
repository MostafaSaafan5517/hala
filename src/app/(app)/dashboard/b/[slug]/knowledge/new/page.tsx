import { ArrowLeft } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveKnowledgeDocument } from "@/app/(app)/dashboard/b/[slug]/knowledge/actions";
import { DocumentForm } from "@/app/(app)/dashboard/b/[slug]/knowledge/document-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireMemberBusiness } from "@/lib/business";
import { isKnowledgeKind, knowledgeKinds } from "@/lib/knowledge/kinds";

export const metadata: Metadata = { title: "New knowledge document" };

export default async function NewDocumentPage({
  params,
  searchParams,
}: PageProps<"/dashboard/b/[slug]/knowledge/new">) {
  const { slug } = await params;
  const { kind } = await searchParams;
  const { business } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/knowledge/new`,
    ["owner", "admin"],
  );
  if (!isKnowledgeKind(kind)) notFound();

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <Link
        href={`/dashboard/b/${business.slug}/knowledge`}
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "justify-self-start",
        })}
      >
        <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
        Knowledge
      </Link>
      <Card>
        <CardHeader>
          <CardTitle as="h1">{knowledgeKinds[kind].newLabel}</CardTitle>
          <CardDescription>
            The assistant answers {business.name}&apos;s customers from this,
            and shows it as the source.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentForm
            action={saveKnowledgeDocument.bind(null, business.slug, kind, null)}
            kind={kind}
            initial={{ language: business.default_language }}
            submitLabel="Save"
            pendingLabel="Saving..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
