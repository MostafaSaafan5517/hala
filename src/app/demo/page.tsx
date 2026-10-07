import {
  ArrowDownRight,
  Car,
  Clock,
  CreditCard,
  MapPin,
} from "@phosphor-icons/react/ssr";
import type { CSSProperties } from "react";
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

// Nour Salon's own colors: the demo page is a business's website, not Hala's (DESIGN.md), and
// Hala's widget sits on top in its teal, as it would on any site. Every text pair meets WCAG AA
// (at least 4.8:1). Inline, so they cost no extra stylesheet before the first paint.
const salon = {
  "--salon-cream": "oklch(0.965 0.016 80)",
  "--salon-paper": "oklch(0.99 0.008 85)",
  "--salon-ink": "oklch(0.26 0.03 45)",
  "--salon-ink-2": "oklch(0.45 0.03 50)",
  "--salon-brass": "oklch(0.5 0.085 65)",
  "--salon-brass-soft": "oklch(0.92 0.035 80)",
  "--salon-line": "oklch(0.86 0.025 75)",
  "--salon-night": "oklch(0.24 0.028 45)",
  "--salon-night-text": "oklch(0.95 0.015 80)",
  "--salon-night-muted": "oklch(0.8 0.025 75)",
  // Inline, so they win over .hala-light's own colors on the same element.
  background: "var(--salon-cream)",
  color: "var(--salon-ink)",
} as CSSProperties;

/**
 * The salon's name as its sign: spaced capitals for the Latin (letter spacing would break the
 * Arabic's joins, so the Arabic gets none). A gap, not a margin: a start margin on the Arabic
 * name would land on its right.
 */
function Wordmark({ name, arabic }: { name: string; arabic: string }) {
  return (
    <p className="inline-flex flex-wrap items-baseline gap-x-3">
      <span className="text-[15px] font-medium tracking-[0.24em] uppercase">
        {name}
      </span>
      <span lang="ar" dir="rtl" className={`text-[20px] ${arabic}`}>
        صالون نور
      </span>
    </p>
  );
}

