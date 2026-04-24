import { useMemo } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";

/**
 * Ordered list of (moduleKey -> route) candidates for the user's "effective home".
 * Dashboard has priority; the rest follows the most likely sectoral landing pages.
 */
const HOME_CANDIDATES: Array<{ module: string; route: string }> = [
  { module: "dashboard", route: "/" },
  { module: "financeiro", route: "/financeiro" },
  { module: "dp", route: "/dp" },
  { module: "crm", route: "/crm" },
  { module: "contratos", route: "/contratos" },
  { module: "planejamento", route: "/planejamento" },
  { module: "tarefas", route: "/tarefas" },
  { module: "cadastro", route: "/cadastros" },
  { module: "ia-financeira", route: "/ia" },
  { module: "integracoes", route: "/integracoes" },
  { module: "relatorios-out", route: "/relatorios/distribuicao" },
  { module: "configuracoes", route: "/configuracoes" },
];

/**
 * Returns the user's effective home route based on permissions.
 * - Users with dashboard access → "/"
 * - Users without dashboard → first accessible module (e.g. /dp for HR-only users)
 * - Fallback: "/" (the Dashboard page itself shows an empty state)
 */
export function useEffectiveHomeRoute(): { home: string; isLoading: boolean } {
  const { canAccessModule, isLoading, hasFullAccess } = useUserPermissions();

  const home = useMemo(() => {
    if (hasFullAccess) return "/";
    for (const candidate of HOME_CANDIDATES) {
      if (canAccessModule(candidate.module)) return candidate.route;
    }
    return "/";
  }, [canAccessModule, hasFullAccess]);

  return { home, isLoading };
}
