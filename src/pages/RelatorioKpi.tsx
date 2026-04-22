import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, Users, Shield, Wallet, TrendingUp, TrendingDown, PiggyBank, AlertTriangle, Handshake, Search, X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinancialSummary } from "@/hooks/useFinancialSummary";
import { useContracts } from "@/hooks/useContracts";
import { useEmployees } from "@/hooks/useDP";
import { useLiabilities } from "@/hooks/useLiabilities";
import { useCRMOpportunities, usePipelineStages } from "@/hooks/useCRM";
import { useOrganization } from "@/contexts/OrganizationContext";

/**
 * Página única de "drill-down" para KPIs do Dashboard.
 *
 * Filosofia (project-knowledge):
 * - Reproducibilidade: usa exatamente as mesmas fontes (useFinancialSummary,
 *   useContracts, etc.) que o Dashboard, com o mesmo período. Se um KPI
 *   mostra X no Dashboard, a soma das linhas aqui DEVE bater com X.
 * - Auditabilidade: mostra a origem (lançamento/contrato/colaborador/passivo),
 *   datas, valores e categoria — sem cálculos "mágicos".
 *
 * Período: lê `from` e `to` da query string. Default = últimos 6 meses
 * (mesmo range que o Dashboard usa em `useFinancialSummary`).
 */

type KpiMetric =
  | "receita-mensal"
  | "despesas-mensais"
  | "resultado-mensal"
  | "saldo-periodo"
  | "contratos-ativos"
  | "custo-folha"
  | "passivos"
  | "runway"
  | "crm-pipeline";

interface KpiMeta {
  title: string;
  description: string;
  icon: React.ReactNode;
  /** Quando true, o relatório é "por mês corrente" e não pelo range completo. */
  scopeIsCurrentMonth?: boolean;
}

