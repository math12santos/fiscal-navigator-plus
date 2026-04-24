import { Navigate } from "react-router-dom";
import { useEffectiveHomeRoute } from "@/hooks/useEffectiveHomeRoute";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { ReactNode } from "react";

/**
 * Renders the Dashboard if the user has access; otherwise redirects to
 * the user's effective home route (e.g. /dp for HR-only users).
 *
 * Avoids showing the "Você não possui permissão" empty state on the root
 * route — sectoral users land directly on their module's dashboard.
 */
interface Props {
  children: ReactNode;
  fallbackSkeleton: ReactNode;
}

export function DashboardOrEffectiveHome({ children, fallbackSkeleton }: Props) {
  const { canAccessModule, isLoading, hasFullAccess } = useUserPermissions();
  const { home } = useEffectiveHomeRoute();

  if (isLoading) return <>{fallbackSkeleton}</>;
  if (hasFullAccess || canAccessModule("dashboard")) return <>{children}</>;
  if (home && home !== "/") return <Navigate to={home} replace />;
  // Fallback: render Dashboard (it will show its own empty state)
  return <>{children}</>;
}
