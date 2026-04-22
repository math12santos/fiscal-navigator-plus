import { ReactNode } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useIsModuleEnabled } from "@/hooks/useSystemModules";
import { useOrgModules } from "@/hooks/useOrgModules";

interface ModuleMaintenanceGuardProps {
  moduleKey: string;
  children: ReactNode;
}

export default function ModuleMaintenanceGuard({ moduleKey, children }: ModuleMaintenanceGuardProps) {
  const { isEnabled: systemEnabled, isLoading: systemLoading, maintenanceMessage } = useIsModuleEnabled(moduleKey);
  const { isModuleEnabled: orgEnabled, isLoading: orgLoading } = useOrgModules();

  // While loading, render children — pages have their own skeletons.
  // We only block once we have a confirmed disabled state. Avoids the
  // "double white-flash" between Suspense fallback and guard fallback.
  if (systemLoading || orgLoading) return <>{children}</>;

  // System-wide maintenance takes priority
  if (!systemEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-destructive/30">
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle size={32} className="text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Módulo em Manutenção</h2>
            <p className="text-sm text-muted-foreground">{maintenanceMessage}</p>
            <p className="text-xs text-muted-foreground">
              Por favor, tente novamente mais tarde ou entre em contato com o administrador do sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Organization-level module disabled
  if (!orgEnabled(moduleKey)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-muted">
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Lock size={32} className="text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Módulo não ativado</h2>
            <p className="text-sm text-muted-foreground">
              Este módulo não está ativado para a sua empresa. Entre em contato com o administrador para habilitá-lo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
