import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Check your email</CardTitle>
        <CardDescription>
          We sent you a link. Open it on any device to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-small text-secondary-foreground">
          Nothing arrived after a few minutes? Check your spam folder, or{" "}
          <Link
            href="/signup"
            className="font-medium text-accent-foreground underline underline-offset-4"
          >
            try again
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
