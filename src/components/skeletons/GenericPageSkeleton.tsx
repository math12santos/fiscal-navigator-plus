import { Skeleton } from "@/components/ui/skeleton";

export function GenericPageSkeleton({ title }: { title?: string }) {
  return (
    <div className="space-y-6 animate-fade-in" aria-hidden="true">
      <div className="space-y-2">
        {title ? (
          <h1 className="text-3xl font-bold tracking-tight text-foreground/40">{title}</h1>
        ) : (
          <Skeleton className="h-8 w-64" />
        )}
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default GenericPageSkeleton;
