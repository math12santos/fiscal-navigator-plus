import { PageHeader } from "@/components/PageHeader";
import { bankReconciliation } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, Clock } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const statusConfig: Record<string, { icon: typeof CheckCircle; className: string }> = {
  Conciliado: { icon: CheckCircle, className: "bg-success/10 text-success" },
  Divergente: { icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
  Pendente: { icon: Clock, className: "bg-warning/10 text-warning" },
};

export default function Conciliacao() {
  const conciliados = bankReconciliation.filter((r) => r.status === "Conciliado").length;
  const total = bankReconciliation.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Conciliação Bancária" description="Conferência entre extratos bancários e dados do ERP" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Taxa de Conciliação</p>
          <p className="text-2xl font-bold text-success mt-1">{((conciliados / total) * 100).toFixed(0)}%</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Divergências</p>
          <p className="text-2xl font-bold text-destructive mt-1">1</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-warning mt-1">1</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Data</th>
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Descrição</th>
              <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">ERP</th>
              <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Extrato</th>
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {bankReconciliation.map((r) => {
              const cfg = statusConfig[r.status];
              const Icon = cfg.icon;
              return (
                <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3.5 text-muted-foreground font-mono">{r.data}</td>
                  <td className="px-5 py-3.5 text-foreground">{r.descricao}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-foreground">{fmt(r.erp)}</td>
                  <td className={cn(
                    "px-5 py-3.5 text-right font-mono",
                    r.erp !== r.extrato ? "text-destructive" : "text-foreground"
                  )}>{fmt(r.extrato)}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full", cfg.className)}>
                      <Icon size={12} />
                      {r.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
