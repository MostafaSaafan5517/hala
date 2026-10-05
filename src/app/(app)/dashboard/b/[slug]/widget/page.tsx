import type { Metadata } from "next";
import { headers } from "next/headers";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { saveWidgetSettings } from "@/app/(app)/dashboard/b/[slug]/widget/actions";
import {
  EmbedCode,
  WidgetSettingsForm,
} from "@/app/(app)/dashboard/b/[slug]/widget/widget-forms";
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

      <section className="grid gap-3" aria-labelledby="widget-heading">
        <div className="grid gap-1">
          <h2 id="widget-heading" className="text-lg font-semibold">
            Website widget
          </h2>
          <p className="text-sm text-muted-foreground">
            Customers chat with the assistant from a button on your website. It
            answers from your knowledge base, books for real, and hands over to
            your team in the inbox.
          </p>
        </div>
        <WidgetSettingsForm
          action={saveWidgetSettings.bind(null, business.slug)}
          enabled={settings.widget_enabled}
          origins={settings.widget_origins}
        />
      </section>

      <section className="grid gap-3" aria-labelledby="install-heading">
        <h2 id="install-heading" className="text-lg font-semibold">
          Add it to your site
        </h2>
        <p className="text-sm text-muted-foreground">
          Paste this before the closing &lt;/body&gt; tag of every page that
          should show it. Add data-language=&quot;ar&quot; to start in Arabic.
        </p>
        <EmbedCode code={embedCode} />
      </section>

      {settings.widget_enabled && (
        <section className="grid gap-3" aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="text-lg font-semibold">
            Preview
          </h2>
          <p className="text-sm text-muted-foreground">
            This is the real widget: conversations here appear in the inbox.
          </p>
          <iframe
            src={`/widget/${business.slug}`}
            title="Widget preview"
            className="h-[600px] w-full max-w-[380px] rounded-lg border"
          />
        </section>
      )}
    </>
  );
}
