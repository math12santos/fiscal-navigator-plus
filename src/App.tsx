import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import BackofficeLayout from "@/components/BackofficeLayout";
import Dashboard from "@/pages/Dashboard";
import FluxoCaixa from "@/pages/FluxoCaixa";
import Contratos from "@/pages/Contratos";
import Planejamento from "@/pages/Planejamento";
import Conciliacao from "@/pages/Conciliacao";
import Tarefas from "@/pages/Tarefas";
import Integracoes from "@/pages/Integracoes";
import IAFinanceira from "@/pages/IAFinanceira";
import Configuracoes from "@/pages/Configuracoes";
import DepartamentoPessoal from "@/pages/DepartamentoPessoal";
import CRM from "@/pages/CRM";
import CreateOrganization from "@/pages/CreateOrganization";
import Onboarding from "@/pages/Onboarding";
import BackofficeDashboard from "@/pages/BackofficeDashboard";
import BackofficeCompany from "@/pages/BackofficeCompany";
import BackofficeUsers from "@/pages/BackofficeUsers";
import BackofficeAudit from "@/pages/BackofficeAudit";
import BackofficeConfig from "@/pages/BackofficeConfig";
import BackofficeSystem from "@/pages/BackofficeSystem";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound";
import ModuleMaintenanceGuard from "@/components/ModuleMaintenanceGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

/** Hook to check if user needs onboarding */
function useNeedsOnboarding() {
  const { user } = useAuth();
  const { organizations, currentOrg, loading: orgLoading } = useOrganization();
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setMustChangePassword(null); return; }
    supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMustChangePassword((data as any)?.must_change_password ?? false);
      });
  }, [user]);

  if (!user) return { loading: false, needs: false };
  if (orgLoading || mustChangePassword === null) return { loading: true, needs: false };

  if (mustChangePassword) return { loading: false, needs: true };
  if (organizations.length === 0) return { loading: false, needs: true };

  const org = currentOrg || organizations[0];
  if (org && !(org as any).onboarding_completed) return { loading: false, needs: true };

  return { loading: false, needs: false };
}

function ProtectedRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { loading: orgLoading } = useOrganization();
  const { loading: onboardingLoading, needs: needsOnboarding } = useNeedsOnboarding();

  if (authLoading || orgLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary animate-pulse text-lg font-semibold">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<ModuleMaintenanceGuard moduleKey="dashboard"><Dashboard /></ModuleMaintenanceGuard>} />
        <Route path="/fluxo-caixa" element={<ModuleMaintenanceGuard moduleKey="fluxo-caixa"><FluxoCaixa /></ModuleMaintenanceGuard>} />
        <Route path="/contratos" element={<ModuleMaintenanceGuard moduleKey="contratos"><Contratos /></ModuleMaintenanceGuard>} />
        <Route path="/planejamento" element={<ModuleMaintenanceGuard moduleKey="planejamento"><Planejamento /></ModuleMaintenanceGuard>} />
        <Route path="/conciliacao" element={<ModuleMaintenanceGuard moduleKey="conciliacao"><Conciliacao /></ModuleMaintenanceGuard>} />
        <Route path="/tarefas" element={<ModuleMaintenanceGuard moduleKey="tarefas"><Tarefas /></ModuleMaintenanceGuard>} />
        <Route path="/integracoes" element={<ModuleMaintenanceGuard moduleKey="integracoes"><Integracoes /></ModuleMaintenanceGuard>} />
        <Route path="/ia" element={<ModuleMaintenanceGuard moduleKey="ia-financeira"><IAFinanceira /></ModuleMaintenanceGuard>} />
        <Route path="/configuracoes" element={<ModuleMaintenanceGuard moduleKey="configuracoes"><Configuracoes /></ModuleMaintenanceGuard>} />
        <Route path="/dp" element={<ModuleMaintenanceGuard moduleKey="dp"><DepartamentoPessoal /></ModuleMaintenanceGuard>} />
        <Route path="/crm" element={<ModuleMaintenanceGuard moduleKey="crm"><CRM /></ModuleMaintenanceGuard>} />
        <Route path="/nova-empresa" element={<CreateOrganization />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function OnboardingRoute() {
  const { user, loading: authLoading } = useAuth();
  const { loading: orgLoading } = useOrganization();
  const { loading: onboardingLoading, needs: needsOnboarding } = useNeedsOnboarding();

  if (authLoading || orgLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary animate-pulse text-lg font-semibold">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!needsOnboarding) return <Navigate to="/" replace />;

  return <Onboarding />;
}

function BackofficeRoutes() {
  const { user, loading: authLoading } = useAuth();
  const [isMaster, setIsMaster] = useState<boolean | null>(null);

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

  if (authLoading || isMaster === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220_14%_96%)]">
        <div className="text-primary animate-pulse text-lg font-semibold">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isMaster) return <Navigate to="/" replace />;

  return (
    <BackofficeLayout>
      <Routes>
        <Route path="/" element={<BackofficeDashboard />} />
        <Route path="/usuarios" element={<BackofficeUsers />} />
        <Route path="/sistema" element={<BackofficeSystem />} />
        <Route path="/auditoria" element={<BackofficeAudit />} />
        <Route path="/config" element={<BackofficeConfig />} />
        <Route path="/empresa/:orgId" element={<BackofficeCompany />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BackofficeLayout>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  const [isMaster, setIsMaster] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setIsMaster(null); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "master")
      .maybeSingle()
      .then(({ data }) => setIsMaster(!!data));
  }, [user]);

  if (loading) return null;
  if (user && isMaster === null) return null;
  if (user && isMaster) return <Navigate to="/backoffice" replace />;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/onboarding" element={<OnboardingRoute />} />
              <Route path="/backoffice/*" element={<BackofficeRoutes />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
