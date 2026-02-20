import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  Shield,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { path: "/backoffice", label: "Empresas", icon: Building2 },
  { path: "/backoffice/usuarios", label: "Usuários", icon: Users },
  { path: "/backoffice/auditoria", label: "Auditoria", icon: Activity },
  { path: "/backoffice/config", label: "Configurações", icon: Settings },
];

export default function BackofficeLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(220_14%_96%)]">
      {/* Sidebar — light corporate theme */}
      <aside
        className={cn(
          "flex flex-col border-r border-[hsl(220_13%_90%)] bg-[hsl(0_0%_100%)] transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-[hsl(220_13%_90%)] px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Shield size={20} className="text-primary" />
              <span className="text-lg font-bold text-[hsl(222_47%_11%)] tracking-tight">Backoffice</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-[hsl(215_16%_47%)] hover:bg-[hsl(220_14%_96%)] hover:text-[hsl(222_47%_11%)] transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== "/backoffice" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-[hsl(215_16%_47%)] hover:bg-[hsl(220_14%_96%)] hover:text-[hsl(222_47%_11%)]"
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
          <div className="border-t border-[hsl(220_13%_90%)] p-4 space-y-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-xs text-[hsl(215_16%_47%)] hover:text-primary transition-colors w-full"
            >
              <LayoutDashboard size={14} /> Voltar ao App
            </button>
            <div className="text-xs text-[hsl(215_16%_47%)] truncate">{user?.email}</div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-xs text-[hsl(215_16%_47%)] hover:text-destructive transition-colors w-full"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
