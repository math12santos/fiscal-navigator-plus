import { Skeleton } from "@/components/ui/skeleton";

export function PlanejamentoSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" aria-hidden="true">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground/40">Planejamento</h1>
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default PlanejamentoSkeleton;
