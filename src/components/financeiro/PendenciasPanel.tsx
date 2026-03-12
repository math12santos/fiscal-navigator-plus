import { useMemo, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, Info, Tag, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useEmployees } from "@/hooks/useDP";
import { useContracts } from "@/hooks/useContracts";
import { useRequests } from "@/hooks/useRequests";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { FinanceiroEntry } from "@/hooks/useFinanceiro";
import type { Request } from "@/hooks/useRequests";

interface Props {
  entries: FinanceiroEntry[];
  onClassify?: (projectedEntries: FinanceiroEntry[]) => void;
  onValorExecutado?: (projectedEntries: FinanceiroEntry[]) => void;
  onClassifyRequest?: (request: Request) => void;
}

interface Pendency {
  type: "dp" | "contrato" | "request_awaiting" | "request_incomplete" | "request_ready";
  label: string;
  detail: string;
  projectedEntries: FinanceiroEntry[];
  request?: Request;
  subItems?: { label: string; value: number }[];
}

export function PendenciasPanel({ entries, onClassify, onValorExecutado, onClassifyRequest }: Props) {
  const { data: employees } = useEmployees();
  const { contracts } = useContracts();
  const { data: expenseRequests } = useRequests({ type: "expense_request" });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM");

  const pendencies = useMemo(() => {
    const items: Pendency[] = [];

    // 1. Expense requests by stage
    const openRequests = (expenseRequests ?? []).filter(
      (r) => r.status === "aberta" || r.status === "em_execucao"
    );

    for (const req of openRequests) {
      const hasAccount = !!req.account_id;
      const hasCostCenter = !!req.cost_center_id;
      const hasEntity = !!req.entity_id;
      const isComplete = hasAccount && hasCostCenter;

      if (isComplete) {
        items.push({
          type: "request_ready",
          label: req.title,
          detail: "Pronta para classificação",
          projectedEntries: [],
          request: req,
        });
      } else if (!hasAccount || !hasCostCenter) {
        const missing: string[] = [];
        if (!hasAccount) missing.push("categoria");
        if (!hasCostCenter) missing.push("centro de custo");
        if (!hasEntity) missing.push("fornecedor");
        items.push({
          type: "request_incomplete",
          label: req.title,
          detail: `Dados incompletos: ${missing.join(", ")}`,
          projectedEntries: [],
          request: req,
        });
      } else {
        items.push({
          type: "request_awaiting",
          label: req.title,
          detail: "Aguardando triagem",
          projectedEntries: [],
          request: req,
        });
      }
    }

    // 2. DP projections — group by employee
    const activeEmps = (employees ?? []).filter((e: any) => e.status === "ativo");
    const hasMaterializedDP = entries.some(
      (e) => e.source === "dp" && !e.id.startsWith("proj-") &&
        format(new Date(e.data_prevista), "yyyy-MM") === monthStart
    );

    if (activeEmps.length > 0 && !hasMaterializedDP) {
      const dpProjections = entries.filter(
        (e) => e.source === "dp" && e.id.startsWith("proj-") &&
          format(new Date(e.data_prevista), "yyyy-MM") === monthStart
      );
      if (dpProjections.length > 0) {
        // Group by employee name (extract from description pattern)
        const byEmployee = new Map<string, FinanceiroEntry[]>();
        for (const p of dpProjections) {
          // Descriptions follow "Salário — João", "FGTS — João" etc
          const parts = p.descricao.split(" — ");
          const empName = parts.length > 1 ? parts[parts.length - 1] : "Geral";
          if (!byEmployee.has(empName)) byEmployee.set(empName, []);
          byEmployee.get(empName)!.push(p);
        }

        items.push({
          type: "dp",
          label: `Folha ${format(now, "MM/yyyy")} — ${activeEmps.length} colaborador(es)`,
          detail: `${dpProjections.length} projeções aguardando classificação`,
          projectedEntries: dpProjections,
          subItems: Array.from(byEmployee.entries()).map(([name, projs]) => ({
            label: name,
            value: projs.reduce((s, p) => s + p.valor_previsto, 0),
          })),
        });
      }
    }

    // 3. Active contracts without materialized entry
    const activeContracts = contracts.filter(
      (c) => c.status === "Ativo" && c.impacto_resultado !== "receita"
    );
    const materializedContractIds = new Set(
      entries
        .filter((e) => e.source === "contrato" && e.contract_id && !e.id.startsWith("proj-"))
        .filter((e) => format(new Date(e.data_prevista), "yyyy-MM") === monthStart)
        .map((e) => e.contract_id)
    );

    for (const c of activeContracts) {
      if (!materializedContractIds.has(c.id)) {
        const contractProjections = entries.filter(
          (e) => e.contract_id === c.id && e.id.startsWith("proj-") &&
            format(new Date(e.data_prevista), "yyyy-MM") === monthStart
        );
        if (contractProjections.length > 0) {
          items.push({
            type: "contrato",
            label: c.nome,
            detail: `Contrato ativo sem lançamento em ${format(now, "MM/yyyy")}`,
            projectedEntries: contractProjections,
          });
        }
      }
    }

    return items;
  }, [employees, contracts, entries, monthStart, expenseRequests]);

  if (pendencies.length === 0) return null;

  const requestPendencies = pendencies.filter((p) => p.type.startsWith("request_"));
  const projectionPendencies = pendencies.filter((p) => p.type === "dp" || p.type === "contrato");

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const stageConfig: Record<string, { label: string; color: string }> = {
    request_awaiting: { label: "Aguardando triagem", color: "bg-amber-500" },
    request_incomplete: { label: "Dados incompletos", color: "bg-orange-500" },
    request_ready: { label: "Pronta para classificação", color: "bg-emerald-500" },
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-3">
      {/* Expense request pendencies */}
      {requestPendencies.length > 0 && (
        <Alert className="border-primary/30 bg-primary/5">
          <Tag className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">
            Solicitações de Despesa ({requestPendencies.length})
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-2">
              {requestPendencies.map((p, i) => {
                const stage = stageConfig[p.type];
                return (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`inline-block w-2 h-2 rounded-full ${stage.color} shrink-0`} />
                      <span className="truncate">
                        <span className="font-medium">{p.label}</span>
                        <span className="text-muted-foreground ml-1">— {p.detail}</span>
                      </span>
                    </div>
                    {onClassifyRequest && p.request && (
                      <Button size="sm" variant="outline" onClick={() => onClassifyRequest(p.request!)}>
                        <Tag className="h-3.5 w-3.5 mr-1" />
                        Classificar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* DP and contract projection pendencies */}
      {projectionPendencies.length > 0 && (
        <Alert className="border-warning/50 bg-warning/5">
          <Info className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">
            Projeções Pendentes ({projectionPendencies.length})
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-2">
              {projectionPendencies.map((p, i) => (
                <li key={i} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {p.type === "dp" ? <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className="truncate">
                        <span className="font-medium">{p.label}</span>
                        <span className="text-muted-foreground ml-1">— {p.detail}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onClassify && p.projectedEntries.length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => onClassify(p.projectedEntries)}>
                          <Tag className="h-3.5 w-3.5 mr-1" /> Classificar
                        </Button>
                      )}
                      {onValorExecutado && p.projectedEntries.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => onValorExecutado(p.projectedEntries)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Valor Executado
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expandable sub-items for DP */}
                  {p.subItems && p.subItems.length > 0 && (
                    <Collapsible open={expandedGroups[`dp-${i}`]} onOpenChange={() => toggleGroup(`dp-${i}`)}>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-6">
                          {expandedGroups[`dp-${i}`] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          Ver detalhes por colaborador
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-6 mt-1 space-y-0.5">
                          {p.subItems.map((sub, j) => (
                            <div key={j} className="flex items-center justify-between text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted/30">
                              <span>{sub.label}</span>
                              <span className="font-medium">{fmt(sub.value)}</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
