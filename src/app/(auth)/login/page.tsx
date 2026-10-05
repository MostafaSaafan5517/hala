import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { readNext, withNext } from "@/app/(auth)/next-param";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { demoConfig, demoEnabled } from "@/config/demo";
import { SIGNED_IN_HOME } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

// Only messages we chose are shown; the query string can't inject text into the page.
const linkErrorMessage =
  "That link is invalid or has expired. Sign in below, or sign up again for a new link.";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, confirmed } = await searchParams;
  const nextPath = readNext(next);

  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();
  if (data) redirect(safeRedirectPath(nextPath, SIGNED_IN_HOME));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error === "link" && (
          <p role="alert" className="text-sm text-destructive">
            {linkErrorMessage}
          </p>
        )}
        {confirmed === "1" && (
          <p role="status" className="text-sm">
            Your email is confirmed. Sign in to continue.
          </p>
        )}
        <LoginForm next={nextPath} />
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href={withNext("/signup", nextPath)}
            className="text-foreground underline"
          >
            Create an account
          </Link>
        </p>
        {demoEnabled() && (
          <aside
            aria-labelledby="demo-heading"
            className="grid gap-1 rounded-lg border bg-muted/40 p-3 text-sm"
          >
            <h2 id="demo-heading" className="font-medium">
              Trying the demo?
            </h2>
            <p className="text-muted-foreground">
              Sign in as the demo salon&apos;s owner: email{" "}
              <code dir="ltr" className="whitespace-nowrap">
                {demoConfig.email}
              </code>
              , password{" "}
              <code dir="ltr" className="whitespace-nowrap">
                {demoConfig.password}
              </code>{" "}
              (read-only). Or chat with its assistant on{" "}
              <Link href="/demo" className="text-foreground underline">
                the salon&apos;s website
              </Link>
              .
            </p>
          </aside>
        )}
      </CardContent>
    </Card>
  );
}
