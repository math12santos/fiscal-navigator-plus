import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { HoldingToggle } from "@/components/HoldingToggle";
import { HoldingCompanyTabs } from "@/components/HoldingCompanyTabs";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  /** Set to false to hide the holding toggle on specific pages */
  showHoldingToggle?: boolean;
}

export function PageHeader({ title, description, children, className, showHoldingToggle = true }: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {showHoldingToggle && <HoldingToggle />}
        </div>
        {children && <div className="flex items-center gap-2 mt-2 sm:mt-0">{children}</div>}
      </div>
      {showHoldingToggle && <HoldingCompanyTabs />}
    </div>
  );
}
