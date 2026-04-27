import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import { HoldingProvider } from "@/contexts/HoldingContext";
import { lazy, Suspense, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GenericPageSkeleton } from "@/components/skeletons/GenericPageSkeleton";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { FinanceiroSkeleton } from "@/components/skeletons/FinanceiroSkeleton";
import { PlanejamentoSkeleton } from "@/components/skeletons/PlanejamentoSkeleton";
import { ContratosSkeleton } from "@/components/skeletons/ContratosSkeleton";
import { DpSkeleton } from "@/components/skeletons/DpSkeleton";
import { CrmSkeleton } from "@/components/skeletons/CrmSkeleton";
import { RelatorioKpiSkeleton } from "@/components/skeletons/RelatorioKpiSkeleton";

/** Retry dynamic imports on failure (stale chunk after deploy) */
function lazyRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    factory().catch(() => {
      // Force reload once to get fresh chunks
      const key = "chunk_reload";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
      return factory();
    })
  );
}

// Lazy-loaded layouts
const AppLayout = lazyRetry(() => import("@/components/AppLayout"));
const BackofficeLayout = lazyRetry(() => import("@/components/BackofficeLayout"));

// Lazy page factories — exported so AppLayout can prefetch on hover
export const pageFactories = {
  dashboard: () => import("@/pages/Dashboard"),
  contratos: () => import("@/pages/Contratos"),
  planejamento: () => import("@/pages/Planejamento"),
  tarefas: () => import("@/pages/Tarefas"),
  integracoes: () => import("@/pages/Integracoes"),
  ia: () => import("@/pages/IAFinanceira"),
  configuracoes: () => import("@/pages/Configuracoes"),
  cadastros: () => import("@/pages/Cadastros"),
  dp: () => import("@/pages/DepartamentoPessoal"),
  crm: () => import("@/pages/CRM"),
  financeiro: () => import("@/pages/Financeiro"),
  relatorioKpi: () => import("@/pages/RelatorioKpi"),
  relatoriosDistribuicao: () => import("@/pages/RelatoriosDistribuicao"),
  onboardingGuiado: () => import("@/pages/OnboardingGuiado"),
  dpDesempenho: () => import("@/pages/DepartamentoPessoalDesempenho"),
} as const;

