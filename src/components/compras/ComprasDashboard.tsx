import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "@/components/SectionCard";
import { KPICard } from "@/components/KPICard";
import { ShoppingCart, FileCheck, Clock, AlertTriangle, ListTodo } from "lucide-react";
import { usePurchaseRequests, usePurchaseOrders } from "@/hooks/useCompras";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cachePresets } from "@/lib/cachePresets";

const fmtBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ComprasDashboard() {
  const { requests } = usePurchaseRequests();
  const { orders } = usePurchaseOrders();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const { data: openTasks = 0 } = useQuery({
    queryKey: ["compras", "open-tasks", orgId],
    enabled: !!orgId,
    ...cachePresets.operational,
    queryFn: async () => {
      const { count } = await supabase
        .from("requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId!)
        .in("reference_module", ["compras_recebimento", "compras_divergencia", "ti_wizard_pendente"])
        .neq("status", "concluida");
      return count ?? 0;
    },
  });

  const kpis = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    const inMonth = (d?: string) => (d || "").slice(0, 7) === mes;
    const totalSolicitado = requests.filter((r: any) => inMonth(r.created_at)).reduce((s: number, r: any) => s + Number(r.valor_estimado || 0), 0);
    const totalPendente = requests.filter((r: any) => ["enviada","em_analise"].includes(r.status)).reduce((s: number, r: any) => s + Number(r.valor_estimado || 0), 0);
    const totalAprovado = requests.filter((r: any) => r.status === "aprovada" || r.status === "pedido_gerado").reduce((s: number, r: any) => s + Number(r.valor_estimado || 0), 0);
    const foraOrcamento = requests.filter((r: any) => r.fora_orcamento && inMonth(r.created_at)).length;
    const totalPedidos = orders.filter((o: any) => inMonth(o.data_emissao)).reduce((s: number, o: any) => s + Number(o.valor_total || 0), 0);
    return { totalSolicitado, totalPendente, totalAprovado, foraOrcamento, totalPedidos };
  }, [requests, orders]);

  return (
    <SectionCard title="Visão Geral de Compras" description="Indicadores do mês corrente.">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPICard title="Solicitado no mês" value={fmtBRL(kpis.totalSolicitado)} icon={<ShoppingCart className="h-4 w-4" />} />
        <KPICard title="Pendente aprovação" value={fmtBRL(kpis.totalPendente)} icon={<Clock className="h-4 w-4" />} />
        <KPICard title="Aprovado" value={fmtBRL(kpis.totalAprovado)} icon={<FileCheck className="h-4 w-4" />} />
        <KPICard title="Pedidos emitidos" value={fmtBRL(kpis.totalPedidos)} icon={<ShoppingCart className="h-4 w-4" />} />
        <KPICard title="Fora do orçamento" value={String(kpis.foraOrcamento)} icon={<AlertTriangle className="h-4 w-4" />} />
        <KPICard title="Tarefas pendentes" value={String(openTasks)} icon={<ListTodo className="h-4 w-4" />} />
      </div>
    </SectionCard>
  );
}
