import Link from "next/link";
import type { MemberRole } from "@/lib/business";
import { cn } from "@/lib/utils";

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
    key: "inbox",
    label: "Inbox",
    path: "/inbox",
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
  {
    key: "knowledge",
    label: "Knowledge",
    path: "/knowledge",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "assistant",
    label: "Assistant",
    path: "/assistant",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "usage",
    label: "Usage",
    path: "/usage",
    roles: ["owner", "admin"],
  },
  {
    key: "widget",
    label: "Widget",
    path: "/widget",
    roles: ["owner", "admin"],
  },
  {
    key: "team",
    label: "Team",
    path: "/team",
    roles: ["owner", "admin", "staff"],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  path: string;
  roles: readonly MemberRole[];
}[];

export type BusinessSection = (typeof sections)[number]["key"];

/**
 * The business's name, the user's role there, and the tabs their role can open. The tabs wrap onto
 * more lines rather than scrolling sideways, so every one of them is on screen at any width.
 */
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
      <nav aria-label="Business" className="flex flex-wrap gap-1 border-b pb-3">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.current ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
              tab.current
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