/** "Layla", "Layla or Omar", "Layla, Omar or Sara". */
function either(names: string[]) {
  return names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

// The demo salon's website: what a business's own site looks like with the embed code on it. The
// chat button is the real widget; this page is just its host, and only exists on a deployment
// with DEMO_ENABLED=1. Everything on it comes from the seeded salon (src/lib/demo/salon.ts): its
// services and staff from the database, and its address, parking and payment from its FAQs.
export default async function DemoWebsite() {
  // Decided per request: whether the demo is on is a runtime setting, and the salon is in the
  // database, so the page can't be built ahead.
  await connection();
  if (!demoEnabled()) notFound();
  const business = await widgetBusiness(demoConfig.slug);
  if (!business) notFound();
  const { data: services, error } = await createAdminClient()
    .from("services")
    .select(
      "id, name_en, name_ar, duration_minutes, price, currency, staff_services (staff (name, active))",
    )
    .eq("business_id", business.id)
    .eq("active", true)
    .order("price");
  if (error) throw new Error(`Could not load the services: ${error.message}`);

  const menu = services.map((service) => ({
    ...service,
    staff: service.staff_services
      .flatMap(({ staff }) => (staff?.active ? [staff.name] : []))
      .sort(),
  }));
  const staff = [...new Set(menu.flatMap((service) => service.staff))].sort();

  return (
    // A business's own website, light like most of them, whatever the device prefers.
    <div
      style={salon}
      className="hala-light flex flex-1 flex-col [&_:focus-visible]:outline-(--salon-brass)"
    >
      {/* Hala's note, in Hala's colors: this isn't the salon speaking. */}
      <p className="bg-accent px-4 py-2.5 text-center text-small text-accent-foreground sm:px-6">
        Demo website: Nour Salon isn&apos;t a real business. The chat in the
        corner is {appConfig.name}&apos;s widget.{" "}
        <a
          href="#salon-side"
          className="font-medium whitespace-nowrap underline underline-offset-4"
        >
          See the salon&apos;s side
        </a>
      </p>

      <header className="pt-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 sm:px-6">
          <Wordmark name={business.name} arabic="text-(--salon-brass)" />
          <nav
            aria-label="Salon"
            className="flex flex-wrap gap-x-6 gap-y-2 text-small font-medium"
          >
            <a href="#services" className="hover:text-(--salon-brass)">
              Services
            </a>
            <a href="#visit" className="hover:text-(--salon-brass)">
              Visit us
            </a>
          </nav>
        </div>
      </header>

      {/* Room at the bottom, so the chat button never covers the end of the page. */}
      <main className="mx-auto grid w-full max-w-5xl gap-20 px-4 pt-12 pb-20 sm:px-6 sm:pt-16">
        <section
          aria-labelledby="welcome-heading"
          className="grid items-center gap-10 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
        >
          <div className="grid gap-5">
            <p className="flex flex-wrap gap-x-2 text-small font-medium text-(--salon-brass)">
              <span>Olaya, Riyadh</span>
              <span aria-hidden="true">·</span>
              <span lang="ar" dir="rtl">
                العليا، الرياض
              </span>
            </p>
            <h1
              id="welcome-heading"
              className="text-[40px] leading-[1.15] font-light tracking-[-0.01em] sm:text-[56px]"
            >
              Hair, beard and colour in the heart of Riyadh
            </h1>
            {/* Right to left inside, lined up with the English above it. */}
            <p className="text-[22px] leading-[1.7] font-light text-(--salon-ink-2) sm:text-[26px]">
              <span lang="ar" dir="rtl">
                الشعر واللحية والصبغة في قلب الرياض
              </span>
            </p>
            <p className="max-w-[54ch] text-large text-(--salon-ink-2)">
              Haircuts, blow-dries, beard trims and colour with ammonia-free
              dyes, by {staff.join(" and ")}. Open every day, Fridays from
              14:00.
            </p>
            <p className="flex items-center gap-2 font-medium">
              Questions, or a booking? Ask us in the chat, in English or Arabic.
              <ArrowDownRight
                size={20}
                aria-hidden="true"
                className="shrink-0 text-(--salon-brass)"
              />
            </p>
          </div>
          {/* "Nour" means light. */}
          <div
            aria-hidden="true"
            className="relative hidden aspect-square place-items-center md:grid"
          >
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,oklch(0.93_0.06_85/0.9),oklch(0.93_0.06_85/0))]" />
            <span
              lang="ar"
              className="relative text-[clamp(130px,18vw,200px)] leading-none font-extralight text-(--salon-brass)"
            >
              نور
            </span>
          </div>
        </section>

        <section
          id="services"
          aria-labelledby="services-heading"
          className="grid scroll-mt-6 gap-6"
        >
          <h2
            id="services-heading"
            className="flex flex-wrap items-baseline gap-x-3 text-[30px] leading-tight font-light"
          >
            Services
            <span lang="ar" dir="rtl" className="text-(--salon-brass)">
              الخدمات
            </span>
          </h2>
          <ul className="grid divide-y divide-(--salon-line) rounded-panel bg-(--salon-paper) px-5 py-2 ring-1 ring-(--salon-line) sm:px-8">
            {menu.map((service) => (
              <li
                key={service.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 py-5"
              >
                <p className="flex flex-wrap items-baseline gap-x-3 text-[20px] leading-snug">
                  <span>{service.name_en}</span>
                  {service.name_ar && (
                    <span lang="ar" dir="rtl" className="text-(--salon-ink-2)">
                      {service.name_ar}
                    </span>
                  )}
                </p>
                <p className="text-[20px] whitespace-nowrap tabular-nums">
                  {formatAmount(service.price, service.currency)}
                </p>
                <p className="col-span-2 text-small text-(--salon-ink-2)">
                  {service.duration_minutes} min
                  {service.staff.length > 0 &&
                    ` · with ${either(service.staff)}`}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="visit"
          aria-labelledby="visit-heading"
          className="grid scroll-mt-6 gap-6"
        >
          <h2
            id="visit-heading"
            className="flex flex-wrap items-baseline gap-x-3 text-[30px] leading-tight font-light"
          >
            Visit us
            <span lang="ar" dir="rtl" className="text-(--salon-brass)">
              زورونا
            </span>
          </h2>
          <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <dt className="flex items-center gap-2 font-medium">
                <MapPin
                  size={20}
                  aria-hidden="true"
                  className="text-(--salon-brass)"
                />
                Address
              </dt>
              <dd className="text-(--salon-ink-2)">
                Tahlia Street, Olaya, Riyadh, next to Jarir Bookstore
              </dd>
              <dd className="text-(--salon-ink-2)">
                <span lang="ar" dir="rtl">
                  شارع التحلية، حي العليا، الرياض، بجانب مكتبة جرير
                </span>
              </dd>
            </div>
            <div className="grid gap-1.5">
              <dt className="flex items-center gap-2 font-medium">
                <Clock
                  size={20}
                  aria-hidden="true"
                  className="text-(--salon-brass)"
                />
                Opening hours
              </dt>
              <dd className="text-(--salon-ink-2)">
                Saturday to Thursday, 10:00 to 21:00
              </dd>
              <dd className="text-(--salon-ink-2)">Friday, 14:00 to 21:00</dd>
            </div>
            <div className="grid gap-1.5">
              <dt className="flex items-center gap-2 font-medium">
                <Car
                  size={20}
                  aria-hidden="true"
                  className="text-(--salon-brass)"
                />
                Parking
              </dt>
              <dd className="text-(--salon-ink-2)">
                Free, behind the building, with a few spaces kept for customers.
              </dd>
            </div>
            <div className="grid gap-1.5">
              <dt className="flex items-center gap-2 font-medium">
                <CreditCard
                  size={20}
                  aria-hidden="true"
                  className="text-(--salon-brass)"
                />
                Payment
              </dt>
              <dd className="text-(--salon-ink-2)">
                Cash, Mada and all major credit cards.
              </dd>
            </div>
          </dl>
        </section>

        {/* Hala's side of the demo, in Hala's own style. */}
        <section
          id="salon-side"
          aria-labelledby="dashboard-heading"
          className="grid scroll-mt-6 gap-3 rounded-surface bg-card p-5 text-foreground shadow-level-1 sm:p-6"
        >
          <p className="text-caption font-medium text-accent-foreground">
            {appConfig.name} demo
          </p>
          <h2 id="dashboard-heading" className="text-h3">
            See the salon&apos;s side
          </h2>
          <p className="text-secondary-foreground">
            The chat button in the corner is {appConfig.name}&apos;s widget: ask
            it anything about the salon, in English or Arabic, or book an
            appointment. It answers from the salon&apos;s own information and
            shows the booking on screen for you to confirm.
          </p>
          <p className="text-secondary-foreground">
            Then sign in to the salon&apos;s dashboard to see your conversation
            in the inbox, the bookings and what the assistant cost. Email{" "}
            <code dir="ltr" className="whitespace-nowrap text-foreground">
              {demoConfig.email}
            </code>
            , password{" "}
            <code dir="ltr" className="whitespace-nowrap text-foreground">
              {demoConfig.password}
            </code>
            . The account is read-only, and the demo is reset every night.
          </p>
          <p>
            <Link
              href="/login"
              className="font-medium text-accent-foreground underline underline-offset-4"
            >
              Sign in to the dashboard
            </Link>
          </p>
        </section>
      </main>

      <footer className="bg-(--salon-night) pt-10 pb-28 text-(--salon-night-text)">
        <div className="mx-auto grid max-w-5xl gap-2 px-4 sm:px-6">
          <Wordmark name={business.name} arabic="" />
          <p className="text-small text-(--salon-night-muted)">
            Tahlia Street, Olaya, Riyadh · Open every day
          </p>
          <p className="text-small text-(--salon-night-muted)">
            A demo website for {appConfig.name}. Nour Salon isn&apos;t a real
            business.
          </p>
        </div>
      </footer>

      <Script
        src="/widget.js"
        data-business={demoConfig.slug}
        data-label="Chat with us"
        strategy="afterInteractive"
      />
    </div>
  );
}
