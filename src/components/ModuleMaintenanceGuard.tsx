import { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useIsModuleEnabled } from "@/hooks/useSystemModules";

interface ModuleMaintenanceGuardProps {
  moduleKey: string;
  children: ReactNode;
}

export default function ModuleMaintenanceGuard({ moduleKey, children }: ModuleMaintenanceGuardProps) {
  const { isEnabled, isLoading, maintenanceMessage } = useIsModuleEnabled(moduleKey);

  if (isLoading) return null;

  if (!isEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-destructive/30">
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle size={32} className="text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Módulo em Manutenção
            </h2>
            <p className="text-sm text-muted-foreground">
              {maintenanceMessage}
            </p>
            <p className="text-xs text-muted-foreground">
              Por favor, tente novamente mais tarde ou entre em contato com o administrador do sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
