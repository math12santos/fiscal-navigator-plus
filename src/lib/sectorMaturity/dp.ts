// Avaliação de maturidade do setor DP.
// Função pura — recebe os dados já carregados pelo hook e retorna o resultado.

import {
  ChecklistItem,
  SectorMaturityResult,
  maturityLabelFromScore,
} from "./types";
import { DEFAULT_TARGETS, SectorMaturityTargets } from "./targets";

interface EvaluateDPInput {
  targets?: SectorMaturityTargets;
  // Configurações
  dpConfig: any | null;
  businessDays: any[];           // dp_business_days
  // Estrutura
  positions: any[];
  employees: any[];              // somente ativos
  benefits: any[];               // dp_benefits
  employeeBenefits: any[];       // employee_benefits ativos
  documents: any[];              // employee_documents
  // Atualização
  payrollRuns: any[];            // payroll_runs
  compensations: any[];          // employee_compensations (reajustes)
  vacations: any[];              // employee_vacations
  // Rotinas cadastradas por cargo (estrutural)
  positionRoutines: any[];       // position_routines ativos
  // Rotinas (mês corrente)
  routinesGenerated: number;
  routinesCompleted: number;
  routinesOverdue: number;
  refDate?: Date;
}

// Documentos obrigatórios podem ser sobrescritos via targets.documents_required.

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, part / total));
}

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function evaluateDP(input: EvaluateDPInput): SectorMaturityResult {
  const today = input.refDate ?? new Date();
  const targets = input.targets ?? DEFAULT_TARGETS;
  const DOC_REQUIRED_TYPES = targets.documents_required;
  const items: ChecklistItem[] = [];
  const push = (i: ChecklistItem) => items.push({ ...i, done: i.earned >= i.weight });

  // ============== A. COMPLETUDE (50 pts) ==============

  // 1. Configurações tributárias (10 pts)
  {
    const cfg = input.dpConfig;
    const requiredFields: (keyof any)[] = [
      "inss_patronal_pct", "fgts_pct", "terceiros_pct",
      "provisao_ferias_pct", "provisao_13_pct", "vt_desconto_pct",
    ];
    const filled = cfg
      ? requiredFields.filter((f) => cfg[f] !== null && cfg[f] !== undefined && Number(cfg[f]) > 0).length
      : 0;
    const earned = 10 * pct(filled, requiredFields.length);
    push({
      key: "dp-config-tributaria",
      label: "Configuração tributária do DP",
      category: "completude",
      weight: 10,
      earned,
      hint: "INSS, FGTS, Terceiros, Provisões e desconto de VT.",
      ctaTab: "config",
      detail: `${filled}/${requiredFields.length} parâmetros`,
    });
  }

  // 2. Cargos cadastrados (5 pts)
  {
    const count = input.positions.length;
    const earned = count > 0 ? 5 : 0;
    push({
      key: "dp-positions",
      label: "Cargos cadastrados",
      category: "completude",
      weight: 5,
      earned,
      hint: "Pelo menos um cargo formalizado.",
      ctaTab: "cargos",
      detail: `${count} cargo(s)`,
    });
  }

  // 3. Cargos com responsabilidades + faixa salarial (5 pts)
  {
    const total = input.positions.length;
    const ok = input.positions.filter(
      (p) => (p.responsibilities || "").trim() && Number(p.salary_min || 0) > 0 && Number(p.salary_max || 0) > 0
    ).length;
    const earned = total > 0 ? 5 * pct(ok, total) : 0;
    push({
      key: "dp-positions-detail",
      label: "Cargos com responsabilidades e faixa salarial",
      category: "completude",
      weight: 5,
      earned,
      hint: "Cada cargo deve ter descrição e faixa salarial mínima/máxima.",
      ctaTab: "cargos",
      detail: total > 0 ? `${ok}/${total}` : "—",
    });
  }

  // 4. Colaboradores ativos cadastrados (5 pts)
  {
    const count = input.employees.length;
    const earned = count > 0 ? 5 : 0;
    push({
      key: "dp-employees",
      label: "Colaboradores ativos cadastrados",
      category: "completude",
      weight: 5,
      earned,
      ctaTab: "colaboradores",
      detail: `${count} ativo(s)`,
    });
  }

  // 5. Colaboradores com cargo + centro de custo (5 pts)
  {
    const total = input.employees.length;
    const ok = input.employees.filter((e) => e.position_id && e.cost_center_id).length;
    const earned = total > 0 ? 5 * pct(ok, total) : 0;
    push({
      key: "dp-employees-link",
      label: "Colaboradores vinculados a cargo e centro de custo",
      category: "completude",
      weight: 5,
      earned,
      hint: "Cada colaborador precisa de cargo e CC para refletir nos relatórios.",
      ctaTab: "colaboradores",
      detail: total > 0 ? `${ok}/${total}` : "—",
    });
  }

  // 6. Benefícios cadastrados (5 pts)
  {
    const count = input.benefits.length;
    const earned = count > 0 ? 5 : 0;
    push({
      key: "dp-benefits",
      label: "Catálogo de benefícios cadastrado",
      category: "completude",
      weight: 5,
      earned,
      ctaTab: "beneficios",
      detail: `${count} benefício(s)`,
    });
  }

  // 7. Vínculos colaborador↔benefício (5 pts) — pelo menos 1 benefício/colaborador
  {
    const total = input.employees.length;
    const empIdsWithBenefit = new Set(
      input.employeeBenefits.filter((b) => b.active).map((b) => b.employee_id)
    );
    const ok = input.employees.filter((e) => empIdsWithBenefit.has(e.id)).length;
    const earned = total > 0 ? 5 * pct(ok, total) : 0;
    push({
      key: "dp-employee-benefits",
      label: "Colaboradores com benefícios atribuídos",
      category: "completude",
      weight: 5,
      earned,
      hint: "Atribua VT/VR/VA/Plano de Saúde a cada colaborador (ou registre opt-out).",
      ctaTab: "colaboradores",
      detail: total > 0 ? `${ok}/${total}` : "—",
    });
  }

  // 8. Documentos obrigatórios em dia (5 pts)
  {
    const total = input.employees.length;
    let ok = 0;
    for (const e of input.employees) {
      const docs = input.documents.filter((d) => d.employee_id === e.id);
      const types = new Set(docs.map((d) => d.doc_type));
      const hasAll = DOC_REQUIRED_TYPES.every((t) => types.has(t));
      if (hasAll) ok++;
    }
    const earned = total > 0 ? 5 * pct(ok, total) : 0;
    push({
      key: "dp-documents",
      label: "Documentos obrigatórios completos",
      category: "completude",
      weight: 5,
      earned,
      hint: `Mínimo: ${DOC_REQUIRED_TYPES.join(", ")}.`,
      ctaTab: "colaboradores",
      detail: total > 0 ? `${ok}/${total}` : "—",
    });
  }

  // 9. Calendário de dias úteis configurado (5 pts)
  {
    const count = input.businessDays.length;
    const earned = count > 0 ? 5 : 0;
    push({
      key: "dp-business-days",
      label: "Calendário de dias úteis configurado",
      category: "completude",
      weight: 5,
      earned,
      hint: "Pelo menos um mês de referência cadastrado.",
      ctaTab: "config",
      detail: `${count} mês(es)`,
    });
  }

  // ============== B. ATUALIZAÇÃO (25 pts) ==============

  // 1. Folha do mês anterior fechada (8 pts)
  if (targets.payroll_close_required) {
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    const run = input.payrollRuns.find((r) => {
      const rd = new Date(r.reference_month);
      const k = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, "0")}`;
      return k === prevKey;
    });
    const earned = run?.locked || run?.status === "fechada" ? 8 : 0;
    push({
      key: "dp-payroll-prev",
      label: "Folha do mês anterior fechada",
      category: "atualizacao",
      weight: 8,
      earned,
      hint: "Feche e bloqueie a folha do mês passado para garantir o histórico.",
      ctaTab: "folha",
      detail: run ? (run.locked ? "fechada e travada" : `status: ${run.status}`) : "não encontrada",
    });
  } else {
    push({
      key: "dp-payroll-prev",
      label: "Folha do mês anterior fechada",
      category: "atualizacao",
      weight: 8,
      earned: 8,
      hint: "Política da organização: fechamento de folha não exigido.",
      ctaTab: "folha",
      detail: "não exigido",
    });
  }

  // 2. Reajustes nos últimos 12 meses (5 pts)
  {
    const candidates = input.employees.filter((e) => {
      if (!e.admission_date) return false;
      const adm = new Date(e.admission_date);
      return monthsBetween(adm, today) >= 12;
    });
    const cutoff = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    let ok = 0;
    for (const e of candidates) {
      const recent = input.compensations.find(
        (c) => c.employee_id === e.id && c.type === "reajuste" && new Date(c.created_at) >= cutoff
      );
      if (recent) ok++;
    }
    const total = candidates.length;
    const earned = total > 0 ? 5 * pct(ok, total) : 5; // se não há candidatos, dá pontuação cheia
    push({
      key: "dp-raises-12m",
      label: "Reajustes salariais nos últimos 12 meses",
      category: "atualizacao",
      weight: 5,
      earned,
      hint: "Para colaboradores há mais de 12 meses, registre reajuste/dissídio.",
      ctaTab: "colaboradores",
      detail: total > 0 ? `${ok}/${total}` : "n/a",
    });
  }

  // 3. Férias planejadas (6 pts) — colaboradores com período aquisitivo > 11 meses
  {
    const candidates = input.employees.filter((e) => {
      if (!e.admission_date) return false;
      const adm = new Date(e.admission_date);
      return monthsBetween(adm, today) >= 11;
    });
    let ok = 0;
    for (const e of candidates) {
      const planned = input.vacations.find(
        (v) => v.employee_id === e.id && (v.data_inicio || v.status === "agendada" || v.status === "em_gozo" || v.status === "concluida")
      );
      if (planned) ok++;
    }
    const total = candidates.length;
    const earned = total > 0 ? 6 * pct(ok, total) : 6;
    push({
      key: "dp-vacations-planned",
      label: "Férias planejadas para quem completou 11 meses",
      category: "atualizacao",
      weight: 6,
      earned,
      hint: "Evita acúmulo e multas por período vencido.",
      ctaTab: "ferias",
      detail: total > 0 ? `${ok}/${total}` : "n/a",
    });
  }

  // 4. Documentos sem alertas vencidos (6 pts)
  {
    const expired = input.documents.filter(
      (d) => d.expires_at && new Date(d.expires_at) < today
    ).length;
    const totalWithExpiry = input.documents.filter((d) => d.expires_at).length;
    const earned = totalWithExpiry > 0 ? 6 * (1 - pct(expired, totalWithExpiry)) : 6;
    push({
      key: "dp-docs-fresh",
      label: "Documentos sem vencimentos atrasados",
      category: "atualizacao",
      weight: 6,
      earned,
      hint: "Renove ASOs, contratos e demais documentos vencidos.",
      ctaTab: "colaboradores",
      detail: expired > 0 ? `${expired} vencido(s)` : "tudo em dia",
    });
  }

  // ============== C. ROTINAS (25 pts) ==============

  // C.1 Rotinas por cargo cadastradas (10 pts) — pré-requisito estrutural
  // Cada cargo ativo deve ter ao menos uma rotina cadastrada.
  const positionsWithRoutines = new Set(
    (input.positionRoutines ?? [])
      .filter((r: any) => r.active !== false)
      .map((r: any) => r.position_id)
  );
  const totalPositions = input.positions.length;
  const positionsCovered = input.positions.filter((p: any) => positionsWithRoutines.has(p.id)).length;
  const hasAnyRoutine = positionsWithRoutines.size > 0;
  {
    let earned = 0;
    let detail = "nenhuma rotina cadastrada";
    if (totalPositions === 0) {
      // sem cargos, não dá para avaliar — pontuação zero porque é pré-requisito
      earned = 0;
      detail = "cadastre cargos primeiro";
    } else {
      earned = 10 * pct(positionsCovered, totalPositions);
      detail = `${positionsCovered}/${totalPositions} cargos com rotinas`;
    }
    push({
      key: "dp-routines-catalog",
      label: "Rotinas cadastradas por cargo",
      category: "rotinas",
      weight: 10,
      earned,
      hint: "Sem rotinas por cargo, não há como medir o cumprimento operacional do setor.",
      ctaTab: "cargos",
      detail,
    });
  }

  // C.2 Cumprimento das rotinas no mês (15 pts)
  {
    const total = input.routinesGenerated;
    const completed = input.routinesCompleted;
    const overdue = input.routinesOverdue;

    let earned = 0;
    let detail = "sem rotinas no mês";
    if (!hasAnyRoutine) {
      // sem catálogo de rotinas, não há o que cumprir — pontuação zero
      earned = 0;
      detail = "cadastre rotinas por cargo primeiro";
    } else if (total > 0) {
      const completionRate = completed / total;
      const overdueRate = overdue / total;
      const tolerated = Math.max(0, overdueRate - targets.routines_overdue_tolerance_pct);
      const overduePenalty = Math.min(0.5, tolerated * 0.5);
      const adjusted = Math.max(0, completionRate - overduePenalty);
      earned = 15 * Math.min(1, adjusted / Math.max(0.01, targets.routines_target_pct));
      detail = `${completed}/${total} concluídas${overdue > 0 ? ` • ${overdue} atrasadas` : ""}`;
    } else {
      // catálogo existe mas o mês ainda não gerou tarefas — neutro (metade)
      earned = 7.5;
      detail = "rotinas cadastradas, sem geração no mês";
    }
    push({
      key: "dp-routines",
      label: "Cumprimento de rotinas no mês",
      category: "rotinas",
      weight: 15,
      earned,
      hint: "Tarefas geradas a partir das rotinas dos cargos e atribuídas aos colaboradores.",
      ctaTab: "cargos",
      detail,
    });
  }

  // ============== Totais ==============
  const sumBy = (cat: string) =>
    items.filter((i) => i.category === cat).reduce((s, i) => s + i.earned, 0);

  const completeness = Math.round(sumBy("completude") * 100) / 100;
  const freshness = Math.round(sumBy("atualizacao") * 100) / 100;
  const routines = Math.round(sumBy("rotinas") * 100) / 100;
  const score = Math.round(completeness + freshness + routines);

  return {
    score,
    completeness,
    freshness,
    routines,
    label: maturityLabelFromScore(score),
    checklist: items,
  };
}
