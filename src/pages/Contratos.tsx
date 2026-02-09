import { PageHeader } from "@/components/PageHeader";
import { contracts } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { FileText, AlertTriangle, CheckCircle } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export default function Contratos() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Gestão de Contratos" description="Cadastro e acompanhamento de contratos financeiros e operacionais" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contratos Ativos</p>
          <p className="text-2xl font-bold text-foreground mt-1">5</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Total</p>
          <p className="text-2xl font-bold text-primary mt-1">R$ 681.000</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Próx. Vencimento</p>
          <p className="text-2xl font-bold text-warning mt-1">30/03/2026</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Contrato</th>
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Tipo</th>
              <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Mensal</th>
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Vencimento</th>
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                <td className="px-5 py-3.5 flex items-center gap-2">
                  <FileText size={16} className="text-primary" />
                  <span className="font-medium text-foreground">{c.nome}</span>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{c.tipo}</td>
                <td className="px-5 py-3.5 text-right font-mono text-foreground">{fmt(c.valor)}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{new Date(c.vencimento).toLocaleDateString("pt-BR")}</td>
                <td className="px-5 py-3.5">
                  <span className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
                    c.status === "Ativo" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  )}>
                    {c.status === "Ativo" ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
