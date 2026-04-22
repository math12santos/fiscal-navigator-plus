import { Skeleton } from "@/components/ui/skeleton";

export function DpSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" aria-hidden="true">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground/40">Departamento Pessoal</h1>
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default DpSkeleton;
