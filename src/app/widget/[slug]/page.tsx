import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WidgetChat } from "@/app/widget/[slug]/widget-chat";
import { widgetBusiness } from "@/lib/widget/server";

// The chat a business's website shows, inside the frame its embed script adds. Public: visitors
// don't sign in. Browsers only show it on the business's own sites: the proxy sends a
// frame-ancestors policy with the origins the business allowed.

export async function generateMetadata({
  params,
}: PageProps<"/widget/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const business = await widgetBusiness(slug);
  return { title: business ? business.name : "Chat" };
}

export default async function WidgetPage({
  params,
  searchParams,
}: PageProps<"/widget/[slug]">) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const business = await widgetBusiness(slug);
  if (!business) notFound();

  return (
    <WidgetChat
      slug={business.slug}
      businessName={business.name}
      initialLanguage={
        lang === "ar" || lang === "en" ? lang : business.default_language
      }
    />
  );
}
