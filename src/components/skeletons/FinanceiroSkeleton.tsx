import { Skeleton } from "@/components/ui/skeleton";

export function FinanceiroSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" aria-hidden="true">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground/40">Financeiro</h1>
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Tabs bar */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-md" />
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Long table */}
      <div className="space-y-2">
        <Skeleton className="h-10 rounded-md" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-md" />
        ))}
      </div>
    </div>
  );
}

export default FinanceiroSkeleton;
