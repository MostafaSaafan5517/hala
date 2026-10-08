import type { ReactNode } from "react";

/**
 * A list with nothing in it yet: an icon in a soft circle, a short title, the sentence about what
 * to do, and that one action (DESIGN.md, Empty states).
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-2 rounded-surface bg-card px-6 py-10 text-center shadow-level-1">
      <span className="mb-1 grid size-12 place-items-center rounded-full bg-accent text-accent-foreground [&_svg]:size-6">
        {icon}
      </span>
      <p className="text-h3">{title}</p>
      {children && (
        <p className="max-w-[52ch] text-secondary-foreground">{children}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
