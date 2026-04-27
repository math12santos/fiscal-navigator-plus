import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DpToolbarProps {
  /** Filter inputs (search, selects). Rendered on the left, can wrap. */
  filters?: ReactNode;
  /** Action buttons (create, import, export). Rendered on the right. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard toolbar used above DP tables — keeps filters on the left and
 * actions on the right, with consistent gap and wrapping behavior.
 */
export function DpToolbar({ filters, actions, className }: DpToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {filters ? (
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          {filters}
        </div>
      ) : (
        <div />
      )}
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default DpToolbar;
