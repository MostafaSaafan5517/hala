/* eslint-disable @next/next/no-html-link-for-pages -- The root 404 is part of every page's
   bundle: next/link here would add its client code (about 7 KB) to the widget's frame. */
import { Compass } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { HalaMark } from "@/components/hala-mark";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

// Any address the app doesn't know, and pages that refuse to say whether something exists (a
// business you're not a member of gets this too). The widget's frame has its own.
export default function NotFound() {
  return (
    <main className="grid flex-1 content-center justify-items-center gap-6 px-4 py-16 text-center">
      <a href="/" className="rounded-control">
        <HalaMark />
      </a>
      <div className="grid justify-items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <Compass aria-hidden="true" className="size-6" />
        </span>
        <h1 className="text-h2">This page doesn&apos;t exist</h1>
        <p className="max-w-[44ch] text-secondary-foreground">
          The address may be mistyped, or the page may have moved. If you
          followed a link to a business, you may not have access to it.
        </p>
      </div>
      <a href="/" className={buttonVariants()}>
        Go to the home page
      </a>
    </main>
  );
}
