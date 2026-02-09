import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import FluxoCaixa from "@/pages/FluxoCaixa";
import Contratos from "@/pages/Contratos";
import Planejamento from "@/pages/Planejamento";
import Conciliacao from "@/pages/Conciliacao";
import Tarefas from "@/pages/Tarefas";
import Integracoes from "@/pages/Integracoes";
import IAFinanceira from "@/pages/IAFinanceira";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