const METRIC_META: Record<KpiMetric, KpiMeta> = {
  "receita-mensal": {
    title: "Composição da Receita Mensal",
    description: "Lançamentos de entrada que somam o valor da receita do mês corrente.",
    icon: <TrendingUp size={18} />,
    scopeIsCurrentMonth: true,
  },
  "despesas-mensais": {
    title: "Composição das Despesas Mensais",
    description: "Lançamentos de saída que somam o valor das despesas do mês corrente.",
    icon: <TrendingDown size={18} />,
    scopeIsCurrentMonth: true,
  },
  "resultado-mensal": {
    title: "Composição do Resultado Mensal",
    description: "Receitas e despesas do mês corrente que formam o resultado líquido.",
    icon: <PiggyBank size={18} />,
    scopeIsCurrentMonth: true,
  },
  "saldo-periodo": {
    title: "Composição do Saldo do Período",
    description: "Todos os lançamentos do horizonte selecionado (entradas − saídas).",
    icon: <Wallet size={18} />,
  },
  "contratos-ativos": {
    title: "Contratos Ativos",
    description: "Lista completa dos contratos ativos com valor recorrente mensalizado.",
    icon: <FileText size={18} />,
  },
  "custo-folha": {
    title: "Custo de Folha (estimado)",
    description: "Colaboradores ativos e seu salário base — composição do custo médio mensal.",
    icon: <Users size={18} />,
  },
  passivos: {
    title: "Passivos & Contingências",
    description: "Passivos cadastrados que compõem o total exibido no Dashboard.",
    icon: <Shield size={18} />,
  },
  runway: {
    title: "Composição do Runway",
    description: "Saídas do horizonte que compõem o burn rate usado no cálculo de runway.",
    icon: <AlertTriangle size={18} />,
  },
  "crm-pipeline": {
    title: "Pipeline CRM Ponderado",
    description: "Oportunidades em aberto com valor estimado × probabilidade do estágio.",
    icon: <Handshake size={18} />,
  },
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

const fmtDate = (d: string) => {
  try {
    return format(parseISO(d), "dd/MM/yyyy");
  } catch {
    return d;
  }
};

export default function RelatorioKpi() {
  const { metric } = useParams<{ metric: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();

  const meta = METRIC_META[metric as KpiMetric];

  // Período: usa query string ou default = últimos 6 meses (mesmo do Dashboard).
  const now = useMemo(() => new Date(), []);
  const rangeFrom = useMemo(() => {
    const q = searchParams.get("from");
    return q ? parseISO(q) : startOfMonth(subMonths(now, 5));
  }, [searchParams, now]);
  const rangeTo = useMemo(() => {
    const q = searchParams.get("to");
    return q ? parseISO(q) : endOfMonth(now);
  }, [searchParams, now]);

  const summary = useFinancialSummary(rangeFrom, rangeTo);
  const { contracts } = useContracts();
  const { data: employees = [] } = useEmployees();
  const { liabilities } = useLiabilities();
  const { opportunities } = useCRMOpportunities();
  const { stages } = usePipelineStages();

  // ===== Filtros derivados por KPI =====
  const curMonthStart = useMemo(() => format(startOfMonth(now), "yyyy-MM-dd"), [now]);
  const curMonthEnd = useMemo(() => format(endOfMonth(now), "yyyy-MM-dd"), [now]);

  const rows = useMemo(() => {
    if (!meta) return { items: [] as any[], total: 0, kind: "empty" as const };

    switch (metric as KpiMetric) {
      case "receita-mensal": {
        const items = summary.entries
          .filter((e) => e.tipo === "entrada" && e.data_prevista >= curMonthStart && e.data_prevista <= curMonthEnd)
          .map((e) => ({
            data: e.data_prevista,
            descricao: e.descricao,
            categoria: e.categoria || "—",
            origem: (e as any).source || "manual",
            valor: Number(e.valor_realizado ?? e.valor_previsto),
          }));
        return { items, total: items.reduce((s, i) => s + i.valor, 0), kind: "cashflow" as const };
      }

      case "despesas-mensais": {
        const items = summary.entries
          .filter((e) => e.tipo === "saida" && e.data_prevista >= curMonthStart && e.data_prevista <= curMonthEnd)
          .map((e) => ({
            data: e.data_prevista,
            descricao: e.descricao,
            categoria: e.categoria || "—",
            origem: (e as any).source || "manual",
            valor: Number(e.valor_realizado ?? e.valor_previsto),
          }));
        return { items, total: items.reduce((s, i) => s + i.valor, 0), kind: "cashflow" as const };
      }

      case "resultado-mensal": {
        const items = summary.entries
          .filter((e) => e.data_prevista >= curMonthStart && e.data_prevista <= curMonthEnd)
          .map((e) => ({
            data: e.data_prevista,
            descricao: e.descricao,
            categoria: e.categoria || "—",
            origem: (e as any).source || "manual",
            tipo: e.tipo,
            valor: Number(e.valor_realizado ?? e.valor_previsto) * (e.tipo === "entrada" ? 1 : -1),
          }));
        return { items, total: items.reduce((s, i) => s + i.valor, 0), kind: "result" as const };
      }

      case "saldo-periodo": {
        const items = summary.entries.map((e) => ({
          data: e.data_prevista,
          descricao: e.descricao,
          categoria: e.categoria || "—",
          origem: (e as any).source || "manual",
          tipo: e.tipo,
          valor: Number(e.valor_realizado ?? e.valor_previsto) * (e.tipo === "entrada" ? 1 : -1),
        }));
        return { items, total: items.reduce((s, i) => s + i.valor, 0), kind: "result" as const };
      }

      case "contratos-ativos": {
        const items = contracts
          .filter((c) => c.status === "Ativo")
          .map((c) => {
            const v = Number(c.valor);
            const mensal =
              c.tipo_recorrencia === "mensal" ? v :
              c.tipo_recorrencia === "bimestral" ? v / 2 :
              c.tipo_recorrencia === "trimestral" ? v / 3 :
              c.tipo_recorrencia === "semestral" ? v / 6 :
              c.tipo_recorrencia === "anual" ? v / 12 :
              v;
            return {
              nome: c.nome,
              tipo: c.tipo,
              recorrencia: c.tipo_recorrencia || "—",
              data_fim: c.data_fim || "—",
              valor: v,
              mensal,
            };
          });
        return {
          items,
          total: items.reduce((s, i) => s + i.mensal, 0),
          kind: "contracts" as const,
        };
      }

      case "custo-folha": {
        const items = (employees as any[])
          .filter((e) => e.status === "ativo" || e.status === "active")
          .map((e) => ({
            nome: e.name,
            cargo: e.position_id || "—",
            regime: e.contract_type || "—",
            admissao: e.admission_date || "—",
            salario: Number(e.salary_base || 0),
          }));
        return {
          items,
          total: items.reduce((s, i) => s + i.salario, 0),
          kind: "payroll" as const,
        };
      }

      case "passivos": {
        const items = liabilities.map((l: any) => ({
          descricao: l.descricao || l.nome || "—",
          tipo: l.tipo || "—",
          status: l.status || "—",
          probabilidade: l.probabilidade || "—",
          valor: Number(l.valor_atualizado || 0),
        }));
        return {
          items,
          total: items.reduce((s, i) => s + i.valor, 0),
          kind: "liabilities" as const,
        };
      }

      case "runway": {
        // Despesas que compõem o burn médio (mesma fonte de
        // useFinancialSummary). A soma / nº meses do horizonte = burn médio.
        const items = summary.entries
          .filter((e) => e.tipo === "saida")
          .map((e) => ({
            data: e.data_prevista,
            descricao: e.descricao,
            categoria: e.categoria || "—",
            origem: (e as any).source || "manual",
            valor: Number(e.valor_realizado ?? e.valor_previsto),
          }));
        return { items, total: items.reduce((s, i) => s + i.valor, 0), kind: "cashflow" as const };
      }

      case "crm-pipeline": {
        const stageMap = new Map(stages.map((s: any) => [s.id, s]));
        const items = opportunities
          .filter((o: any) => !o.won_at && !o.lost_at)
          .map((o: any) => {
            const stage = stageMap.get(o.stage_id) as any;
            const prob = stage ? Number(stage.probability) / 100 : 0;
            const ponderado = Number(o.estimated_value || 0) * prob;
            return {
              titulo: o.title,
              estagio: stage?.name || "—",
              probabilidade: prob * 100,
              valor: Number(o.estimated_value || 0),
              ponderado,
            };
          });
        return {
          items,
          total: items.reduce((s, i) => s + i.ponderado, 0),
          kind: "crm" as const,
        };
      }

      default:
        return { items: [], total: 0, kind: "empty" as const };
    }
  }, [metric, meta, summary.entries, contracts, employees, liabilities, opportunities, stages, curMonthStart, curMonthEnd]);

  // ===== Busca + paginação =====
  // Filtro textual sobre todos os campos string/number do item. Total e CSV
  // são derivados do conjunto filtrado, mantendo a auditabilidade ("o que
  // você vê é o que você exporta").
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows.items;
    return rows.items.filter((item) =>
      Object.values(item as Record<string, unknown>).some((v) => {
        if (v == null) return false;
        if (typeof v === "number") return String(v).includes(q);
        return String(v).toLowerCase().includes(q);
      }),
    );
  }, [rows.items, search]);

  const filteredTotal = useMemo(
    () => filteredItems.reduce((s: number, i: any) => s + Number(i.valor ?? i.mensal ?? i.ponderado ?? i.salario ?? 0), 0),
    [filteredItems],
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  // Reseta página ao mudar busca, métrica ou tamanho de página
  useEffect(() => {
    setPage(1);
  }, [search, metric, pageSize]);

  // Garante que a página atual existe após mudanças no dataset
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const isFiltering = search.trim().length > 0;
  const showingFrom = filteredItems.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredItems.length);

  const exportCsv = () => {
    if (filteredItems.length === 0) return;
    const headers = Object.keys(filteredItems[0]);
    const csvRows = [
      headers.join(";"),
      ...filteredItems.map((r) =>
        headers
          .map((h) => {
            const v = (r as any)[h];
            if (typeof v === "number") return String(v).replace(".", ",");
            return `"${String(v ?? "").replace(/"/g, '""')}"`;
          })
          .join(";"),
      ),
    ];
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = isFiltering ? "-filtrado" : "";
    a.download = `relatorio-${metric}${suffix}-${format(now, "yyyyMMdd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!meta) {
    return (
      <div className="space-y-6">
        <PageHeader title="Relatório não encontrado" description="O KPI solicitado não está disponível." />
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft size={14} className="mr-2" /> Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  const periodLabel = meta.scopeIsCurrentMonth
    ? format(now, "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(rangeFrom, "MMM/yyyy", { locale: ptBR })} – ${format(rangeTo, "MMM/yyyy", { locale: ptBR })}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft size={14} className="mr-2" /> Voltar ao Dashboard
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredItems.length === 0}>
          <Download size={14} className="mr-2" />
          {isFiltering ? "Exportar CSV (filtrado)" : "Exportar CSV"}
        </Button>
      </div>

      <PageHeader title={meta.title} description={meta.description} />

      <section className="glass-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{meta.icon}</div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Período</p>
              <p className="text-sm font-medium text-foreground capitalize">{periodLabel}</p>
              {currentOrg && (
                <p className="text-xs text-muted-foreground mt-0.5">{currentOrg.name}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {isFiltering ? "Total filtrado" : "Total"}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {fmt(isFiltering ? filteredTotal : rows.total)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFiltering
                ? `${filteredItems.length} de ${rows.items.length} item(ns)`
                : `${rows.items.length} item(ns)`}
            </p>
          </div>
        </div>
      </section>

      <section className="glass-card p-0 overflow-hidden">
        {/* Toolbar: busca + page size — sempre visível quando há dados na composição */}
        {rows.items.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-b border-border/60">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por descrição, categoria, origem…"
                className="pl-9 pr-9 h-9"
                aria-label="Buscar nos itens da composição"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                  aria-label="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Itens por página</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-9 w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {rows.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum item compõe esse KPI no período selecionado.
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground space-y-3">
            <p>
              Nenhum item corresponde à busca{" "}
              <span className="font-medium text-foreground">"{search}"</span>.
            </p>
            <Button variant="outline" size="sm" onClick={() => setSearch("")}>
              Limpar busca
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>{renderHeader(rows.kind)}</TableHeader>
                <TableBody>
                  {pagedItems.map((r, i) => renderRow(rows.kind, r, (page - 1) * pageSize + i))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-t border-border/60">
              <p className="text-xs text-muted-foreground">
                Mostrando <span className="font-medium text-foreground">{showingFrom}</span>–
                <span className="font-medium text-foreground">{showingTo}</span> de{" "}
                <span className="font-medium text-foreground">{filteredItems.length}</span>
              </p>
              {totalPages > 1 && (
                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 1) setPage(page - 1);
                        }}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {buildPageList(page, totalPages).map((p, idx) =>
                      p === "…" ? (
                        <PaginationItem key={`e-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={p === page}
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(p as number);
                            }}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={(e) => {
                          e.preventDefault();
                          if (page < totalPages) setPage(page + 1);
                        }}
                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Compacta a lista de páginas: 1 … (p-1) p (p+1) … N */
