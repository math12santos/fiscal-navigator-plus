import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import { HoldingProvider } from "@/contexts/HoldingContext";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Lazy-loaded layouts
const AppLayout = lazy(() => import("@/components/AppLayout"));
const BackofficeLayout = lazy(() => import("@/components/BackofficeLayout"));

// Lazy-loaded pages
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const FluxoCaixa = lazy(() => import("@/pages/FluxoCaixa"));
const Contratos = lazy(() => import("@/pages/Contratos"));
const Planejamento = lazy(() => import("@/pages/Planejamento"));
const Conciliacao = lazy(() => import("@/pages/Conciliacao"));
const Tarefas = lazy(() => import("@/pages/Tarefas"));
const Integracoes = lazy(() => import("@/pages/Integracoes"));
const IAFinanceira = lazy(() => import("@/pages/IAFinanceira"));
const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const DepartamentoPessoal = lazy(() => import("@/pages/DepartamentoPessoal"));
const CRM = lazy(() => import("@/pages/CRM"));
const Financeiro = lazy(() => import("@/pages/Financeiro"));
const CreateOrganization = lazy(() => import("@/pages/CreateOrganization"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const BackofficeDashboard = lazy(() => import("@/pages/BackofficeDashboard"));
const BackofficeCompany = lazy(() => import("@/pages/BackofficeCompany"));
const BackofficeUsers = lazy(() => import("@/pages/BackofficeUsers"));
const BackofficeAudit = lazy(() => import("@/pages/BackofficeAudit"));
const BackofficeConfig = lazy(() => import("@/pages/BackofficeConfig"));
const BackofficeSystem = lazy(() => import("@/pages/BackofficeSystem"));
const BackofficeOnboarding = lazy(() => import("@/pages/BackofficeOnboarding"));
const OnboardingGuiado = lazy(() => import("@/pages/OnboardingGuiado"));
const Auth = lazy(() => import("@/pages/Auth"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const ModuleMaintenanceGuard = lazy(() => import("@/components/ModuleMaintenanceGuard"));

const queryClient = new QueryClient();

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-primary animate-pulse text-lg font-semibold">Carregando...</div>
  </div>
);

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

  if (authLoading || orgLoading || onboardingLoading) return <LoadingFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="dashboard"><Dashboard /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/financeiro" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="financeiro"><Financeiro /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/fluxo-caixa" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="fluxo-caixa"><FluxoCaixa /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/contratos" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="contratos"><Contratos /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/planejamento" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="planejamento"><Planejamento /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/conciliacao" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="conciliacao"><Conciliacao /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/tarefas" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="tarefas"><Tarefas /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/integracoes" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="integracoes"><Integracoes /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/ia" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="ia-financeira"><IAFinanceira /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/configuracoes" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="configuracoes"><Configuracoes /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/dp" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="dp"><DepartamentoPessoal /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/crm" element={<Suspense fallback={<LoadingFallback />}><ModuleMaintenanceGuard moduleKey="crm"><CRM /></ModuleMaintenanceGuard></Suspense>} />
          <Route path="/nova-empresa" element={<Suspense fallback={<LoadingFallback />}><CreateOrganization /></Suspense>} />
          <Route path="*" element={<Suspense fallback={<LoadingFallback />}><NotFound /></Suspense>} />
        </Routes>
      </AppLayout>
    </Suspense>
  );
}

function OnboardingRoute() {
  const { user, loading: authLoading } = useAuth();
  const { loading: orgLoading } = useOrganization();
  const { loading: onboardingLoading, needs: needsOnboarding } = useNeedsOnboarding();

  if (authLoading || orgLoading || onboardingLoading) return <LoadingFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!needsOnboarding) return <Navigate to="/" replace />;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Onboarding />
    </Suspense>
  );
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

  if (authLoading || isMaster === null) return <LoadingFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isMaster) return <Navigate to="/" replace />;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <BackofficeLayout>
        <Routes>
          <Route path="/" element={<Suspense fallback={<LoadingFallback />}><BackofficeDashboard /></Suspense>} />
          <Route path="/usuarios" element={<Suspense fallback={<LoadingFallback />}><BackofficeUsers /></Suspense>} />
          <Route path="/sistema" element={<Suspense fallback={<LoadingFallback />}><BackofficeSystem /></Suspense>} />
          <Route path="/auditoria" element={<Suspense fallback={<LoadingFallback />}><BackofficeAudit /></Suspense>} />
          <Route path="/config" element={<Suspense fallback={<LoadingFallback />}><BackofficeConfig /></Suspense>} />
          <Route path="/empresa/:orgId" element={<Suspense fallback={<LoadingFallback />}><BackofficeCompany /></Suspense>} />
          <Route path="/onboarding" element={<Suspense fallback={<LoadingFallback />}><BackofficeOnboarding /></Suspense>} />
          <Route path="*" element={<Suspense fallback={<LoadingFallback />}><NotFound /></Suspense>} />
        </Routes>
      </BackofficeLayout>
    </Suspense>
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

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Auth />
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <HoldingProvider>
              <Routes>
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/onboarding" element={<OnboardingRoute />} />
                <Route path="/onboarding-guiado" element={<GuidedOnboardingRoute />} />
                <Route path="/backoffice/*" element={<BackofficeRoutes />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </HoldingProvider>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
