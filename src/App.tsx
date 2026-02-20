import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import FluxoCaixa from "@/pages/FluxoCaixa";
import Contratos from "@/pages/Contratos";
import Planejamento from "@/pages/Planejamento";
import Conciliacao from "@/pages/Conciliacao";
import Tarefas from "@/pages/Tarefas";
import Integracoes from "@/pages/Integracoes";
import IAFinanceira from "@/pages/IAFinanceira";
import Configuracoes from "@/pages/Configuracoes";
import CreateOrganization from "@/pages/CreateOrganization";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound";
import Backoffice from "@/pages/Backoffice";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { organizations, currentOrg, loading: orgLoading } = useOrganization();

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary animate-pulse text-lg font-semibold">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/fluxo-caixa" element={<FluxoCaixa />} />
        <Route path="/contratos" element={<Contratos />} />
        <Route path="/planejamento" element={<Planejamento />} />
        <Route path="/conciliacao" element={<Conciliacao />} />
        <Route path="/tarefas" element={<Tarefas />} />
        <Route path="/integracoes" element={<Integracoes />} />
        <Route path="/ia" element={<IAFinanceira />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/nova-empresa" element={<CreateOrganization />} />
        <Route path="/backoffice" element={<Backoffice />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
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
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
