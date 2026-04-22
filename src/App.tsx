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
  dp: () => import("@/pages/DepartamentoPessoal"),
  crm: () => import("@/pages/CRM"),
  financeiro: () => import("@/pages/Financeiro"),
  relatorioKpi: () => import("@/pages/RelatorioKpi"),
  onboardingGuiado: () => import("@/pages/OnboardingGuiado"),
} as const;

// Lazy-loaded pages
const Dashboard = lazyRetry(pageFactories.dashboard);
const Contratos = lazyRetry(pageFactories.contratos);
const Planejamento = lazyRetry(pageFactories.planejamento);
const Tarefas = lazyRetry(pageFactories.tarefas);
const Integracoes = lazyRetry(pageFactories.integracoes);
const IAFinanceira = lazyRetry(pageFactories.ia);
const Configuracoes = lazyRetry(pageFactories.configuracoes);
const DepartamentoPessoal = lazyRetry(pageFactories.dp);
const CRM = lazyRetry(pageFactories.crm);
const Financeiro = lazyRetry(pageFactories.financeiro);
const RelatorioKpi = lazyRetry(pageFactories.relatorioKpi);
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

/** Lightweight content-area skeleton — preserves sidebar/header during route transitions */
const ContentSkeleton = () => (
  <div className="space-y-4 animate-pulse" aria-hidden="true">
    <div className="h-8 w-64 rounded-md bg-muted/60" />
    <div className="h-4 w-96 rounded-md bg-muted/40" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      <div className="h-28 rounded-xl bg-muted/40" />
      <div className="h-28 rounded-xl bg-muted/40" />
      <div className="h-28 rounded-xl bg-muted/40" />
    </div>
    <div className="h-64 rounded-xl bg-muted/30 mt-4" />
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

  if (authLoading || orgLoading || onboardingLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  // Single Suspense at the AppLayout level — sidebar/header stay mounted across route changes.
  // Inner routes use a lightweight content skeleton so only the main area "blinks".
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <AppLayout>
        <Suspense fallback={<ContentSkeleton />}>
          <Routes>
            <Route path="/" element={<ModuleMaintenanceGuard moduleKey="dashboard"><Dashboard /></ModuleMaintenanceGuard>} />
            <Route path="/financeiro" element={<ModuleMaintenanceGuard moduleKey="financeiro"><Financeiro /></ModuleMaintenanceGuard>} />
            <Route path="/fluxo-caixa" element={<Navigate to="/financeiro" replace />} />
            <Route path="/conciliacao" element={<Navigate to="/financeiro" replace />} />
            <Route path="/contratos" element={<ModuleMaintenanceGuard moduleKey="contratos"><Contratos /></ModuleMaintenanceGuard>} />
            <Route path="/planejamento" element={<ModuleMaintenanceGuard moduleKey="planejamento"><Planejamento /></ModuleMaintenanceGuard>} />
            <Route path="/tarefas" element={<ModuleMaintenanceGuard moduleKey="tarefas"><Tarefas /></ModuleMaintenanceGuard>} />
            <Route path="/integracoes" element={<ModuleMaintenanceGuard moduleKey="integracoes"><Integracoes /></ModuleMaintenanceGuard>} />
            <Route path="/ia" element={<ModuleMaintenanceGuard moduleKey="ia-financeira"><IAFinanceira /></ModuleMaintenanceGuard>} />
            <Route path="/configuracoes" element={<ModuleMaintenanceGuard moduleKey="configuracoes"><Configuracoes /></ModuleMaintenanceGuard>} />
            <Route path="/dp" element={<ModuleMaintenanceGuard moduleKey="dp"><DepartamentoPessoal /></ModuleMaintenanceGuard>} />
            <Route path="/crm" element={<ModuleMaintenanceGuard moduleKey="crm"><CRM /></ModuleMaintenanceGuard>} />
            <Route path="/nova-empresa" element={<CreateOrganization />} />
            <Route path="/relatorios/kpi/:metric" element={<ModuleMaintenanceGuard moduleKey="dashboard"><RelatorioKpi /></ModuleMaintenanceGuard>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
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
        <Suspense fallback={<ContentSkeleton />}>
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
