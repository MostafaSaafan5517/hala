import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Script from "next/script";
import { appConfig } from "@/config/app";
import { demoConfig, demoEnabled } from "@/config/demo";
import { formatAmount } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { widgetBusiness } from "@/lib/widget/server";

export const metadata: Metadata = { title: "Nour Salon (demo website)" };

// The demo salon's website: what a business's own site looks like with the embed code on it. The
// chat button is the real widget; this page is just its host, and only exists on a deployment
// with DEMO_ENABLED=1.
export default async function DemoWebsite() {
  // Decided per request: whether the demo is on is a runtime setting, and the salon is in the
  // database, so the page can't be built ahead.
  await connection();
  if (!demoEnabled()) notFound();
  const business = await widgetBusiness(demoConfig.slug);
  if (!business) notFound();
  const { data: services, error } = await createAdminClient()
    .from("services")
    .select("id, name_en, name_ar, duration_minutes, price, currency")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("price");
  if (error) throw new Error(`Could not load the services: ${error.message}`);

  return (
    // A business's own website, light like most of them, whatever the device prefers.
    <div className="hala-light flex flex-1 flex-col bg-background text-foreground">
      <header className="border-b px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-baseline justify-between gap-2">
          {/* A gap, not a margin: a start margin on the Arabic name would land on its right. */}
          <p className="inline-flex flex-wrap items-baseline gap-x-2 text-xl font-semibold tracking-tight">
            <span>{business.name}</span>
            <span lang="ar" dir="rtl" className="text-muted-foreground">
              صالون نور
            </span>
          </p>
          <p className="text-sm text-muted-foreground">Olaya, Riyadh</p>
        </div>
      </header>

      {/* Room at the bottom, so the chat button never covers the end of the page. */}
      <main className="mx-auto grid w-full max-w-3xl gap-8 p-4 pb-24 sm:p-6 sm:pb-24">
        <section className="grid gap-3" aria-labelledby="welcome-heading">
          <h1 id="welcome-heading" className="text-3xl font-semibold">
            Hair, beard and colour in the heart of Riyadh
          </h1>
          <p className="text-muted-foreground">
            This is a demo website. The chat button in the corner is{" "}
            {appConfig.name}&apos;s widget: ask it anything about the salon, in
            English or Arabic, or book an appointment. It answers from the
            salon&apos;s own information and shows the booking on screen for you
            to confirm.
          </p>
        </section>

        <section className="grid gap-3" aria-labelledby="services-heading">
          <h2 id="services-heading" className="text-xl font-semibold">
            Services
          </h2>
          <ul className="grid gap-2">
            {services.map((service) => (
              <li
                key={service.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border p-3"
              >
                <span className="inline-flex flex-wrap items-baseline gap-x-2">
                  <span>{service.name_en}</span>
                  {service.name_ar && (
                    <span lang="ar" dir="rtl" className="text-muted-foreground">
                      {service.name_ar}
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted-foreground">
                  {service.duration_minutes} min ·{" "}
                  {formatAmount(service.price, service.currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-2" aria-labelledby="hours-heading">
          <h2 id="hours-heading" className="text-xl font-semibold">
            Opening hours
          </h2>
          <p>Saturday to Thursday 10:00 to 21:00, Friday 14:00 to 21:00.</p>
        </section>

        <section
          className="grid gap-2 rounded-lg border bg-muted/40 p-4 text-sm"
          aria-labelledby="dashboard-heading"
        >
          <h2 id="dashboard-heading" className="font-semibold">
            See the salon&apos;s side
          </h2>
          <p>
            Sign in to the salon&apos;s dashboard to see your conversation in
            the inbox, the bookings and what the assistant cost. Email{" "}
            <code dir="ltr" className="whitespace-nowrap">
              {demoConfig.email}
            </code>
            , password{" "}
            <code dir="ltr" className="whitespace-nowrap">
              {demoConfig.password}
            </code>
            . The account is read-only, and the demo is reset every night.
          </p>
          <p>
            <Link href="/login" className="underline underline-offset-4">
              Sign in to the dashboard
            </Link>
          </p>
        </section>
      </main>

      <Script
        src="/widget.js"
        data-business={demoConfig.slug}
        data-label="Chat with us"
        strategy="afterInteractive"
      />
    </div>
  );
}
