// Avaliador de maturidade do setor Jurídico.
// 100 pontos: 50 completude / 25 atualização / 25 rotinas.

import {
  ChecklistItem,
  SectorMaturityResult,
  maturityLabelFromScore,
} from "./types";
import { DEFAULT_TARGETS, SectorMaturityTargets } from "./targets";

interface EvaluateJuridicoInput {
  targets?: SectorMaturityTargets;
  config: any | null;                  // juridico_config
  processes: any[];                    // juridico_processes
  movements: any[];                    // juridico_movements
  settlements: any[];                  // juridico_settlements
  installments: any[];                 // juridico_settlement_installments
  documents: any[];                    // juridico_documents
  expenses: any[];                     // juridico_expenses
  routinesGenerated: number;
  routinesCompleted: number;
  routinesOverdue: number;
  cashflowJurMonth: number;            // contagem de cashflow_entries com source='juridico' no mês
  refDate?: Date;
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, part / total));
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function evaluateJuridico(input: EvaluateJuridicoInput): SectorMaturityResult {
  const today = input.refDate ?? new Date();
  const targets = input.targets ?? DEFAULT_TARGETS;
  const items: ChecklistItem[] = [];
  const push = (i: ChecklistItem) => items.push({ ...i, done: i.earned >= i.weight });

  const activeProcesses = input.processes.filter((p) => p.status === "ativo");
  const totalProcesses = input.processes.length;

  // ============== A. COMPLETUDE (50) ==============

  // 1. Configuração jurídica preenchida (8)
  {
    const cfg = input.config;
    const required = ["responsavel_nome", "escritorio_padrao", "politica_provisao"];
    const filled = cfg ? required.filter((f) => cfg[f] && String(cfg[f]).trim()).length : 0;
    const earned = 8 * pct(filled, required.length);
    push({
      key: "jur-config",
      label: "Configuração jurídica preenchida",
      category: "completude",
      weight: 8,
      earned,
      hint: "Responsável, escritório padrão e política de provisão.",
      ctaTab: "config",
      detail: `${filled}/${required.length} campos`,
    });
  }

  // 2. Pelo menos 1 processo cadastrado (4)
  push({
    key: "jur-has-process",
    label: "Pelo menos 1 processo cadastrado",
    category: "completude",
    weight: 4,
    earned: totalProcesses > 0 ? 4 : 0,
    ctaTab: "processos",
    detail: `${totalProcesses} processo(s)`,
  });

  // 3. Identificação completa (CNJ + parte + valor) (8)
  {
    const ok = input.processes.filter(
      (p) => (p.numero_cnj || p.numero_interno) && p.parte_contraria && Number(p.valor_causa || 0) > 0
    ).length;
    const earned = totalProcesses > 0 ? 8 * pct(ok, totalProcesses) : 0;
    push({
      key: "jur-process-id",
      label: "Processos com identificação completa",
      category: "completude",
      weight: 8,
      earned,
      hint: "Nº CNJ (ou interno), parte contrária e valor de causa.",
      ctaTab: "processos",
      detail: totalProcesses > 0 ? `${ok}/${totalProcesses}` : "—",
    });
  }

  // 4. Probabilidade definida (8)
  {
    const ok = input.processes.filter((p) =>
      ["provavel", "possivel", "remota"].includes(p.probabilidade)
    ).length;
    const earned = totalProcesses > 0 ? 8 * pct(ok, totalProcesses) : 0;
    push({
      key: "jur-probability",
      label: "Probabilidade de perda classificada",
      category: "completude",
      weight: 8,
      earned,
      hint: "Provável / Possível / Remota — base para provisão contábil.",
      ctaTab: "processos",
      detail: totalProcesses > 0 ? `${ok}/${totalProcesses}` : "—",
    });
  }

  // 5. Provisão coerente (6)
  {
    const candidates = input.processes.filter((p) => p.probabilidade === "provavel");
    if (!targets.provision_required_for_provavel) {
      push({
        key: "jur-provision",
        label: "Provisão coerente com a probabilidade",
        category: "completude",
        weight: 6,
        earned: 6,
        hint: "Política da organização: provisão não exigida.",
        detail: "não exigido",
      });
    } else {
      const ok = candidates.filter((p) => Number(p.valor_provisionado || 0) > 0).length;
      const total = candidates.length;
      const earned = total > 0 ? 6 * pct(ok, total) : 6;
      push({
        key: "jur-provision",
        label: "Provisão coerente com a probabilidade",
        category: "completude",
        weight: 6,
        earned,
        hint: "Processos prováveis devem ter valor provisionado.",
        ctaTab: "processos",
        detail: total > 0 ? `${ok}/${total} prováveis com provisão` : "n/a",
      });
    }
  }

  // 6. Responsável atribuído (6)
  {
    const ok = input.processes.filter(
      (p) => (p.advogado_responsavel || "").trim() || (p.escritorio || "").trim()
    ).length;
    const earned = totalProcesses > 0 ? 6 * pct(ok, totalProcesses) : 0;
    push({
      key: "jur-lawyer",
      label: "Advogado/escritório responsável",
      category: "completude",
      weight: 6,
      earned,
      ctaTab: "processos",
      detail: totalProcesses > 0 ? `${ok}/${totalProcesses}` : "—",
    });
  }

  // 7. Documentos anexados (6)
  {
    const total = activeProcesses.length;
    const procIdsWithDocs = new Set(input.documents.map((d) => d.process_id));
    const ok = activeProcesses.filter((p) => procIdsWithDocs.has(p.id)).length;
    const earned = total > 0 ? 6 * pct(ok, total) : 0;
    push({
      key: "jur-docs",
      label: "Processos ativos com documentos",
      category: "completude",
      weight: 6,
      earned,
      hint: "Petição, sentença, comprovantes — anexe ao processo.",
      ctaTab: "processos",
      detail: total > 0 ? `${ok}/${total}` : "—",
    });
  }

  // 8. Categorias de despesa (4)
  {
    const cats = new Set(input.expenses.map((e) => e.categoria).filter(Boolean));
    const earned = cats.size >= 2 ? 4 : cats.size === 1 ? 2 : 0;
    push({
      key: "jur-expense-cats",
      label: "Categorias de despesa jurídica usadas",
      category: "completude",
      weight: 4,
      earned,
      hint: "Honorários, custas, perícia… categorize para análise.",
      ctaTab: "despesas",
      detail: `${cats.size} categoria(s)`,
    });
  }

  // ============== B. ATUALIZAÇÃO (25) ==============

  // 1. Movimento recente em processos ativos (10)
  {
    const total = activeProcesses.length;
    const cutoff = new Date(today.getTime() - targets.movement_freshness_days * 24 * 3600 * 1000);
    const lastMovByProc = new Map<string, Date>();
    for (const m of input.movements) {
      const d = new Date(m.data_movimento || m.created_at);
      const cur = lastMovByProc.get(m.process_id);
      if (!cur || d > cur) lastMovByProc.set(m.process_id, d);
    }
    const ok = activeProcesses.filter((p) => {
      const d = lastMovByProc.get(p.id);
      return d && d >= cutoff;
    }).length;
    const earned = total > 0 ? 10 * pct(ok, total) : 10;
    push({
      key: "jur-mov-fresh",
      label: `Movimento nos últimos ${targets.movement_freshness_days} dias`,
      category: "atualizacao",
      weight: 10,
      earned,
      ctaTab: "processos",
      detail: total > 0 ? `${ok}/${total} ativos atualizados` : "n/a",
    });
  }

  // 2. Audiências sem atraso (5)
  {
    const audPast = activeProcesses.filter(
      (p) => p.data_proxima_audiencia && new Date(p.data_proxima_audiencia) < today
    );
    const earned = audPast.length === 0 ? 5 : Math.max(0, 5 - audPast.length);
    push({
      key: "jur-audiences",
      label: "Audiências sem datas vencidas",
      category: "atualizacao",
      weight: 5,
      earned,
      hint: "Atualize a próxima audiência após cada movimento.",
      ctaTab: "processos",
      detail: audPast.length > 0 ? `${audPast.length} vencida(s)` : "tudo em dia",
    });
  }

  // 3. Parcelas de acordos em dia (5)
  {
    const overdue = input.installments.filter(
      (i) =>
        i.status !== "paga" &&
        i.status !== "cancelada" &&
        i.data_vencimento &&
        new Date(i.data_vencimento) < today
    ).length;
    const total = input.installments.length;
    const earned = total > 0 ? 5 * (1 - pct(overdue, total)) : 5;
    push({
      key: "jur-installments",
      label: "Parcelas de acordos em dia",
      category: "atualizacao",
      weight: 5,
      earned,
      ctaTab: "acordos",
      detail: total > 0 ? (overdue > 0 ? `${overdue} atrasada(s)` : "em dia") : "sem acordos",
    });
  }

  // 4. Provisão revisada (5)
  {
    const cutoff = new Date(today.getTime() - 30 * 24 * 3600 * 1000);
    const total = activeProcesses.length;
    const ok = activeProcesses.filter((p) => {
      const u = p.updated_at ? new Date(p.updated_at) : null;
      return u && u >= cutoff;
    }).length;
    const earned = total > 0 ? 5 * pct(ok, total) : 5;
    push({
      key: "jur-provision-fresh",
      label: "Provisão revisada nos últimos 30 dias",
      category: "atualizacao",
      weight: 5,
      earned,
      ctaTab: "processos",
      detail: total > 0 ? `${ok}/${total}` : "n/a",
    });
  }

  // ============== C. ROTINAS (25) ==============

  // 1. Cumprimento de rotinas (15)
  {
    const total = input.routinesGenerated;
    const completed = input.routinesCompleted;
    const overdue = input.routinesOverdue;
    let earned = 0;
    let detail = "sem rotinas no mês";
    if (total > 0) {
      const completionRate = completed / total;
      const overdueRate = overdue / total;
      const tolerated = Math.max(0, overdueRate - targets.routines_overdue_tolerance_pct);
      const overduePenalty = Math.min(0.5, tolerated * 0.5);
      const adjusted = Math.max(0, completionRate - overduePenalty);
      earned = 15 * Math.min(1, adjusted / Math.max(0.01, targets.routines_target_pct));
      detail = `${completed}/${total} concluídas${overdue > 0 ? ` • ${overdue} atrasadas` : ""}`;
    }
    push({
      key: "jur-routines",
      label: "Cumprimento de rotinas no mês",
      category: "rotinas",
      weight: 15,
      earned,
      hint: "Tarefas do tipo rotina_juridico no módulo de Tarefas.",
      ctaTab: "processos",
      detail,
    });
  }

  // 2. Reconciliação financeira de despesas (10)
  {
    const totalExp = input.expenses.filter((e) => {
      if (!e.data_despesa) return false;
      const d = new Date(e.data_despesa);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).length;
    const linked = input.cashflowJurMonth;
    let earned = 0;
    let detail = "sem despesas no mês";
    if (totalExp > 0) {
      earned = 10 * Math.min(1, linked / totalExp);
      detail = `${linked}/${totalExp} despesas no fluxo`;
    } else {
      earned = 10;
    }
    push({
      key: "jur-cashflow-link",
      label: "Despesas conciliadas com o fluxo de caixa",
      category: "rotinas",
      weight: 10,
      earned,
      hint: "Despesa jurídica deve gerar lançamento em cashflow_entries.",
      ctaTab: "despesas",
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
