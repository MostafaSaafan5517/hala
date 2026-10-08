import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { ReadOnlyNotice } from "@/app/(app)/read-only-notice";
import { HalaMark } from "@/components/hala-mark";
import { Button } from "@/components/ui/button";
import { SIGNED_IN_HOME } from "@/lib/auth";

// The signed-in part of the app, where businesses set up their assistant. Each page checks the
// user itself (requireUser); a layout is not re-run on every navigation, so it must never be the
// only guard.
export default function SignedInLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      {/* For keyboard users: past the header and a business's tabs, straight to the page. */}
      <a
        href="#main"
        className="sr-only rounded-control bg-card px-4 py-2 font-medium shadow-level-2 focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-50"
      >
        Skip to content
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href={SIGNED_IN_HOME} className="rounded-control">
              <HalaMark />
            </Link>
            <nav aria-label="Main" className="flex gap-1 text-small">
              <Link
                href="/dashboard"
                className="rounded-full px-3 py-1.5 font-medium text-secondary-foreground hover:bg-muted hover:text-foreground"
              >
                Businesses
              </Link>
            </nav>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <ReadOnlyNotice />
      {/* Data pages use the full width; forms keep to their own narrower column. */}
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto grid w-full max-w-6xl content-start gap-10 px-4 py-6 outline-none sm:px-6 sm:py-8"
      >
        {children}
      </main>
    </div>
  );
}
