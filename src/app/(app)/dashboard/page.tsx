import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { claims } = await requireUser("/dashboard");
  // Sign-up stores the name in the user's metadata, which the token carries.
  const fullName: unknown = claims.user_metadata?.full_name;

  return (
    <div className="grid gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">
        {typeof fullName === "string" && fullName
          ? `Welcome, ${fullName}`
          : "Welcome"}
      </h1>
      <p className="text-muted-foreground">Signed in as {claims.email}</p>
    </div>
  );
}
