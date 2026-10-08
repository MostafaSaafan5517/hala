import { appConfig } from "@/config/app";
import { cn } from "@/lib/utils";

/**
 * The app mark (the Arabic name on an accent square) beside the wordmark (DESIGN.md, Marks). The
 * square is decoration: the name reads once.
 */
export function HalaMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        lang="ar"
        className="grid size-8 place-items-center rounded-control bg-primary text-[15px] leading-none font-semibold text-primary-foreground"
      >
        {appConfig.nameAr}
      </span>
      <span className="text-large font-semibold">{appConfig.name}</span>
    </span>
  );
}
