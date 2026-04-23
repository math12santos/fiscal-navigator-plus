import { useNavigate } from "react-router-dom";
import { Users, AlertTriangle, FileText, Building2, ArrowRight } from "lucide-react";
import { useDPCockpit } from "@/hooks/useDPCockpit";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(v);

/**
 * Seção dedicada de Pessoal no Dashboard global.
 * Visão executiva de headcount, custo total estimado, alertas de documentos e
 * concentração por centro de custo. Click → navega ao módulo DP.
 */
export default function DPCockpitSection() {
  const navigate = useNavigate();
  const dp = useDPCockpit();

  if (!dp.hasData) return null;

  return (
    <section className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Users size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Pessoal (DP)</h3>
            <p className="text-xs text-muted-foreground">
              Visão consolidada de colaboradores e custos do mês corrente
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/departamento-pessoal")}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          Abrir DP <ArrowRight size={12} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCell
          label="Headcount Ativo"
          value={String(dp.headcount)}
          subtitle={`Custo médio ${fmt(dp.custoMedio)}/colab.`}
        />
        <KpiCell
          label="Custo Total Estimado"
          value={fmt(dp.custoTotal)}
          subtitle="Salário + encargos + benefícios"
          accent
        />
        <KpiCell
          label="Folha Bruta"
          value={fmt(dp.folhaBruta)}
          subtitle={`Encargos: ${fmt(dp.encargos)}`}
        />
        <KpiCell
          label="Eventos do mês"
          value={
            dp.eventosCount === 0
              ? "—"
              : `${dp.eventosLiquido >= 0 ? "+" : ""}${fmt(dp.eventosLiquido)}`
          }
          subtitle={`${dp.eventosCount} lançamento(s)`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Documentos */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Documentos / Exames
            </p>
          </div>
          {dp.docTotal === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum documento com vencimento monitorado.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <DocStat
                label="Vencidos"
                value={dp.docVencidos}
                tone={dp.docVencidos > 0 ? "danger" : "muted"}
              />
              <DocStat
                label="Críticos (15d)"
                value={dp.docCriticos}
                tone={dp.docCriticos > 0 ? "warning" : "muted"}
              />
              <DocStat
                label="Próximos (60d)"
                value={dp.docProximos}
                tone="info"
              />
            </div>
          )}
        </div>

        {/* Top centros de custo */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top Centros de Custo
            </p>
          </div>
          {dp.topCostCenters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem rateio por CC.</p>
          ) : (
            <ul className="space-y-2">
              {dp.topCostCenters.map((cc) => {
                const pct =
                  dp.folhaBruta > 0 ? (cc.value / dp.folhaBruta) * 100 : 0;
                return (
                  <li key={cc.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-medium truncate pr-2">
                        {cc.name}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {fmt(cc.value)} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {cc.count} colaborador(es)
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function KpiCell({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        accent ? "bg-primary/5 border-primary/20" : "border-border"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

function DocStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "info" | "muted";
}) {
  const toneClasses: Record<string, string> = {
    danger: "text-destructive",
    warning: "text-warning",
    info: "text-primary",
    muted: "text-muted-foreground",
  };
  const Icon = tone === "danger" ? AlertTriangle : FileText;
  return (
    <div className="text-center space-y-1">
      <Icon size={14} className={`mx-auto ${toneClasses[tone]}`} />
      <p className={`text-xl font-bold tabular-nums ${toneClasses[tone]}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