function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

// ===== Helpers de renderização por tipo de relatório =====

function renderHeader(kind: string) {
  switch (kind) {
    case "cashflow":
      return (
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Origem</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow>
      );
    case "result":
      return (
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead className="text-right">Impacto</TableHead>
        </TableRow>
      );
    case "contracts":
      return (
        <TableRow>
          <TableHead>Contrato</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Recorrência</TableHead>
          <TableHead>Fim</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="text-right">Mensalizado</TableHead>
        </TableRow>
      );
    case "payroll":
      return (
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Regime</TableHead>
          <TableHead>Admissão</TableHead>
          <TableHead className="text-right">Salário base</TableHead>
        </TableRow>
      );
    case "liabilities":
      return (
        <TableRow>
          <TableHead>Descrição</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Probabilidade</TableHead>
          <TableHead className="text-right">Valor atualizado</TableHead>
        </TableRow>
      );
    case "crm":
      return (
        <TableRow>
          <TableHead>Oportunidade</TableHead>
          <TableHead>Estágio</TableHead>
          <TableHead className="text-right">Prob.</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="text-right">Ponderado</TableHead>
        </TableRow>
      );
    default:
      return null;
  }
}

function renderRow(kind: string, r: any, i: number) {
  switch (kind) {
    case "cashflow":
      return (
        <TableRow key={i}>
          <TableCell className="whitespace-nowrap">{fmtDate(r.data)}</TableCell>
          <TableCell>{r.descricao}</TableCell>
          <TableCell className="text-muted-foreground">{r.categoria}</TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs capitalize">{r.origem}</Badge>
          </TableCell>
          <TableCell className="text-right font-mono">{fmt(r.valor)}</TableCell>
        </TableRow>
      );
    case "result":
      return (
        <TableRow key={i}>
          <TableCell className="whitespace-nowrap">{fmtDate(r.data)}</TableCell>
          <TableCell>{r.descricao}</TableCell>
          <TableCell>
            <Badge variant={r.tipo === "entrada" ? "default" : "destructive"} className="text-xs">
              {r.tipo === "entrada" ? "Entrada" : "Saída"}
            </Badge>
          </TableCell>
          <TableCell className="text-muted-foreground">{r.categoria}</TableCell>
          <TableCell className={`text-right font-mono ${r.valor < 0 ? "text-destructive" : "text-success"}`}>
            {fmt(r.valor)}
          </TableCell>
        </TableRow>
      );
    case "contracts":
      return (
        <TableRow key={i}>
          <TableCell className="font-medium">{r.nome}</TableCell>
          <TableCell className="text-muted-foreground">{r.tipo}</TableCell>
          <TableCell className="text-muted-foreground capitalize">{r.recorrencia}</TableCell>
          <TableCell className="text-muted-foreground whitespace-nowrap">
            {r.data_fim !== "—" ? fmtDate(r.data_fim) : "—"}
          </TableCell>
          <TableCell className="text-right font-mono">{fmt(r.valor)}</TableCell>
          <TableCell className="text-right font-mono">{fmt(r.mensal)}</TableCell>
        </TableRow>
      );
    case "payroll":
      return (
        <TableRow key={i}>
          <TableCell className="font-medium">{r.nome}</TableCell>
          <TableCell className="text-muted-foreground">{r.cargo}</TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs uppercase">{r.regime}</Badge>
          </TableCell>
          <TableCell className="text-muted-foreground whitespace-nowrap">
            {r.admissao !== "—" ? fmtDate(r.admissao) : "—"}
          </TableCell>
          <TableCell className="text-right font-mono">{fmt(r.salario)}</TableCell>
        </TableRow>
      );
    case "liabilities":
      return (
        <TableRow key={i}>
          <TableCell className="font-medium">{r.descricao}</TableCell>
          <TableCell className="text-muted-foreground">{r.tipo}</TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs capitalize">{r.status}</Badge>
          </TableCell>
          <TableCell className="text-muted-foreground capitalize">{r.probabilidade}</TableCell>
          <TableCell className="text-right font-mono">{fmt(r.valor)}</TableCell>
        </TableRow>
      );
    case "crm":
      return (
        <TableRow key={i}>
          <TableCell className="font-medium">{r.titulo}</TableCell>
          <TableCell className="text-muted-foreground">{r.estagio}</TableCell>
          <TableCell className="text-right text-muted-foreground">{r.probabilidade.toFixed(0)}%</TableCell>
          <TableCell className="text-right font-mono">{fmt(r.valor)}</TableCell>
          <TableCell className="text-right font-mono">{fmt(r.ponderado)}</TableCell>
        </TableRow>
      );
    default:
      return null;
  }
}
