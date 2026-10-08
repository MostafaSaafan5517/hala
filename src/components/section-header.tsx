import type { ReactNode } from "react";

/** A page section's heading, what the section is for, and its one action. */
export function SectionHeader({
  id,
  title,
  description,
  action,
}: {
  /** The heading's id, for the section's aria-labelledby. */
  id: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="grid min-w-0 gap-1">
        <h2 id={id} className="text-h2">
          {title}
        </h2>
        {description && (
          <p className="max-w-[68ch] text-secondary-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
