import { useIsFetching } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

/**
 * Global indicator that shows whenever any React Query is fetching.
 * Provides visual feedback during background data loads / refetches.
 */
export function GlobalFetchingIndicator() {
  const count = useIsFetching();
  if (count === 0) return null;
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium animate-fade-in"
      title="Buscando dados do servidor"
      role="status"
      aria-live="polite"
    >
      <Loader2 size={12} className="animate-spin" />
      <span>Calculando{count > 1 ? ` (${count})` : "…"}</span>
    </div>
  );
}

export default GlobalFetchingIndicator;