// Lazy-loaded pages
const Dashboard = lazyRetry(pageFactories.dashboard);
const Contratos = lazyRetry(pageFactories.contratos);
const Planejamento = lazyRetry(pageFactories.planejamento);
const Tarefas = lazyRetry(pageFactories.tarefas);
const Integracoes = lazyRetry(pageFactories.integracoes);
const IAFinanceira = lazyRetry(pageFactories.ia);
const Configuracoes = lazyRetry(pageFactories.configuracoes);
const Cadastros = lazyRetry(pageFactories.cadastros);
const DepartamentoPessoal = lazyRetry(pageFactories.dp);
const DepartamentoPessoalDesempenho = lazyRetry(pageFactories.dpDesempenho);
const CRM = lazyRetry(pageFactories.crm);
const Financeiro = lazyRetry(pageFactories.financeiro);
const RelatorioKpi = lazyRetry(pageFactories.relatorioKpi);
const RelatoriosDistribuicao = lazyRetry(pageFactories.relatoriosDistribuicao);
const OnboardingGuiado = lazyRetry(pageFactories.onboardingGuiado);
const CreateOrganization = lazyRetry(() => import("@/pages/CreateOrganization"));
const Onboarding = lazyRetry(() => import("@/pages/Onboarding"));
const BackofficeDashboard = lazyRetry(() => import("@/pages/BackofficeDashboard"));
const BackofficeCompany = lazyRetry(() => import("@/pages/BackofficeCompany"));
const BackofficeUsers = lazyRetry(() => import("@/pages/BackofficeUsers"));
const BackofficeAudit = lazyRetry(() => import("@/pages/BackofficeAudit"));
const BackofficeConfig = lazyRetry(() => import("@/pages/BackofficeConfig"));
const BackofficeSystem = lazyRetry(() => import("@/pages/BackofficeSystem"));
const BackofficeOnboarding = lazyRetry(() => import("@/pages/BackofficeOnboarding"));
const Auth = lazyRetry(() => import("@/pages/Auth"));
const NotFound = lazyRetry(() => import("@/pages/NotFound"));
const ModuleMaintenanceGuard = lazyRetry(() => import("@/components/ModuleMaintenanceGuard"));
const DashboardOrEffectiveHome = lazyRetry(() =>
  import("@/components/DashboardOrEffectiveHome").then((m) => ({ default: m.DashboardOrEffectiveHome }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

/** Full-screen fallback used only for top-level auth/onboarding gates */
const FullScreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-primary animate-pulse text-lg font-semibold">Carregando...</div>
  </div>
);

/** Wrap each route element in its own Suspense with a module-faithful skeleton.
 *  Sidebar/header stay mounted (outer Suspense at AppLayout level). */
const RouteShell = ({ skeleton, children }: { skeleton: ReactNode; children: ReactNode }) => (
  <Suspense fallback={skeleton}>{children}</Suspense>
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

  if (authLoading || orgLoading || onboardingLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  // Single Suspense at the AppLayout level — sidebar/header stay mounted across route changes.
  // Inner routes use a lightweight content skeleton so only the main area "blinks".
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <AppLayout>
        <Routes>
          <Route path="/" element={<RouteShell skeleton={<DashboardSkeleton />}><DashboardOrEffectiveHome fallbackSkeleton={<DashboardSkeleton />}><ModuleMaintenanceGuard moduleKey="dashboard"><Dashboard /></ModuleMaintenanceGuard></DashboardOrEffectiveHome></RouteShell>} />
          <Route path="/financeiro" element={<RouteShell skeleton={<FinanceiroSkeleton />}><ModuleMaintenanceGuard moduleKey="financeiro"><Financeiro /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/fluxo-caixa" element={<Navigate to="/financeiro" replace />} />
          <Route path="/conciliacao" element={<Navigate to="/financeiro" replace />} />
          <Route path="/contratos" element={<RouteShell skeleton={<ContratosSkeleton />}><ModuleMaintenanceGuard moduleKey="contratos"><Contratos /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/planejamento" element={<RouteShell skeleton={<PlanejamentoSkeleton />}><ModuleMaintenanceGuard moduleKey="planejamento"><Planejamento /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/tarefas" element={<RouteShell skeleton={<GenericPageSkeleton title="Tarefas" />}><ModuleMaintenanceGuard moduleKey="tarefas"><Tarefas /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/integracoes" element={<RouteShell skeleton={<GenericPageSkeleton title="Integrações" />}><ModuleMaintenanceGuard moduleKey="integracoes"><Integracoes /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/ia" element={<RouteShell skeleton={<GenericPageSkeleton title="IA Financeira" />}><ModuleMaintenanceGuard moduleKey="ia-financeira"><IAFinanceira /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/configuracoes" element={<RouteShell skeleton={<GenericPageSkeleton title="Configurações" />}><ModuleMaintenanceGuard moduleKey="configuracoes"><Configuracoes /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/cadastros" element={<RouteShell skeleton={<GenericPageSkeleton title="Cadastros" />}><ModuleMaintenanceGuard moduleKey="cadastro"><Cadastros /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/dp" element={<RouteShell skeleton={<DpSkeleton />}><ModuleMaintenanceGuard moduleKey="dp"><DepartamentoPessoal /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/dp/desempenho" element={<RouteShell skeleton={<DpSkeleton />}><ModuleMaintenanceGuard moduleKey="dp"><DepartamentoPessoalDesempenho /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/crm" element={<RouteShell skeleton={<CrmSkeleton />}><ModuleMaintenanceGuard moduleKey="crm"><CRM /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/nova-empresa" element={<RouteShell skeleton={<GenericPageSkeleton title="Nova empresa" />}><CreateOrganization /></RouteShell>} />
          <Route path="/relatorios/kpi/:metric" element={<RouteShell skeleton={<RelatorioKpiSkeleton />}><ModuleMaintenanceGuard moduleKey="dashboard"><RelatorioKpi /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="/relatorios/distribuicao" element={<RouteShell skeleton={<GenericPageSkeleton title="Distribuição de Relatórios" />}><ModuleMaintenanceGuard moduleKey="relatorios-out"><RelatoriosDistribuicao /></ModuleMaintenanceGuard></RouteShell>} />
          <Route path="*" element={<RouteShell skeleton={<GenericPageSkeleton />}><NotFound /></RouteShell>} />
        </Routes>
      </AppLayout>
    </Suspense>
  );
}

function OnboardingRoute() {
  const { user, loading: authLoading } = useAuth();
  const { loading: orgLoading } = useOrganization();
  const { loading: onboardingLoading, needs: needsOnboarding } = useNeedsOnboarding();

  if (authLoading || orgLoading || onboardingLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!needsOnboarding) return <Navigate to="/" replace />;

  return (
    <Suspense fallback={<FullScreenLoader />}>
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

  if (authLoading || isMaster === null) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isMaster) return <Navigate to="/" replace />;

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <BackofficeLayout>
        <Suspense fallback={<GenericPageSkeleton />}>
          <Routes>
            <Route path="/" element={<BackofficeDashboard />} />
            <Route path="/usuarios" element={<BackofficeUsers />} />
            <Route path="/sistema" element={<BackofficeSystem />} />
            <Route path="/auditoria" element={<BackofficeAudit />} />
            <Route path="/config" element={<BackofficeConfig />} />
            <Route path="/empresa/:orgId" element={<BackofficeCompany />} />
            <Route path="/onboarding" element={<BackofficeOnboarding />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BackofficeLayout>
    </Suspense>
  );
}

function GuidedOnboardingRoute() {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <OnboardingGuiado />
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
    <Suspense fallback={<FullScreenLoader />}>
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
