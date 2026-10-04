import { BusinessTabs } from "@/app/(app)/dashboard/b/[slug]/business-tabs";
import type { MemberRole } from "@/lib/business";

const roleDescriptions: Record<MemberRole, string> = {
  owner: "You own this business.",
  admin: "You're an admin here.",
  staff: "You're on the staff here.",
};

// Each section's page checks the role again on the server; hiding a tab is only a convenience.
const sections = [
  {
    key: "overview",
    label: "Overview",
    path: "",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "bookings",
    label: "Bookings",
    path: "/bookings",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "services",
    label: "Services",
    path: "/services",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "staff",
    label: "Staff",
    path: "/staff",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "hours",
    label: "Hours",
    path: "/hours",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "time-off",
    label: "Time off",
    path: "/time-off",
    roles: ["owner", "admin", "staff"],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  path: string;
  roles: readonly MemberRole[];
}[];

export type BusinessSection = (typeof sections)[number]["key"];

/** The business's name, the user's role there, and the tabs their role can open. */
export function BusinessHeader({
  business,
  role,
  current,
}: {
  business: { name: string; slug: string };
  role: MemberRole;
  current: BusinessSection;
}) {
  const tabs = sections
    .filter((section) =>
      (section.roles as readonly MemberRole[]).includes(role),
    )
    .map((section) => ({
      href: `/dashboard/b/${business.slug}${section.path}`,
      label: section.label,
      current: section.key === current,
    }));

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {business.name}
        </h1>
        <p className="text-muted-foreground">{roleDescriptions[role]}</p>
      </div>
      <BusinessTabs tabs={tabs} />
    </div>
  );
}
