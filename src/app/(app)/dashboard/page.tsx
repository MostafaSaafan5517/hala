import { CaretRight, Plus, Storefront } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { surfaceLinkRow, surfaceList } from "@/components/surface";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { roleLabels } from "@/lib/business";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, userId } = await requireUser("/dashboard");

  // Both reads go through RLS as the signed-in user: their own profile, and only the
  // businesses where they are a member.
  const [profileResult, membersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single(),
    supabase
      .from("business_members")
      .select("role, businesses(id, name, slug)")
      .eq("user_id", userId)
      .order("created_at"),
  ]);
  if (profileResult.error) {
    throw new Error(
      `Could not load your profile: ${profileResult.error.message}`,
    );
  }
  if (membersResult.error) {
    throw new Error(
      `Could not load your businesses: ${membersResult.error.message}`,
    );
  }
  const profile = profileResult.data;
  const memberships = membersResult.data;

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-h1">
          Welcome{profile.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-secondary-foreground">
          Signed in as {profile.email}
        </p>
      </div>

      {memberships.length === 0 ? (
        <EmptyState
          icon={<Storefront aria-hidden="true" />}
          title="You don't have a business yet"
          action={
            <Link href="/dashboard/new-business" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              Create a business
            </Link>
          }
        >
          Create one to set up your services, staff and opening hours.
        </EmptyState>
      ) : (
        <section
          className="grid max-w-3xl gap-4"
          aria-labelledby="businesses-heading"
        >
          <SectionHeader
            id="businesses-heading"
            title="Your businesses"
            action={
              <Link
                href="/dashboard/new-business"
                className={buttonVariants({ variant: "outline" })}
              >
                <Plus aria-hidden="true" />
                New business
              </Link>
            }
          />
          <ul className={surfaceList}>
            {memberships.map(({ role, businesses: business }) => (
              <li key={business.id}>
                <Link
                  href={`/dashboard/b/${business.slug}`}
                  className={`${surfaceLinkRow} flex items-center justify-between gap-3`}
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">{business.name}</span>
                    <Badge tone={role === "owner" ? "accent" : "neutral"}>
                      {roleLabels[role]}
                    </Badge>
                  </span>
                  <CaretRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
