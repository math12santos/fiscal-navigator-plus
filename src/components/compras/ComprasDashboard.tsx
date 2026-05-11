import { useMemo } from "react";
import { SectionCard } from "@/components/SectionCard";
import { KPICard } from "@/components/KPICard";
import { ShoppingCart, FileCheck, Clock, AlertTriangle } from "lucide-react";
import { usePurchaseRequests, usePurchaseOrders } from "@/hooks/useCompras";

const fmtBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ComprasDashboard() {
  const { requests } = usePurchaseRequests();
  const { orders } = usePurchaseOrders();

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard title="Solicitado no mês" value={fmtBRL(kpis.totalSolicitado)} icon={ShoppingCart} />
        <KPICard title="Pendente aprovação" value={fmtBRL(kpis.totalPendente)} icon={Clock} />
        <KPICard title="Aprovado" value={fmtBRL(kpis.totalAprovado)} icon={FileCheck} />
        <KPICard title="Pedidos emitidos" value={fmtBRL(kpis.totalPedidos)} icon={ShoppingCart} />
        <KPICard title="Fora do orçamento" value={String(kpis.foraOrcamento)} icon={AlertTriangle} />
      </div>
    </SectionCard>
  );
}
