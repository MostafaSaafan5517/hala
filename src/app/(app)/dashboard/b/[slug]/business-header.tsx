import {
  BookOpenText,
  CalendarBlank,
  CalendarX,
  ChartBar,
  ChatCircleDots,
  Clock,
  Code,
  SquaresFour,
  Tag,
  Tray,
  UserList,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
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
    icon: SquaresFour,
    label: "Overview",
    path: "",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "bookings",
    icon: CalendarBlank,
    label: "Bookings",
    path: "/bookings",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "inbox",
    icon: Tray,
    label: "Inbox",
    path: "/inbox",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "services",
    icon: Tag,
    label: "Services",
    path: "/services",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "staff",
    icon: UserList,
    label: "Staff",
    path: "/staff",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "hours",
    icon: Clock,
    label: "Hours",
    path: "/hours",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "time-off",
    icon: CalendarX,
    label: "Time off",
    path: "/time-off",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "knowledge",
    icon: BookOpenText,
    label: "Knowledge",
    path: "/knowledge",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "assistant",
    icon: ChatCircleDots,
    label: "Assistant",
    path: "/assistant",
    roles: ["owner", "admin", "staff"],
  },
  {
    key: "usage",
    icon: ChartBar,
    label: "Usage",
    path: "/usage",
    roles: ["owner", "admin"],
  },
  {
    key: "widget",
    icon: Code,
    label: "Widget",
    path: "/widget",
    roles: ["owner", "admin"],
  },
  {
    key: "team",
    icon: UsersThree,
    label: "Team",
    path: "/team",
    roles: ["owner", "admin", "staff"],
  },
] as const satisfies readonly {
  key: string;
  icon: Icon;
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
      icon: section.icon,
      label: section.label,
      current: section.key === current,
    }));

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-h1">{business.name}</h1>
        <p className="text-secondary-foreground">{roleDescriptions[role]}</p>
      </div>
      {/* Pills with icons (DESIGN.md, Choosing one); the current one is marked for screen
          readers too. */}
      <nav
        aria-label="Business"
        className="flex flex-wrap gap-1.5 border-b pb-4"
      >
        {tabs.map(({ href, icon: Glyph, label, current }) => (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-small whitespace-nowrap",
              current
                ? "bg-accent font-medium text-accent-foreground"
                : "text-secondary-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Glyph aria-hidden="true" className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
