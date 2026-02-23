import { ReactNode, useEffect, useState as useReactState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  Target,
  Building2,
  CheckSquare,
  Plug,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import OrgSelector from "@/components/OrgSelector";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/fluxo-caixa", label: "Fluxo de Caixa", icon: ArrowLeftRight },
  { path: "/contratos", label: "Contratos", icon: FileText },
  { path: "/planejamento", label: "Planejamento", icon: Target },
  { path: "/conciliacao", label: "Conciliação", icon: Building2 },
  { path: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { path: "/integracoes", label: "Integrações", icon: Plug },
  { path: "/ia", label: "IA Financeira", icon: Brain },
  { path: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();
  const [isMaster, setIsMaster] = useReactState(false);

  useEffect(() => {
    if (!user) { setIsMaster(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "master")
      .maybeSingle()
      .then(({ data }) => setIsMaster(!!data));
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border/50 bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
          {!collapsed && (
            <span className="text-lg font-bold gradient-text tracking-tight">Colli FinCore</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Org Selector */}
        <div className="border-b border-border/50 p-2">
          <OrgSelector collapsed={collapsed} />
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary glow-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon size={18} className={isActive ? "text-primary" : ""} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="border-t border-border/50 p-4 space-y-3">
            {isMaster && (
              <button
                onClick={() => navigate("/backoffice")}
                className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors w-full font-medium"
              >
                <ShieldCheck size={14} /> Voltar ao BackOffice
              </button>
            )}
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors w-full"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        )}
        {collapsed && isMaster && (
          <div className="border-t border-border/50 p-2 flex justify-center">
            <button
              onClick={() => navigate("/backoffice")}
              className="rounded-md p-1.5 text-primary hover:bg-primary/10 transition-colors"
              title="Voltar ao BackOffice"
            >
              <ShieldCheck size={16} />
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
