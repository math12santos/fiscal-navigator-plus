import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  Target,
  CheckSquare,
  Plug,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Users,
  Handshake,
  Rocket,
  BookUser,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import OrgSelector from "@/components/OrgSelector";
import { ScopeIndicator } from "@/components/ScopeIndicator";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlobalFetchingIndicator } from "@/components/GlobalFetchingIndicator";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { pageFactories } from "@/App";

type PageFactoryKey = keyof typeof pageFactories;

const navItems: Array<{
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  module: string;
  prefetch?: PageFactoryKey;
}> = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, module: "dashboard", prefetch: "dashboard" },
  { path: "/financeiro", label: "Financeiro", icon: DollarSign, module: "financeiro", prefetch: "financeiro" },
  { path: "/contratos", label: "Contratos", icon: FileText, module: "contratos", prefetch: "contratos" },
  { path: "/planejamento", label: "Planejamento", icon: Target, module: "planejamento", prefetch: "planejamento" },
  { path: "/dp", label: "Depto. Pessoal", icon: Users, module: "dp", prefetch: "dp" },
  { path: "/crm", label: "CRM", icon: Handshake, module: "crm", prefetch: "crm" },
  { path: "/cadastros", label: "Cadastros", icon: BookUser, module: "cadastro", prefetch: "cadastros" },
  { path: "/tarefas", label: "Tarefas", icon: CheckSquare, module: "tarefas", prefetch: "tarefas" },
  { path: "/integracoes", label: "Integrações", icon: Plug, module: "integracoes", prefetch: "integracoes" },
  { path: "/ia", label: "IA Financeira", icon: Brain, module: "ia", prefetch: "ia" },
  { path: "/configuracoes", label: "Configurações", icon: Settings, module: "configuracoes", prefetch: "configuracoes" },
];

/** Trigger the dynamic import for a page chunk. Browser caches the module
 *  on first call, so the second mount (the actual click) is instant. */
const prefetched = new Set<string>();
function prefetchPage(key?: PageFactoryKey) {
  if (!key || prefetched.has(key)) return;
  prefetched.add(key);
  pageFactories[key]().catch(() => prefetched.delete(key));
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();
  const { canAccessModule, isMaster } = useUserPermissions();
  const { progress: onboardingProgress, loading: onboardingLoading } = useOnboardingProgress();
  const showOnboardingLink = !onboardingLoading && (!onboardingProgress || onboardingProgress.status !== "concluido");

  const visibleNavItems = navItems.filter((item) => canAccessModule(item.module));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {!collapsed && (
            <span className="text-lg font-bold gradient-text tracking-tight">Colli FinCore</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Org Selector */}
        <div className="border-b border-sidebar-border p-2 space-y-2">
          <OrgSelector collapsed={collapsed} />
          {!collapsed && <ScopeIndicator />}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => prefetchPage(item.prefetch)}
                onFocus={() => prefetchPage(item.prefetch)}
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
          {showOnboardingLink && (
            <Link
              to="/onboarding-guiado"
              onMouseEnter={() => prefetchPage("onboardingGuiado")}
              onFocus={() => prefetchPage("onboardingGuiado")}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/onboarding-guiado"
                  ? "bg-primary/10 text-primary glow-primary"
                  : "text-primary/80 hover:bg-primary/5 hover:text-primary"
              )}
            >
              <Rocket size={18} />
              {!collapsed && <span>Onboarding</span>}
            </Link>
          )}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="border-t border-sidebar-border p-4 space-y-3">
            {isMaster && (
              <button
                onClick={() => navigate("/backoffice")}
                className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors w-full font-medium"
              >
                <ShieldCheck size={14} /> Voltar ao BackOffice
              </button>
            )}
            <div className="text-xs text-sidebar-foreground/70 truncate">{user?.email}</div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-destructive transition-colors w-full"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        )}
        {collapsed && isMaster && (
          <div className="border-t border-sidebar-border p-2 flex justify-center">
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
        <div className="flex items-center justify-end gap-2 px-6 pt-4 lg:px-8">
          <GlobalFetchingIndicator />
          <ThemeToggle />
          <NotificationCenter />
        </div>
        <div className="p-6 lg:p-8 pt-2">{children}</div>
      </main>
    </div>
  );
}
