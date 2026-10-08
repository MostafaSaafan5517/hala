import type { Metadata } from "next";
import { headers } from "next/headers";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { saveWidgetSettings } from "@/app/(app)/dashboard/b/[slug]/widget/actions";
import {
  EmbedCode,
  WidgetSettingsForm,
} from "@/app/(app)/dashboard/b/[slug]/widget/widget-forms";
import { SectionHeader } from "@/components/section-header";
import { requireMemberBusiness } from "@/lib/business";

export const metadata: Metadata = { title: "Widget" };

export default async function WidgetSettingsPage({
  params,
}: PageProps<"/dashboard/b/[slug]/widget">) {
  const { slug } = await params;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/widget`,
    ["owner", "admin"],
  );

  const { data: settings, error } = await supabase
    .from("businesses")
    .select("widget_enabled, widget_origins")
    .eq("id", business.id)
    .single();
  if (error) throw new Error(`Could not load the widget: ${error.message}`);

  // The embed code points at this deployment, wherever it runs.
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const embedCode = `<script src="${protocol}://${host}/widget.js" data-business="${business.slug}" defer></script>`;

  return (
    <>
      <BusinessHeader business={business} role={role} current="widget" />

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 gap-10">
          <section className="grid gap-4" aria-labelledby="widget-heading">
            <SectionHeader
              id="widget-heading"
              title="Website widget"
              description="Customers chat with the assistant from a button on your website. It answers from your knowledge base, books for real, and hands over to your team in the inbox."
            />
            <WidgetSettingsForm
              action={saveWidgetSettings.bind(null, business.slug)}
              enabled={settings.widget_enabled}
              origins={settings.widget_origins}
            />
          </section>

          <section className="grid gap-4" aria-labelledby="install-heading">
            <SectionHeader
              id="install-heading"
              title="Add it to your site"
              description={
                <>
                  Paste this before the closing &lt;/body&gt; tag of every page
                  that should show it. Add data-language=&quot;ar&quot; to start
                  in Arabic.
                </>
              }
            />
            <EmbedCode code={embedCode} />
          </section>
        </div>

        {settings.widget_enabled && (
          <section
            className="grid gap-4 lg:sticky lg:top-6"
            aria-labelledby="preview-heading"
          >
            <SectionHeader
              id="preview-heading"
              title="Preview"
              description="This is the real widget: conversations here appear in the inbox."
            />
            <iframe
              src={`/widget/${business.slug}`}
              title="Widget preview"
              className="h-[640px] w-full max-w-[400px] rounded-panel shadow-level-2"
            />
          </section>
        )}
      </div>
    </>
  );
}
