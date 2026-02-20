import { useNavigate } from "react-router-dom";
import { ShieldCheck, LayoutDashboard } from "lucide-react";

export default function EnvironmentSelector() {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    sessionStorage.setItem("env_selected", "true");
    navigate(path);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="space-y-8 text-center max-w-lg w-full">
        <div>
          <h1 className="text-2xl font-bold gradient-text tracking-tight">Colli FinCore</h1>
          <p className="text-sm text-muted-foreground mt-2">Selecione o ambiente de acesso</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => handleNavigate("/app")}
            className="glass-card p-8 flex flex-col items-center gap-4 hover:border-primary/40 transition-all duration-200 group cursor-pointer"
          >
            <div className="rounded-xl bg-primary/10 p-4 group-hover:bg-primary/20 transition-colors">
              <LayoutDashboard className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Ambiente Padrão</h2>
              <p className="text-xs text-muted-foreground mt-1">Dashboard financeiro e operações</p>
            </div>
          </button>

          <button
            onClick={() => handleNavigate("/app/backoffice")}
            className="glass-card p-8 flex flex-col items-center gap-4 hover:border-warning/40 transition-all duration-200 group cursor-pointer"
          >
            <div className="rounded-xl bg-warning/10 p-4 group-hover:bg-warning/20 transition-colors">
              <ShieldCheck className="h-8 w-8 text-warning" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Backoffice</h2>
              <p className="text-xs text-muted-foreground mt-1">Administração de empresas e usuários</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
