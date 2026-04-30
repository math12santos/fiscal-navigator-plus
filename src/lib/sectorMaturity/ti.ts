// Avaliador de maturidade do setor TI & Patrimônio.
// 100 pontos: 50 completude / 25 atualização / 25 rotinas.

import {
  ChecklistItem,
  SectorMaturityResult,
  maturityLabelFromScore,
} from "./types";
import { DEFAULT_TARGETS, SectorMaturityTargets } from "./targets";

interface EvaluateTIInput {
  targets?: SectorMaturityTargets;
  config: any | null;                  // it_config
  equipment: any[];
  systems: any[];
  telecom: any[];
  tickets: any[];
  incidents: any[];
  depreciationParams: any[];           // it_depreciation_params
  depreciationSchedule: any[];         // it_depreciation_schedule
  movements: any[];                    // it_equipment_movements
  slaPolicies: any[];
  attachments: any[];                  // it_equipment_attachments
  routinesGenerated: number;
  routinesCompleted: number;
  routinesOverdue: number;
  refDate?: Date;
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, part / total));
}

export function evaluateTI(input: EvaluateTIInput): SectorMaturityResult {
  const today = input.refDate ?? new Date();
  const targets = input.targets ?? DEFAULT_TARGETS;
  const items: ChecklistItem[] = [];
  const push = (i: ChecklistItem) => items.push({ ...i, done: i.earned >= i.weight });

  const activeEq = input.equipment.filter((e) => ["ativo", "em_uso"].includes(e.status));
  const totalEq = input.equipment.length;
  const activeSys = input.systems.filter((s) => s.status === "ativo");
  const activeTel = input.telecom.filter((t) => t.status === "ativo");

  // ============== A. COMPLETUDE (50) ==============

  // 1. Configuração TI (6)
  {
    const cfg = input.config;
    const earned = cfg ? 6 : 0;
    push({
      key: "ti-config",
      label: "Configuração de TI preenchida",
      category: "completude",
      weight: 6,
      earned,
      hint: "Política de garantia, alertas e dias úteis.",
      ctaTab: "config",
      detail: cfg ? "configurado" : "não configurado",
    });
  }

  // 2. Pelo menos 1 equipamento (4)
  push({
    key: "ti-has-eq",
    label: "Pelo menos 1 equipamento cadastrado",
    category: "completude",
    weight: 4,
    earned: totalEq > 0 ? 4 : 0,
    ctaTab: "equipamentos",
    detail: `${totalEq} equipamento(s)`,
  });

  // 3. Equipamentos com cadastro completo (8)
  {
    const ok = input.equipment.filter(
      (e) => e.patrimonial_code && Number(e.acquisition_value || 0) > 0 && e.acquisition_date
    ).length;
    const earned = totalEq > 0 ? 8 * pct(ok, totalEq) : 0;
    push({
      key: "ti-eq-complete",
      label: "Equipamentos com código, valor e data",
      category: "completude",
      weight: 8,
      earned,
      ctaTab: "equipamentos",
      detail: totalEq > 0 ? `${ok}/${totalEq}` : "—",
    });
  }

  // 4. Equipamentos ativos com responsável (8)
  {
    const ok = activeEq.filter((e) => !!e.responsible_employee_id).length;
    const total = activeEq.length;
    const earned = total > 0 ? 8 * pct(ok, total) : 0;
    push({
      key: "ti-eq-responsible",
      label: "Equipamentos ativos com responsável",
      category: "completude",
      weight: 8,
      earned,
      hint: "Vincule a um colaborador para rastreabilidade.",
      ctaTab: "equipamentos",
      detail: total > 0 ? `${ok}/${total}` : "—",
    });
  }

  // 5. Parâmetros de depreciação (6)
  {
    const eqIdsWithDepr = new Set(input.depreciationParams.map((d) => d.equipment_id));
    const ok = input.equipment.filter((e) => eqIdsWithDepr.has(e.id)).length;
    const earned = totalEq > 0 ? 6 * pct(ok, totalEq) : 0;
    push({
      key: "ti-depreciation",
      label: "Equipamentos com parâmetros de depreciação",
      category: "completude",
      weight: 6,
      earned,
      hint: "Vida útil e método contábil.",
      ctaTab: "depreciacao",
      detail: totalEq > 0 ? `${ok}/${totalEq}` : "—",
    });
  }

  // 6. Sistemas e Links cadastrados (6)
  {
    let earned = 0;
    if (activeSys.length > 0) earned += 3;
    if (activeTel.length > 0) earned += 3;
    push({
      key: "ti-sys-tel",
      label: "Sistemas e links de telecom cadastrados",
      category: "completude",
      weight: 6,
      earned,
      ctaTab: "sistemas",
      detail: `${activeSys.length} sistema(s) • ${activeTel.length} link(s)`,
    });
  }

  // 7. Políticas de SLA (6)
  {
    const prios = new Set(input.slaPolicies.map((s) => s.priority));
    const earned = prios.size >= 3 ? 6 : prios.size === 2 ? 4 : prios.size === 1 ? 2 : 0;
    push({
      key: "ti-sla",
      label: "Políticas de SLA por prioridade",
      category: "completude",
      weight: 6,
      earned,
      hint: "Defina SLA para baixa, média e alta prioridade.",
      ctaTab: "chamados",
      detail: `${prios.size} prioridade(s) cobertas`,
    });
  }

  // 8. Documentos/anexos em sistemas e links (6)
  {
    const totalSL = activeSys.length + activeTel.length;
    // Para sistemas/links, usamos contract_url como proxy de "anexado"
    const sysOk = activeSys.filter((s) => s.contract_url || s.contract_doc_url).length;
    const telOk = activeTel.filter((t) => t.contract_url || t.contract_doc_url).length;
    const ok = sysOk + telOk;
    const earned = totalSL > 0 ? 6 * pct(ok, totalSL) : 0;
    push({
      key: "ti-sl-docs",
      label: "Sistemas e links com contrato anexado",
      category: "completude",
      weight: 6,
      earned,
      ctaTab: "sistemas",
      detail: totalSL > 0 ? `${ok}/${totalSL}` : "—",
    });
  }

  // ============== B. ATUALIZAÇÃO (25) ==============

  // 1. Garantias em dia (5)
  {
    const cutoff = new Date(today.getTime() + targets.warranty_alert_days * 24 * 3600 * 1000);
    const expiringOrExpired = activeEq.filter(
      (e) => e.warranty_until && new Date(e.warranty_until) < cutoff
    ).length;
    const earned = activeEq.length > 0 ? 5 * (1 - pct(expiringOrExpired, activeEq.length)) : 5;
    push({
      key: "ti-warranty",
      label: "Garantias em dia",
      category: "atualizacao",
      weight: 5,
      earned,
      ctaTab: "equipamentos",
      detail: expiringOrExpired > 0 ? `${expiringOrExpired} vencendo/vencida(s)` : "tudo ok",
    });
  }

  // 2. Renovações sem atraso (6)
  {
    const expired = [
      ...activeSys.filter((s) => s.renewal_date && new Date(s.renewal_date) < today),
      ...activeTel.filter((t) => t.renewal_date && new Date(t.renewal_date) < today),
    ].length;
    const earned = expired === 0 ? 6 : Math.max(0, 6 - expired);
    push({
      key: "ti-renewals",
      label: "Sistemas e links sem renovações vencidas",
      category: "atualizacao",
      weight: 6,
      earned,
      ctaTab: "sistemas",
      detail: expired > 0 ? `${expired} vencida(s)` : "em dia",
    });
  }

  // 3. Depreciação calculada para o mês (5)
  {
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const hasMonth = input.depreciationSchedule.some((d) => {
      const r = d.reference_month ? String(d.reference_month).slice(0, 7) : null;
      return r === ym;
    });
    push({
      key: "ti-depr-month",
      label: "Depreciação calculada para o mês",
      category: "atualizacao",
      weight: 5,
      earned: hasMonth ? 5 : 0,
      ctaTab: "depreciacao",
      detail: hasMonth ? "calculada" : "pendente",
    });
  }

  // 4. Saldo contábil recente (4)
  {
    const cutoff = new Date(today.getTime() - 30 * 24 * 3600 * 1000);
    const recent = input.depreciationSchedule.filter((d) => {
      const u = d.updated_at || d.created_at;
      return u && new Date(u) >= cutoff;
    }).length;
    const earned = recent > 0 ? 4 : 0;
    push({
      key: "ti-acc-recent",
      label: "Saldo contábil atualizado nos últimos 30 dias",
      category: "atualizacao",
      weight: 4,
      earned,
      ctaTab: "depreciacao",
      detail: recent > 0 ? `${recent} registro(s) recente(s)` : "desatualizado",
    });
  }

  // 5. Movimentos sem pendência (5)
  {
    const pending = input.movements.filter((m) => m.status === "pendente").length;
    const earned = pending === 0 ? 5 : Math.max(0, 5 - pending);
    push({
      key: "ti-mov-pending",
      label: "Movimentos de inventário sem pendência",
      category: "atualizacao",
      weight: 5,
      earned,
      ctaTab: "equipamentos",
      detail: pending > 0 ? `${pending} pendente(s)` : "tudo confirmado",
    });
  }

  // ============== C. ROTINAS (25) ==============

  // 1. SLA dos chamados (10)
  {
    const recentTk = input.tickets;
    const total = recentTk.length;
    const inSLA = recentTk.filter(
      (t) => !t.sla_resolution_breach && !(t.sla_resolution_due && new Date(t.sla_resolution_due) < today && !["resolvido", "cancelado"].includes(t.status))
    ).length;
    const earned = total > 0 ? 10 * Math.min(1, pct(inSLA, total) / Math.max(0.01, targets.sla_target_pct)) : 10;
    push({
      key: "ti-sla-met",
      label: "Chamados dentro do SLA",
      category: "rotinas",
      weight: 10,
      earned,
      ctaTab: "chamados",
      detail: total > 0 ? `${inSLA}/${total}` : "sem chamados",
    });
  }

  // 2. Resolutividade do mês (8)
  {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const opened = input.tickets.filter((t) => new Date(t.created_at) >= monthStart);
    const resolved = opened.filter((t) => ["resolvido"].includes(t.status)).length;
    const total = opened.length;
    const earned = total > 0 ? 8 * pct(resolved, total) : 8;
    push({
      key: "ti-resolution",
      label: "Resolutividade dos chamados do mês",
      category: "rotinas",
      weight: 8,
      earned,
      ctaTab: "chamados",
      detail: total > 0 ? `${resolved}/${total}` : "sem chamados",
    });
  }

  // 3. Incidentes com tratativa (7)
  {
    const total = input.incidents.length;
    const ok = input.incidents.filter(
      (i) => (i.tratativa || "").trim() || i.status === "resolvido" || i.resolution_notes
    ).length;
    const earned = total > 0 ? 7 * pct(ok, total) : 7;
    push({
      key: "ti-incidents",
      label: "Incidentes com tratativa registrada",
      category: "rotinas",
      weight: 7,
      earned,
      ctaTab: "sinistros",
      detail: total > 0 ? `${ok}/${total}` : "sem incidentes",
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
