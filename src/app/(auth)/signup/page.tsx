import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readNext, withNext } from "@/app/(auth)/next-param";
import { SignUpForm } from "@/app/(auth)/signup/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SIGNED_IN_HOME } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({
  searchParams,
}: PageProps<"/signup">) {
  const nextPath = readNext((await searchParams).next);
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();
  if (data) redirect(safeRedirectPath(nextPath, SIGNED_IN_HOME));

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Create your account</CardTitle>
        <CardDescription>
          Set up an AI receptionist for your business.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SignUpForm next={nextPath} />
        <p className="text-center text-small text-secondary-foreground">
          Already have an account?{" "}
          <Link
            href={withNext("/login", nextPath)}
            className="font-medium text-accent-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
