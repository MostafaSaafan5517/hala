import { ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { ProductPoints } from "@/components/product-points";
import { buttonVariants } from "@/components/ui/button";
import { appConfig } from "@/config/app";
import { demoEnabled } from "@/config/demo";
import { SIGNED_IN_HOME } from "@/lib/auth";
import { createServerComponentClient } from "@/lib/supabase/server";

export default async function Home() {
  // Signed-in visitors get a way in instead of the sign-up and sign-in buttons.
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
      <div className="grid justify-items-start gap-6">
        <span
          aria-hidden="true"
          lang="ar"
          className="grid size-14 place-items-center rounded-surface bg-primary text-h3 text-primary-foreground"
        >
          {appConfig.nameAr}
        </span>
        <h1 className="flex flex-wrap items-baseline gap-x-4 text-display">
          <span>{appConfig.name}</span>
          <span lang="ar" className="text-accent-foreground">
            {appConfig.nameAr}
          </span>
        </h1>
        <p className="max-w-[44ch] text-h3 font-normal text-secondary-foreground">
          {appConfig.description}
        </p>
        {/* Links styled as buttons: they navigate, so they must stay links for screen readers. */}
        {data ? (
          <Link
            href={SIGNED_IN_HOME}
            className={buttonVariants({ size: "lg" })}
          >
            Continue
          </Link>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Get started
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Sign in
            </Link>
          </div>
        )}
        {demoEnabled() && (
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 font-medium text-accent-foreground underline-offset-4 hover:underline"
          >
            Try the live demo: a salon&apos;s website with the assistant on it
            <ArrowRight
              aria-hidden="true"
              className="size-4 rtl:-scale-x-100"
            />
          </Link>
        )}
      </div>
      <div className="rounded-panel bg-accent p-6 sm:p-8">
        <ProductPoints />
      </div>
    </main>
  );
}
