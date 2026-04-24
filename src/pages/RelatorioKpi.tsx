import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { KpiPeriodPresetsPopover } from "@/components/relatorio/KpiPeriodPresetsPopover";
import { KpiRangePicker } from "@/components/relatorio/KpiRangePicker";
import { ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown, Download, FileText, Users, Shield, Wallet, TrendingUp, TrendingDown, PiggyBank, AlertTriangle, Handshake, Search, X, CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfMonth, endOfMonth, subMonths, format, parseISO, getQuarter } from "date-fns";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFinancialSummary } from "@/hooks/useFinancialSummary";
import { useContracts } from "@/hooks/useContracts";
import { useEmployees, useDPConfig, usePositions, calcEncargosPatronais } from "@/hooks/useDP";
import { useDPBenefits, useEmployeeBenefits } from "@/hooks/useDPBenefits";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useBusinessDaysForMonth } from "@/hooks/useBusinessDays";
import { useLiabilities } from "@/hooks/useLiabilities";
import { useCRMOpportunities, usePipelineStages } from "@/hooks/useCRM";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEffectiveHomeRoute } from "@/hooks/useEffectiveHomeRoute";
import { validateRange } from "@/lib/kpiRangeValidation";

const DIAS_UTEIS_MES = 22;

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
  | "crm-pipeline"
  | "dp-headcount"
  | "dp-folha-bruta"
  | "dp-encargos"
  | "dp-custo-medio"
  | "dp-vt"
  | "dp-va"
  | "dp-saude"
  | "dp-outros-beneficios";

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
  "dp-headcount": {
    title: "Headcount Ativo",
    description: "Colaboradores com status ativo — base de todos os cálculos do módulo DP.",
    icon: <Users size={18} />,
    scopeIsCurrentMonth: true,
  },
  "dp-folha-bruta": {
    title: "Folha Bruta Total",
    description: "Soma do salário base de todos os colaboradores ativos no mês corrente.",
    icon: <Wallet size={18} />,
    scopeIsCurrentMonth: true,
  },
  "dp-encargos": {
    title: "Encargos Patronais",
    description: "INSS Patronal, RAT, FGTS e Terceiros sobre o salário base (PJ excluído).",
    icon: <Shield size={18} />,
    scopeIsCurrentMonth: true,
  },
  "dp-custo-medio": {
    title: "Custo Médio por Colaborador",
    description: "(Folha bruta + encargos) ÷ headcount ativo. Não inclui benefícios.",
    icon: <PiggyBank size={18} />,
    scopeIsCurrentMonth: true,
  },
  "dp-vt": {
    title: "Vale Transporte",
    description: "Custo líquido empresa: (vt_diario × 22) − 6% do salário base, mínimo 0.",
    icon: <TrendingDown size={18} />,
    scopeIsCurrentMonth: true,
  },
  "dp-va": {
    title: "Vale Alimentação / Refeição",
    description: "Colaboradores recebendo benefícios de alimentação ou refeição ativos. Benefícios por dia útil são calculados como valor/dia × dias úteis efetivos do mês corrente.",
    icon: <PiggyBank size={18} />,
    scopeIsCurrentMonth: true,
  },
  "dp-saude": {
    title: "Plano de Saúde",
    description: "Colaboradores recebendo benefícios de saúde ativos.",
    icon: <Shield size={18} />,
    scopeIsCurrentMonth: true,
  },
  "dp-outros-beneficios": {
    title: "Outros Benefícios",
    description: "Demais benefícios ativos (excluídos VT, VA/VR e Saúde, já detalhados separadamente).",
    icon: <PiggyBank size={18} />,
    scopeIsCurrentMonth: true,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { home: effectiveHome } = useEffectiveHomeRoute();

  /**
   * Aplica um novo intervalo (from/to) à URL — fonte de verdade do período.
   * Ao atualizar `?from=&to=`, os memos `rangeFrom`/`rangeTo` recalculam e
   * `useFinancialSummary` recarrega os dados naturalmente. Mantém a URL
   * compartilhável e reproduzível (princípio de auditabilidade).
   */
  const applyRange = useCallback(
    (from: string, to: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("from", from);
      next.set("to", to);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  /** Granularidade da exibição: "mensal" (padrão) ou "trimestral". */
  const granularity = useMemo<"mensal" | "trimestral">(() => {
    const g = searchParams.get("gran");
    return g === "trimestral" ? "trimestral" : "mensal";
  }, [searchParams]);

  /**
   * Granularidade "diferida" para reagregação não bloqueante. O valor da URL
   * (`granularity`) muda imediatamente — usado para refletir o toggle visual e
   * o link compartilhável. O cálculo pesado (`aggregatedRows`) escuta o valor
   * deferido, permitindo que o card de Total e a Reconciliação permaneçam
   * estáveis enquanto a tabela recompõe em background.
   */
  const deferredGranularity = useDeferredValue(granularity);
  const [isGranularityPending, startGranularityTransition] = useTransition();

  const applyGranularity = useCallback(
    (g: "mensal" | "trimestral") => {
      // URL é síncrona — mantém link compartilhável e reflete o toggle no ato.
      const next = new URLSearchParams(searchParams);
      if (g === "mensal") next.delete("gran");
      else next.set("gran", g);
      // O trabalho pesado de reagregação fica em transição (não bloqueia UI).
      startGranularityTransition(() => {
        setSearchParams(next, { replace: true });
      });
    },
    [searchParams, setSearchParams],
  );

  const meta = METRIC_META[metric as KpiMetric];

  // Período: usa query string ou default = últimos 6 meses (mesmo do Dashboard).
  // Se a URL trouxer um range inválido, cai no default e avisa o usuário via toast
  // — princípio "nada acontece silenciosamente".
  const now = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => startOfMonth(subMonths(now, 5)), [now]);
  const defaultTo = useMemo(() => endOfMonth(now), [now]);

  const urlFrom = searchParams.get("from");
  const urlTo = searchParams.get("to");
  const urlRangeValidation = useMemo(() => {
    if (!urlFrom && !urlTo) return { ok: true as const };
    const f = urlFrom ?? format(defaultFrom, "yyyy-MM-dd");
    const t = urlTo ?? format(defaultTo, "yyyy-MM-dd");
    return validateRange(f, t);
  }, [urlFrom, urlTo, defaultFrom, defaultTo]);

  const warnedRef = useRef(false);
  useEffect(() => {
    if (!urlRangeValidation.ok) {
      if (!warnedRef.current) {
        warnedRef.current = true;
        toast.warning("Período da URL inválido — usando últimos 6 meses", {
          description: urlRangeValidation.message,
        });
      }
      // Sanitiza a URL: remove ?from/?to inválidos para que a barra de
      // endereços reflita o período efetivamente aplicado (default).
      // Mantemos os demais parâmetros (gran, search, etc.) intactos.
      if (urlFrom || urlTo) {
        const next = new URLSearchParams(searchParams);
        next.delete("from");
        next.delete("to");
        setSearchParams(next, { replace: true });
      }
    } else {
      warnedRef.current = false;
    }
  }, [urlRangeValidation, urlFrom, urlTo, searchParams, setSearchParams]);

  const rangeFrom = useMemo(() => {
    if (!urlRangeValidation.ok || !urlFrom) return defaultFrom;
    return parseISO(urlFrom);
  }, [urlFrom, urlRangeValidation, defaultFrom]);
  const rangeTo = useMemo(() => {
    if (!urlRangeValidation.ok || !urlTo) return defaultTo;
    return parseISO(urlTo);
  }, [urlTo, urlRangeValidation, defaultTo]);

  const summary = useFinancialSummary(rangeFrom, rangeTo);
  const { contracts } = useContracts();
  const { data: employees = [] } = useEmployees();
  const { liabilities } = useLiabilities();
  const { opportunities } = useCRMOpportunities();
  const { stages } = usePipelineStages();
  // Fontes adicionais para drill-down do módulo DP
  const { data: dpConfig } = useDPConfig();
  const { data: positions = [] } = usePositions();
  const { data: allBenefits = [] } = useDPBenefits();
  const { data: allEmployeeBenefits = [] } = useEmployeeBenefits();
  const { costCenters = [] } = useCostCenters();

  // ===== Filtros derivados por KPI =====
  const curMonthStart = useMemo(() => format(startOfMonth(now), "yyyy-MM-dd"), [now]);
  const curMonthEnd = useMemo(() => format(endOfMonth(now), "yyyy-MM-dd"), [now]);
  // Dias úteis efetivos do mês corrente (override organizacional > automático).
  // Usado para benefícios "por_dia" (VA/VR e similares) — espelha exatamente
  // o cálculo do card no DPDashboard, garantindo reconciliação.
  const businessDaysInfo = useBusinessDaysForMonth(now);
  const DIAS_UTEIS_EFETIVOS = businessDaysInfo.days;

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

      // ===== Métricas do módulo DP (snapshot do mês corrente) =====
      case "dp-headcount": {
        const positionMap = new Map<string, string>(
          (positions as any[]).map((p) => [p.id, p.name ?? p.title ?? "—"]),
        );
        const ccMap = new Map<string, string>(
          (costCenters as any[]).map((c) => [c.id, c.name]),
        );
        const items = (employees as any[])
          .filter((e) => e.status === "ativo")
          .map((e) => ({
            nome: e.name,
            cargo: e.position_id ? positionMap.get(e.position_id) ?? "—" : "—",
            regime: e.contract_type || "—",
            admissao: e.admission_date || "—",
            cc: e.cost_center_id ? ccMap.get(e.cost_center_id) ?? "Sem CC" : "Sem CC",
            salario: Number(e.salary_base || 0),
          }));
        // "valor" = 1 por colaborador (para o Total = headcount)
        const itemsWithCount = items.map((i) => ({ ...i, valor: 1 }));
        return { items: itemsWithCount, total: items.length, kind: "dp-headcount" as const };
      }

      case "dp-folha-bruta": {
        const positionMap = new Map<string, string>(
          (positions as any[]).map((p) => [p.id, p.name ?? p.title ?? "—"]),
        );
        const items = (employees as any[])
          .filter((e) => e.status === "ativo")
          .map((e) => ({
            nome: e.name,
            cargo: e.position_id ? positionMap.get(e.position_id) ?? "—" : "—",
            regime: e.contract_type || "—",
            valor: Number(e.salary_base || 0),
          }));
        return { items, total: items.reduce((s, i) => s + i.valor, 0), kind: "dp-folha" as const };
      }

      case "dp-encargos": {
        const items = (employees as any[])
          .filter((e) => e.status === "ativo")
          .map((e) => {
            const sal = Number(e.salary_base || 0);
            const enc = calcEncargosPatronais(sal, dpConfig, e.contract_type);
            return {
              nome: e.name,
              regime: e.contract_type || "—",
              salario: sal,
              inss: enc.inssPatronal,
              rat: enc.rat,
              fgts: enc.fgts,
              terceiros: enc.terceiros,
              valor: enc.total,
            };
          });
        return { items, total: items.reduce((s, i) => s + i.valor, 0), kind: "dp-encargos" as const };
      }

      case "dp-custo-medio": {
        const ativos = (employees as any[]).filter((e) => e.status === "ativo");
        const folha = ativos.reduce((s, e) => s + Number(e.salary_base || 0), 0);
        const enc = ativos.reduce((s, e) => {
          const c = calcEncargosPatronais(Number(e.salary_base || 0), dpConfig, e.contract_type);
          return s + c.total;
        }, 0);
        const headcount = ativos.length;
        const medio = headcount > 0 ? (folha + enc) / headcount : 0;
        // Tabela informativa de composição — 1 linha por componente
        const items = [
          { componente: "Folha bruta total", detalhe: `${headcount} colaborador(es) ativo(s)`, valor: folha },
          { componente: "Encargos patronais", detalhe: "INSS + RAT + FGTS + Terceiros (PJ excluído)", valor: enc },
          { componente: "Custo total estimado", detalhe: "Folha + encargos", valor: folha + enc },
          { componente: "Custo médio por colaborador", detalhe: `(folha + encargos) ÷ ${headcount || 0}`, valor: medio },
        ];
        return { items, total: medio, kind: "dp-composicao" as const };
      }

      case "dp-vt": {
        const items = (employees as any[])
          .filter((e) => e.status === "ativo" && e.vt_ativo)
          .map((e) => {
            const sal = Number(e.salary_base || 0);
            const vtMensal = Number(e.vt_diario || 0) * DIAS_UTEIS_MES;
            const desconto = sal * 0.06;
            const liquido = Math.max(vtMensal - desconto, 0);
            return {
              nome: e.name,
              vt_diario: Number(e.vt_diario || 0),
              vt_mensal: vtMensal,
              desconto_6pct: desconto,
              valor: liquido,
            };
          });
        return { items, total: items.reduce((s, i) => s + i.valor, 0), kind: "dp-vt" as const };
      }

      case "dp-va":
      case "dp-saude":
      case "dp-outros-beneficios": {
        const isVA = (b: any) =>
          ["alimentação", "alimentacao", "refeição", "refeicao", "vale alimentação", "vale refeição", "va", "vr"]
            .some((k) => String(b.name || "").toLowerCase().includes(k));
        const isSaude = (b: any) =>
          ["saúde", "saude", "plano de saúde", "health"]
            .some((k) => String(b.name || "").toLowerCase().includes(k));
        const filterFn =
          (metric as KpiMetric) === "dp-va" ? isVA :
          (metric as KpiMetric) === "dp-saude" ? isSaude :
          (b: any) => !isVA(b) && !isSaude(b);
        const ativos = new Map((employees as any[])
          .filter((e) => e.status === "ativo")
          .map((e) => [e.id, e]));
        const items = (allEmployeeBenefits as any[])
          .filter((eb) => eb.active)
          .map((eb) => {
            const benefit = (allBenefits as any[]).find((b) => b.id === eb.benefit_id);
            if (!benefit || !benefit.active || !filterFn(benefit)) return null;
            const emp = ativos.get(eb.employee_id);
            if (!emp) return null;
            const valBase = eb.custom_value != null ? Number(eb.custom_value) : Number(benefit.default_value);
            // Cálculo por tipo:
            // - percentual: % sobre salário base
            // - por_dia: valor/dia × dias úteis efetivos do mês corrente
            //   (mesma fonte do card no DPDashboard — garante reconciliação)
            // - fixo: valor mensal direto
            const valor = benefit.type === "percentual"
              ? Number(emp.salary_base || 0) * (valBase / 100)
              : benefit.type === "por_dia"
              ? valBase * DIAS_UTEIS_EFETIVOS
              : valBase;
            return {
              nome: (emp as any).name,
              beneficio: benefit.name,
              tipo: benefit.type,
              base: valBase,
              // Campos extras p/ benefícios "por dia útil" — exibidos apenas
              // quando tipo === "por_dia"; demais tipos os ignoram na render.
              valor_dia: benefit.type === "por_dia" ? valBase : null,
              dias_uteis: benefit.type === "por_dia" ? DIAS_UTEIS_EFETIVOS : null,
              custo_mensal: benefit.type === "por_dia" ? valBase * DIAS_UTEIS_EFETIVOS : null,
              valor,
            };
          })
          .filter((x): x is {
            nome: string; beneficio: string; tipo: string; base: number;
            valor_dia: number | null; dias_uteis: number | null; custo_mensal: number | null;
            valor: number;
          } => x !== null);
        return { items, total: items.reduce((s, i) => s + i.valor, 0), kind: "dp-beneficio" as const };
      }

      default:
        return { items: [], total: 0, kind: "empty" as const };
    }
  }, [
    metric, meta, summary.entries, contracts, employees, liabilities, opportunities, stages,
    curMonthStart, curMonthEnd, dpConfig, positions, allBenefits, allEmployeeBenefits, costCenters,
    DIAS_UTEIS_EFETIVOS,
  ]);

  // ===== Validação cruzada com o KPI canônico do Dashboard =====
  // Para cada métrica, comparamos a soma dos itens detalhados (rows.total) com
  // o valor agregado que o Dashboard exibe — ambos derivados de
  // `useFinancialSummary` para garantir reproducibilidade. Diferenças <= 1
  // centavo são consideradas igualdade (arredondamento de ponto flutuante).
  // KPIs que dependem de cálculos derivados sem fonte 1:1 (ex.: runway, custo
  // de folha com encargos) são marcados como "informativos" — exibimos o valor
  // referencial sem aviso de erro.
  const reconciliation = useMemo(() => {
    if (!meta) return null;
    const m = metric as KpiMetric;

    type Recon = {
      dashboardLabel: string;
      dashboardValue: number;
      drilldownValue: number;
      mode: "exact" | "informative";
      note?: string;
    };

    const drilldownValue = rows.total;

    switch (m) {
      case "receita-mensal":
      case "despesas-mensais":
      case "resultado-mensal": {
        // O Dashboard mostra o valor do MÊS CORRENTE para esses 3 KPIs.
        // useFinancialSummary expõe entradas/saídas do horizonte inteiro;
        // recalculamos só o mês corrente sobre `summary.entries` (mesma fonte).
        let entradas = 0;
        let saidas = 0;
        for (const e of summary.entries) {
          if (e.data_prevista < curMonthStart || e.data_prevista > curMonthEnd) continue;
          const v = Number(e.valor_realizado ?? e.valor_previsto);
          if (e.tipo === "entrada") entradas += v;
          else saidas += v;
        }
        const dashboardValue =
          m === "receita-mensal" ? entradas :
          m === "despesas-mensais" ? saidas :
          entradas - saidas;
        return {
          dashboardLabel: "KPI do Dashboard (mês corrente)",
          dashboardValue,
          drilldownValue,
          mode: "exact" as const,
        } satisfies Recon;
      }

      case "saldo-periodo": {
        return {
          dashboardLabel: "KPI do Dashboard (saldo do horizonte)",
          dashboardValue: summary.cashflowTotals.saldo,
          drilldownValue,
          mode: "exact" as const,
        } satisfies Recon;
      }

      case "contratos-ativos": {
        return {
          dashboardLabel: "KPI do Dashboard (valor mensalizado)",
          dashboardValue: summary.monthlyContractValue,
          drilldownValue,
          mode: "exact" as const,
        } satisfies Recon;
      }

      case "passivos": {
        return {
          dashboardLabel: "KPI do Dashboard (passivos atualizados)",
          dashboardValue: summary.liabTotals.total,
          drilldownValue,
          mode: "exact" as const,
        } satisfies Recon;
      }

      case "crm-pipeline": {
        return {
          dashboardLabel: "KPI do Dashboard (pipeline ponderado)",
          dashboardValue: summary.crmWeightedValue,
          drilldownValue,
          mode: "exact" as const,
        } satisfies Recon;
      }

      case "custo-folha": {
        // O drill-down lista salário base. O Dashboard exibe a folha média
        // mensal (salário + benefícios + encargos). Mostramos os dois valores
        // como "informativo" para o usuário entender a diferença.
        return {
          dashboardLabel: "KPI do Dashboard (folha média c/ encargos)",
          dashboardValue: summary.avgMonthlyPayroll,
          drilldownValue,
          mode: "informative" as const,
          note: "O drill-down lista o salário base de cada colaborador. O KPI do Dashboard inclui benefícios e encargos patronais sobre toda a folha — por isso os valores costumam diferir.",
        } satisfies Recon;
      }

      case "runway": {
        // Drill-down soma despesas do horizonte. Dashboard mostra meses
        // (saldo / burn médio). Exibimos burn médio como referência.
        return {
          dashboardLabel: "Burn médio do horizonte",
          dashboardValue: summary.monthlyBurn,
          drilldownValue,
          mode: "informative" as const,
          note: "A soma das saídas do horizonte ÷ nº de meses = burn médio. O KPI do Dashboard mostra runway em meses (saldo ÷ burn).",
        } satisfies Recon;
      }

      // ===== DP — Reconciliação por recálculo a partir das mesmas fontes =====
      case "dp-headcount": {
        const headcount = (employees as any[]).filter((e) => e.status === "ativo").length;
        return {
          dashboardLabel: "Headcount no Dashboard DP",
          dashboardValue: headcount,
          drilldownValue,
          mode: "exact" as const,
        } satisfies Recon;
      }

      case "dp-folha-bruta": {
        const folha = (employees as any[])
          .filter((e) => e.status === "ativo")
          .reduce((s, e) => s + Number(e.salary_base || 0), 0);
        return {
          dashboardLabel: "Folha Bruta no Dashboard DP",
          dashboardValue: folha,
          drilldownValue,
          mode: "exact" as const,
        } satisfies Recon;
      }

      case "dp-encargos": {
        const encTotal = (employees as any[])
          .filter((e) => e.status === "ativo")
          .reduce((s, e) => s + calcEncargosPatronais(Number(e.salary_base || 0), dpConfig, e.contract_type).total, 0);
        return {
          dashboardLabel: "Encargos Totais no Dashboard DP",
          dashboardValue: encTotal,
          drilldownValue,
          mode: "exact" as const,
        } satisfies Recon;
      }

      case "dp-custo-medio": {
        const ativos = (employees as any[]).filter((e) => e.status === "ativo");
        const folha = ativos.reduce((s, e) => s + Number(e.salary_base || 0), 0);
        const enc = ativos.reduce((s, e) => s + calcEncargosPatronais(Number(e.salary_base || 0), dpConfig, e.contract_type).total, 0);
        const medio = ativos.length > 0 ? (folha + enc) / ativos.length : 0;
        return {
          dashboardLabel: "Custo Médio no Dashboard DP",
          dashboardValue: medio,
          drilldownValue,
          mode: "exact" as const,
          note: "Composição: folha bruta + encargos patronais ÷ headcount ativo. Não inclui benefícios.",
        } satisfies Recon;
      }

      case "dp-vt": {
        const total = (employees as any[])
          .filter((e) => e.status === "ativo" && e.vt_ativo)
          .reduce((s, e) => {
            const vtMensal = Number(e.vt_diario || 0) * DIAS_UTEIS_MES;
            const desconto = Number(e.salary_base || 0) * 0.06;
            return s + Math.max(vtMensal - desconto, 0);
          }, 0);
        return {
          dashboardLabel: "Vale Transporte no Dashboard DP",
          dashboardValue: total,
          drilldownValue,
          mode: "exact" as const,
        } satisfies Recon;
      }

      case "dp-va":
      case "dp-saude":
      case "dp-outros-beneficios": {
        const isVA = (b: any) =>
          ["alimentação", "alimentacao", "refeição", "refeicao", "vale alimentação", "vale refeição", "va", "vr"]
            .some((k) => String(b.name || "").toLowerCase().includes(k));
        const isSaude = (b: any) =>
          ["saúde", "saude", "plano de saúde", "health"]
            .some((k) => String(b.name || "").toLowerCase().includes(k));
        const filterFn =
          (metric as KpiMetric) === "dp-va" ? isVA :
          (metric as KpiMetric) === "dp-saude" ? isSaude :
          (b: any) => !isVA(b) && !isSaude(b);
        const ativos = new Map((employees as any[])
          .filter((e) => e.status === "ativo")
          .map((e) => [e.id, e]));
        const total = (allEmployeeBenefits as any[])
          .filter((eb) => eb.active)
          .reduce((s, eb) => {
            const benefit = (allBenefits as any[]).find((b) => b.id === eb.benefit_id);
            if (!benefit || !benefit.active || !filterFn(benefit)) return s;
            const emp = ativos.get(eb.employee_id) as any;
            if (!emp) return s;
            const valBase = eb.custom_value != null ? Number(eb.custom_value) : Number(benefit.default_value);
            const v = benefit.type === "percentual"
              ? Number(emp.salary_base || 0) * (valBase / 100)
              : benefit.type === "por_dia"
              ? valBase * DIAS_UTEIS_EFETIVOS
              : valBase;
            return s + v;
          }, 0);
        return {
          dashboardLabel: "Benefício no Dashboard DP",
          dashboardValue: total,
          drilldownValue,
          mode: "exact" as const,
        } satisfies Recon;
      }

      default:
        return null;
    }
  }, [
    meta,
    metric,
    rows.total,
    summary.entries,
    summary.cashflowTotals.saldo,
    summary.monthlyContractValue,
    summary.liabTotals.total,
    summary.crmWeightedValue,
    summary.avgMonthlyPayroll,
    summary.monthlyBurn,
    curMonthStart,
    curMonthEnd,
    employees,
    dpConfig,
    allBenefits,
    allEmployeeBenefits,
    DIAS_UTEIS_EFETIVOS,
  ]);

  // Status: "match" (bate até 1 centavo), "mismatch" (diverge), "info" (modo informativo).
  const reconciliationStatus = useMemo(() => {
    if (!reconciliation) return null;
    if (reconciliation.mode === "informative") return "info" as const;
    const diff = Math.abs(reconciliation.dashboardValue - reconciliation.drilldownValue);
    return diff <= 0.01 ? ("match" as const) : ("mismatch" as const);
  }, [reconciliation]);

  // ===== Busca + paginação =====
  // Filtro textual sobre todos os campos string/number do item. Total e CSV
  // são derivados do conjunto filtrado, mantendo a auditabilidade ("o que
  // você vê é o que você exporta").
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  // Ordenação clicável das colunas do drill-down. `null` = ordem natural
  // (a mesma usada na geração das `rows.items`, normalmente cronológica para
  // fluxo e por nome para listas de cadastro).
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  /** Granularidade aplicável apenas a KPIs com dimensão temporal de fluxo. */
  const supportsQuarterly = rows.kind === "cashflow" || rows.kind === "result";
  /** Granularidade visível imediatamente (URL/toggle) — usada apenas para CSS/labels. */
  const isQuarterly = supportsQuarterly && granularity === "trimestral";
  /** Granularidade efetivamente aplicada à tabela (pode atrasar 1 frame durante transição). */
  const isQuarterlyApplied = supportsQuarterly && deferredGranularity === "trimestral";

  /**
   * Quando trimestral está ativo e o KPI é de fluxo/resultado, agregamos
   * `filteredItems` por trimestre (`yyyy-Qn`). O valor total do horizonte
   * (`rows.total`) e a reconciliação não mudam — granularidade é apenas
   * apresentação.
   */
  const aggregatedRows = useMemo(() => {
    if (!isQuarterlyApplied) return filteredItems;
    const buckets = new Map<
      string,
      { period: string; label: string; count: number; entradas: number; saidas: number; valor: number }
    >();
    for (const item of filteredItems as any[]) {
      if (!item.data) continue;
      const d = parseISO(item.data);
      const q = getQuarter(d);
      const y = d.getFullYear();
      const key = `${y}-Q${q}`;
      const monthStart = (q - 1) * 3;
      const months = [monthStart, monthStart + 1, monthStart + 2]
        .map((m) => format(new Date(y, m, 1), "MMM", { locale: ptBR }))
        .join("–");
      const label = `${key} — ${months}/${y}`;
      const bucket = buckets.get(key) ?? {
        period: key,
        label,
        count: 0,
        entradas: 0,
        saidas: 0,
        valor: 0,
      };
      bucket.count += 1;
      if (rows.kind === "result") {
        // Em "result", `valor` já vem com sinal (entrada positiva, saída negativa).
        const v = Number(item.valor) || 0;
        if (v >= 0) bucket.entradas += v;
        else bucket.saidas += Math.abs(v);
        bucket.valor += v;
      } else {
        const v = Number(item.valor) || 0;
        bucket.valor += v;
      }
      buckets.set(key, bucket);
    }
    return Array.from(buckets.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [filteredItems, isQuarterlyApplied, rows.kind]);

  /**
   * Ordenação clicável: aplicada após o filtro e a agregação trimestral.
   * Valores numéricos comparam por subtração; demais por `localeCompare` com
   * locale pt-BR e `numeric: true` (lida bem com códigos tipo "01", "10").
   * Datas no formato `yyyy-MM-dd` ordenam corretamente como string.
   */
  const sortedRows = useMemo(() => {
    if (!sortKey) return aggregatedRows;
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...(aggregatedRows as any[])];
    arr.sort((a, b) => {
      const va = a?.[sortKey];
      const vb = b?.[sortKey];
      // null/undefined sempre por último, independente da direção
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      // Tenta numérico se ambos forem strings numéricas
      const na = Number(va);
      const nb = Number(vb);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && typeof va !== "string") {
        return (na - nb) * dir;
      }
      return String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" }) * dir;
    });
    return arr;
  }, [aggregatedRows, sortKey, sortDir]);

  const displayKind = isQuarterlyApplied
    ? rows.kind === "result"
      ? "result-quarter"
      : "cashflow-quarter"
    : rows.kind;

  const filteredTotal = useMemo(
    () => filteredItems.reduce((s: number, i: any) => s + Number(i.valor ?? i.mensal ?? i.ponderado ?? i.salario ?? 0), 0),
    [filteredItems],
  );

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  // Reseta página ao mudar busca, métrica, tamanho de página, granularidade
  // ou ordenação. Isso garante que o usuário sempre veja o "topo" do recorte.
  useEffect(() => {
    setPage(1);
  }, [search, metric, pageSize, isQuarterlyApplied, sortKey, sortDir]);

  // Reseta a ordenação ao trocar de métrica ou alternar granularidade,
  // pois as colunas/chaves disponíveis mudam.
  useEffect(() => {
    setSortKey(null);
    setSortDir("asc");
  }, [metric, isQuarterlyApplied]);

  // Garante que a página atual existe após mudanças no dataset
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const isFiltering = search.trim().length > 0;
  const showingFrom = sortedRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, sortedRows.length);

  /** Manipula clique no cabeçalho: alterna asc/desc e reinicia em asc ao trocar a coluna. */
  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const exportCsv = () => {
    // Exporta exatamente o que está visível: respeita filtro, agregação
    // trimestral E ordenação aplicada pelo usuário ("WYSIWYG audit").
    const source = isQuarterly ? sortedRows : (sortKey ? sortedRows : filteredItems);
    if (source.length === 0) return;
    const headers = Object.keys(source[0] as Record<string, unknown>);
    const csvRows = [
      headers.join(";"),
      ...source.map((r) =>
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
    const granSuffix = isQuarterly ? "-trimestral" : "";
    const filterSuffix = isFiltering ? "-filtrado" : "";
    a.download = `relatorio-${metric}${granSuffix}${filterSuffix}-${format(now, "yyyyMMdd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // "Voltar" inteligente: KPIs de DP retornam ao dashboard do DP; demais ao Dashboard Geral.
  const backTarget = metric?.startsWith("dp-") ? "/dp" : "/";
  const backLabel = metric?.startsWith("dp-") ? "Voltar ao DP" : "Voltar ao Dashboard";

  if (!meta) {
    return (
      <div className="space-y-6">
        <PageHeader title="Relatório não encontrado" description="O KPI solicitado não está disponível." />
        <Button variant="outline" onClick={() => navigate(backTarget)}>
          <ArrowLeft size={14} className="mr-2" /> {backLabel}
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
        <Button variant="ghost" size="sm" onClick={() => navigate(backTarget)}>
          <ArrowLeft size={14} className="mr-2" /> {backLabel}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={(isQuarterly ? aggregatedRows.length : filteredItems.length) === 0}
        >
          <Download size={14} className="mr-2" />
          {isQuarterly
            ? isFiltering
              ? "Exportar CSV (trimestral, filtrado)"
              : "Exportar CSV (trimestral)"
            : isFiltering
            ? "Exportar CSV (filtrado)"
            : "Exportar CSV"}
        </Button>
      </div>

      <PageHeader title={meta.title} description={meta.description} />

      <section className="glass-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{meta.icon}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Período</p>
                <KpiPeriodPresetsPopover
                  currentFrom={format(rangeFrom, "yyyy-MM-dd")}
                  currentTo={format(rangeTo, "yyyy-MM-dd")}
                  onApply={applyRange}
                  disabled={meta.scopeIsCurrentMonth}
                />
              </div>
              <p className="text-sm font-medium text-foreground capitalize mt-1">{periodLabel}</p>
              {currentOrg && (
                <p className="text-xs text-muted-foreground mt-0.5">{currentOrg.name}</p>
              )}
              <div className="mt-3">
                <KpiRangePicker
                  currentFrom={format(rangeFrom, "yyyy-MM-dd")}
                  currentTo={format(rangeTo, "yyyy-MM-dd")}
                  onApply={applyRange}
                  disabled={meta.scopeIsCurrentMonth}
                />
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 flex-wrap">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {isFiltering ? "Total filtrado" : "Total"}
              </p>
              {!isFiltering && reconciliationStatus && (
                <ReconciliationBadge status={reconciliationStatus} />
              )}
              {supportsQuarterly && (
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={granularity}
                  onValueChange={(v) => {
                    if (v === "mensal" || v === "trimestral") applyGranularity(v);
                  }}
                  aria-label="Granularidade da composição"
                  className="ml-1"
                >
                  <ToggleGroupItem
                    value="mensal"
                    aria-label="Visão mensal"
                    aria-busy={isGranularityPending && granularity === "mensal"}
                    className="h-6 px-2 text-[11px] data-[state=on]:data-[busy=true]:opacity-70"
                    data-busy={isGranularityPending && granularity === "mensal" ? "true" : undefined}
                  >
                    Mensal
                    {isGranularityPending && granularity === "mensal" && (
                      <Loader2 className="ml-1 h-3 w-3 animate-spin" aria-hidden />
                    )}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="trimestral"
                    aria-label="Visão trimestral"
                    aria-busy={isGranularityPending && granularity === "trimestral"}
                    className="h-6 px-2 text-[11px] data-[state=on]:data-[busy=true]:opacity-70"
                    data-busy={isGranularityPending && granularity === "trimestral" ? "true" : undefined}
                  >
                    Trimestral
                    {isGranularityPending && granularity === "trimestral" && (
                      <Loader2 className="ml-1 h-3 w-3 animate-spin" aria-hidden />
                    )}
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground">
              {fmt(isFiltering ? filteredTotal : rows.total)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFiltering
                ? `${filteredItems.length} de ${rows.items.length} item(ns)`
                : `${rows.items.length} item(ns)`}
            </p>
            {supportsQuarterly && (
              <p className="text-[10px] text-muted-foreground max-w-[260px] text-right leading-tight mt-1">
                A granularidade muda apenas a exibição da composição; o total e a reconciliação permanecem.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Painel de validação cruzada: garante que a soma dos itens detalhados
          confere com o KPI exibido no Dashboard para o mesmo período.
          - "match"    → verde: somas batem exatamente (até 1 centavo)
          - "mismatch" → vermelho: divergência detectada (mostra o delta)
          - "info"     → azul: KPI derivado, exibimos o valor referencial
          Quando uma busca está ativa, ocultamos o badge de validação porque
          o "Total" no card passa a refletir apenas o subconjunto filtrado. */}
      {reconciliation && reconciliationStatus && !isFiltering && (
        <ReconciliationPanel
          status={reconciliationStatus}
          dashboardLabel={reconciliation.dashboardLabel}
          dashboardValue={reconciliation.dashboardValue}
          drilldownValue={reconciliation.drilldownValue}
          note={reconciliation.note}
        />
      )}

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
                <TableHeader>
                  <SortableHeaderRow
                    columns={getColumns(displayKind)}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHeader>
                <TableBody>
                  {isGranularityPending && supportsQuarterly
                    ? Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          {Array.from({ length: getColumnCount(displayKind) }).map((__, c) => (
                            <TableCell key={c}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : pagedItems.map((r, i) => renderRow(displayKind, r, (page - 1) * pageSize + i))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-t border-border/60">
              <p className="text-xs text-muted-foreground">
                Mostrando <span className="font-medium text-foreground">{showingFrom}</span>–
                <span className="font-medium text-foreground">{showingTo}</span> de{" "}
                <span className="font-medium text-foreground">{sortedRows.length}</span>
                {isQuarterly && <span className="ml-1">trimestre(s)</span>}
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

/**
 * Definição declarativa das colunas por tipo de relatório.
 * `key` deve corresponder ao campo presente em cada item de `rows.items`
 * (ou no bucket trimestral em modo `*-quarter`). Quando `sortable` é falso,
 * o cabeçalho permanece estático (ex.: trimestre já vem ordenado por período).
 */
type ColumnDef = {
  key: string;
  label: string;
  align?: "left" | "right";
  sortable?: boolean;
};

const COLUMN_DEFS: Record<string, ColumnDef[]> = {
  cashflow: [
    { key: "data", label: "Data", sortable: true },
    { key: "descricao", label: "Descrição", sortable: true },
    { key: "categoria", label: "Categoria", sortable: true },
    { key: "origem", label: "Origem", sortable: true },
    { key: "valor", label: "Valor", align: "right", sortable: true },
  ],
  "cashflow-quarter": [
    { key: "label", label: "Trimestre", sortable: true },
    { key: "count", label: "Itens", align: "right", sortable: true },
    { key: "valor", label: "Valor total", align: "right", sortable: true },
  ],
  result: [
    { key: "data", label: "Data", sortable: true },
    { key: "descricao", label: "Descrição", sortable: true },
    { key: "tipo", label: "Tipo", sortable: true },
    { key: "categoria", label: "Categoria", sortable: true },
    { key: "valor", label: "Impacto", align: "right", sortable: true },
  ],
  "result-quarter": [
    { key: "label", label: "Trimestre", sortable: true },
    { key: "count", label: "Itens", align: "right", sortable: true },
    { key: "entradas", label: "Entradas", align: "right", sortable: true },
    { key: "saidas", label: "Saídas", align: "right", sortable: true },
    { key: "valor", label: "Líquido", align: "right", sortable: true },
  ],
  contracts: [
    { key: "nome", label: "Contrato", sortable: true },
    { key: "tipo", label: "Tipo", sortable: true },
    { key: "recorrencia", label: "Recorrência", sortable: true },
    { key: "data_fim", label: "Fim", sortable: true },
    { key: "valor", label: "Valor", align: "right", sortable: true },
    { key: "mensal", label: "Mensalizado", align: "right", sortable: true },
  ],
  payroll: [
    { key: "nome", label: "Colaborador", sortable: true },
    { key: "cargo", label: "Cargo", sortable: true },
    { key: "regime", label: "Regime", sortable: true },
    { key: "admissao", label: "Admissão", sortable: true },
    { key: "salario", label: "Salário base", align: "right", sortable: true },
  ],
  liabilities: [
    { key: "descricao", label: "Descrição", sortable: true },
    { key: "tipo", label: "Tipo", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "probabilidade", label: "Probabilidade", sortable: true },
    { key: "valor", label: "Valor atualizado", align: "right", sortable: true },
  ],
  crm: [
    { key: "titulo", label: "Oportunidade", sortable: true },
    { key: "estagio", label: "Estágio", sortable: true },
    { key: "probabilidade", label: "Prob.", align: "right", sortable: true },
    { key: "valor", label: "Valor", align: "right", sortable: true },
    { key: "ponderado", label: "Ponderado", align: "right", sortable: true },
  ],
  "dp-headcount": [
    { key: "nome", label: "Colaborador", sortable: true },
    { key: "cargo", label: "Cargo", sortable: true },
    { key: "regime", label: "Regime", sortable: true },
    { key: "admissao", label: "Admissão", sortable: true },
    { key: "cc", label: "Centro de Custo", sortable: true },
    { key: "salario", label: "Salário base", align: "right", sortable: true },
  ],
  "dp-folha": [
    { key: "nome", label: "Colaborador", sortable: true },
    { key: "cargo", label: "Cargo", sortable: true },
    { key: "regime", label: "Regime", sortable: true },
    { key: "valor", label: "Salário base", align: "right", sortable: true },
  ],
  "dp-encargos": [
    { key: "nome", label: "Colaborador", sortable: true },
    { key: "regime", label: "Regime", sortable: true },
    { key: "salario", label: "Salário", align: "right", sortable: true },
    { key: "inss", label: "INSS Pat.", align: "right", sortable: true },
    { key: "rat", label: "RAT", align: "right", sortable: true },
    { key: "fgts", label: "FGTS", align: "right", sortable: true },
    { key: "valor", label: "Total", align: "right", sortable: true },
  ],
  "dp-composicao": [
    { key: "componente", label: "Componente", sortable: true },
    { key: "detalhe", label: "Detalhe", sortable: true },
    { key: "valor", label: "Valor", align: "right", sortable: true },
  ],
  "dp-vt": [
    { key: "nome", label: "Colaborador", sortable: true },
    { key: "vt_diario", label: "VT diário", align: "right", sortable: true },
    { key: "vt_mensal", label: "VT mensal (×22)", align: "right", sortable: true },
    { key: "desconto_6pct", label: "Desconto 6%", align: "right", sortable: true },
    { key: "valor", label: "Custo empresa", align: "right", sortable: true },
  ],
  "dp-beneficio": [
    { key: "nome", label: "Colaborador", sortable: true },
    { key: "beneficio", label: "Benefício", sortable: true },
    { key: "tipo", label: "Tipo", sortable: true },
    { key: "base", label: "Base", align: "right", sortable: true },
    { key: "valor_dia", label: "Valor/dia", align: "right", sortable: true },
    { key: "dias_uteis", label: "Dias úteis", align: "right", sortable: true },
    { key: "valor", label: "Custo mensal", align: "right", sortable: true },
  ],
};

function getColumns(kind: string): ColumnDef[] {
  return COLUMN_DEFS[kind] ?? [];
}

function getColumnCount(kind: string): number {
  return getColumns(kind).length || 5;
}

/**
 * Cabeçalho de tabela com colunas clicáveis para ordenação.
 * Mantém alinhamento (esquerda/direita) e mostra um indicador visual:
 * - inativo: ícone neutro (ArrowUpDown), opacidade reduzida
 * - ativo:   ícone direcional (ArrowUp/ArrowDown), cor de destaque
 *
 * Acessibilidade: usa <button> nativo dentro do <th>, com `aria-sort` e
 * `aria-label` descritivo (lido por leitores de tela).
 */
function SortableHeaderRow({
  columns,
  sortKey,
  sortDir,
  onSort,
}: {
  columns: ColumnDef[];
  sortKey: string | null;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  return (
    <TableRow>
      {columns.map((col) => {
        const isActive = sortKey === col.key;
        const align = col.align === "right" ? "text-right" : "";
        const ariaSort: "ascending" | "descending" | "none" = isActive
          ? sortDir === "asc"
            ? "ascending"
            : "descending"
          : "none";

        if (!col.sortable) {
          return (
            <TableHead key={col.key} className={align}>
              {col.label}
            </TableHead>
          );
        }

        return (
          <TableHead key={col.key} className={align} aria-sort={ariaSort}>
            <button
              type="button"
              onClick={() => onSort(col.key)}
              className={`inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors ${
                col.align === "right" ? "ml-auto" : ""
              } ${isActive ? "text-foreground" : "text-muted-foreground"}`}
              aria-label={`Ordenar por ${col.label}${
                isActive ? ` (atual: ${sortDir === "asc" ? "crescente" : "decrescente"})` : ""
              }`}
            >
              <span>{col.label}</span>
              {isActive ? (
                sortDir === "asc" ? (
                  <ArrowUp size={12} className="text-primary" />
                ) : (
                  <ArrowDown size={12} className="text-primary" />
                )
              ) : (
                <ArrowUpDown size={12} className="opacity-40" />
              )}
            </button>
          </TableHead>
        );
      })}
    </TableRow>
  );
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
    case "cashflow-quarter":
      return (
        <TableRow key={i}>
          <TableCell className="font-medium capitalize">{r.label}</TableCell>
          <TableCell className="text-right text-muted-foreground">{r.count}</TableCell>
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
    case "result-quarter":
      return (
        <TableRow key={i}>
          <TableCell className="font-medium capitalize">{r.label}</TableCell>
          <TableCell className="text-right text-muted-foreground">{r.count}</TableCell>
          <TableCell className="text-right font-mono text-success">{fmt(r.entradas)}</TableCell>
          <TableCell className="text-right font-mono text-destructive">{fmt(r.saidas)}</TableCell>
          <TableCell className={`text-right font-mono font-semibold ${r.valor < 0 ? "text-destructive" : "text-success"}`}>
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
    case "dp-headcount":
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
          <TableCell className="text-muted-foreground">{r.cc}</TableCell>
          <TableCell className="text-right font-mono">{fmt(r.salario)}</TableCell>
        </TableRow>
      );
    case "dp-folha":
      return (
        <TableRow key={i}>
          <TableCell className="font-medium">{r.nome}</TableCell>
          <TableCell className="text-muted-foreground">{r.cargo}</TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs uppercase">{r.regime}</Badge>
          </TableCell>
          <TableCell className="text-right font-mono">{fmt(r.valor)}</TableCell>
        </TableRow>
      );
    case "dp-encargos":
      return (
        <TableRow key={i}>
          <TableCell className="font-medium">{r.nome}</TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs uppercase">{r.regime}</Badge>
          </TableCell>
          <TableCell className="text-right font-mono text-muted-foreground">{fmt(r.salario)}</TableCell>
          <TableCell className="text-right font-mono">{fmt(r.inss)}</TableCell>
          <TableCell className="text-right font-mono">{fmt(r.rat)}</TableCell>
          <TableCell className="text-right font-mono">{fmt(r.fgts)}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{fmt(r.valor)}</TableCell>
        </TableRow>
      );
    case "dp-composicao":
      return (
        <TableRow key={i}>
          <TableCell className="font-medium">{r.componente}</TableCell>
          <TableCell className="text-muted-foreground">{r.detalhe}</TableCell>
          <TableCell className="text-right font-mono">{fmt(r.valor)}</TableCell>
        </TableRow>
      );
    case "dp-vt":
      return (
        <TableRow key={i}>
          <TableCell className="font-medium">{r.nome}</TableCell>
          <TableCell className="text-right font-mono">{fmt(r.vt_diario)}</TableCell>
          <TableCell className="text-right font-mono text-muted-foreground">{fmt(r.vt_mensal)}</TableCell>
          <TableCell className="text-right font-mono text-destructive">{fmt(r.desconto_6pct)}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{fmt(r.valor)}</TableCell>
        </TableRow>
      );
    case "dp-beneficio": {
      const tipoLabel =
        r.tipo === "percentual" ? "Percentual" :
        r.tipo === "por_dia" ? "Por dia útil" :
        "Valor fixo";
      const tipoVariant: "secondary" | "outline" | "default" =
        r.tipo === "por_dia" ? "default" :
        r.tipo === "percentual" ? "secondary" :
        "outline";
      return (
        <TableRow key={i}>
          <TableCell className="font-medium">{r.nome}</TableCell>
          <TableCell className="text-muted-foreground">{r.beneficio}</TableCell>
          <TableCell>
            <Badge variant={tipoVariant} className="text-xs">{tipoLabel}</Badge>
          </TableCell>
          <TableCell className="text-right font-mono text-muted-foreground">
            {r.tipo === "percentual"
              ? `${r.base}%`
              : r.tipo === "por_dia"
              ? `${fmt(r.base)}/dia`
              : fmt(r.base)}
          </TableCell>
          <TableCell className="text-right font-mono text-muted-foreground">
            {r.tipo === "por_dia" && r.valor_dia != null ? fmt(r.valor_dia) : "—"}
          </TableCell>
          <TableCell className="text-right font-mono text-muted-foreground">
            {r.tipo === "por_dia" && r.dias_uteis != null ? r.dias_uteis : "—"}
          </TableCell>
          <TableCell className="text-right font-mono font-semibold">{fmt(r.valor)}</TableCell>
        </TableRow>
      );
    }
    default:
      return null;
  }
}

// ===== Componentes de validação cruzada =====

type ReconciliationStatus = "match" | "mismatch" | "info";

/** Pequeno selo ao lado do "Total" — sinaliza rapidamente se a soma confere. */
function ReconciliationBadge({ status }: { status: ReconciliationStatus }) {
  const config = {
    match: {
      icon: <CheckCircle2 size={12} />,
      label: "Confere com Dashboard",
      className: "bg-success/15 text-success border-success/30",
    },
    mismatch: {
      icon: <AlertCircle size={12} />,
      label: "Diverge do Dashboard",
      className: "bg-destructive/15 text-destructive border-destructive/30",
    },
    info: {
      icon: <Info size={12} />,
      label: "KPI derivado",
      className: "bg-primary/10 text-primary border-primary/30",
    },
  }[status];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${config.className}`}
            role="status"
            aria-label={config.label}
          >
            {config.icon}
            {status === "match" ? "OK" : status === "mismatch" ? "Δ" : "i"}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[260px] text-xs">
          {config.label}. Veja o painel abaixo para o cruzamento detalhado.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Painel completo: mostra os dois valores lado a lado com o resultado do cruzamento. */
function ReconciliationPanel({
  status,
  dashboardLabel,
  dashboardValue,
  drilldownValue,
  note,
}: {
  status: ReconciliationStatus;
  dashboardLabel: string;
  dashboardValue: number;
  drilldownValue: number;
  note?: string;
}) {
  const delta = drilldownValue - dashboardValue;
  const deltaPct = dashboardValue !== 0 ? (delta / Math.abs(dashboardValue)) * 100 : 0;

  const styles = {
    match: {
      border: "border-success/40",
      bg: "bg-success/5",
      iconBg: "bg-success/15 text-success",
      icon: <CheckCircle2 size={18} />,
      title: "Soma dos itens confere com o KPI do Dashboard",
      subtitle: "Os valores batem exatamente — auditoria validada para este período.",
    },
    mismatch: {
      border: "border-destructive/40",
      bg: "bg-destructive/5",
      iconBg: "bg-destructive/15 text-destructive",
      icon: <AlertCircle size={18} />,
      title: "Divergência detectada entre drill-down e Dashboard",
      subtitle: "Os totais deveriam coincidir. Verifique filtros, atualização de dados ou regras de classificação.",
    },
    info: {
      border: "border-primary/30",
      bg: "bg-primary/5",
      iconBg: "bg-primary/15 text-primary",
      icon: <Info size={18} />,
      title: "Comparação informativa",
      subtitle: "Este KPI é derivado de um cálculo agregado — exibimos a referência do Dashboard para contexto.",
    },
  }[status];

  return (
    <section className={`glass-card border ${styles.border} ${styles.bg} p-4`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className={`rounded-lg p-2 ${styles.iconBg}`}>{styles.icon}</div>
        <div className="flex-1 min-w-[240px]">
          <p className="text-sm font-semibold text-foreground">{styles.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{styles.subtitle}</p>
          {note && (
            <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-border pl-2">
              {note}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{dashboardLabel}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Soma do drill-down</p>
          <p className="text-sm font-mono font-semibold text-foreground">{fmt(dashboardValue)}</p>
          <p className="text-sm font-mono font-semibold text-foreground">{fmt(drilldownValue)}</p>
          {status !== "info" && (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground col-span-2 mt-1 border-t border-border/60 pt-1">
                Diferença
              </p>
              <p
                className={`text-sm font-mono font-semibold col-span-2 ${
                  status === "match" ? "text-success" : "text-destructive"
                }`}
              >
                {fmt(delta)}
                {dashboardValue !== 0 && (
                  <span className="text-xs font-normal ml-1">
                    ({deltaPct >= 0 ? "+" : ""}
                    {deltaPct.toFixed(2)}%)
                  </span>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
