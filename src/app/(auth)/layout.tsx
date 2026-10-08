import Link from "next/link";
import { ProductPoints } from "@/components/product-points";
import { HalaMark } from "@/components/hala-mark";
import { appConfig } from "@/config/app";

// Sign in, sign up and "check your email": the form, and on wide screens what Hala does beside it.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="hidden flex-col justify-between gap-10 bg-accent p-10 text-accent-foreground lg:flex xl:p-14">
        <Link href="/" className="justify-self-start rounded-control">
          <HalaMark />
        </Link>
        <div className="grid max-w-md gap-8">
          <p className="text-h2 text-foreground">{appConfig.description}</p>
          <ProductPoints />
        </div>
        <span />
      </div>
      <div className="flex flex-col items-center justify-center gap-8 px-4 py-10 sm:px-8">
        <Link href="/" className="rounded-control lg:hidden">
          <HalaMark />
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
