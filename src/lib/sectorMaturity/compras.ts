// Avaliador de maturidade do setor Compras.
// 100 pontos: 50 completude / 25 atualização / 25 rotinas.

import {
  ChecklistItem,
  SectorMaturityResult,
  maturityLabelFromScore,
} from "./types";
import { DEFAULT_TARGETS, SectorMaturityTargets } from "./targets";

interface EvaluateComprasInput {
  targets?: SectorMaturityTargets;
  settings: any | null;          // purchase_settings (singleton)
  approvalRules: any[];          // approval_rules
  suppliers: any[];              // suppliers
  requests: any[];               // purchase_requests (+items)
  approvals: any[];              // purchase_approvals
  orders: any[];                 // purchase_orders
  quotations: any[];             // purchase_quotations
  receipts: any[];               // purchase_receipts
  divergences: any[];            // purchase_divergences
  recurrences: any[];            // purchase_recurrences
  routinesGenerated: number;
  routinesCompleted: number;
  routinesOverdue: number;
  refDate?: Date;
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, part / total));
}

export function evaluateCompras(input: EvaluateComprasInput): SectorMaturityResult {
  const today = input.refDate ?? new Date();
  const targets = input.targets ?? DEFAULT_TARGETS;
  const items: ChecklistItem[] = [];
  const push = (i: ChecklistItem) => items.push({ ...i, done: i.earned >= i.weight });

  const activeSuppliers = (input.suppliers ?? []).filter(
    (s: any) => s.active !== false && s.status !== "inativo"
  );
  const activeRules = (input.approvalRules ?? []).filter((r: any) => r.active !== false);
  const activeRecurrences = (input.recurrences ?? []).filter((r: any) => r.active !== false);

  // ============== A. COMPLETUDE (50) ==============

  // 1. Configurações preenchidas (6)
  {
    const cfg = input.settings;
    const earned = cfg ? 6 : 0;
    push({
      key: "comp-config",
      label: "Configurações de Compras preenchidas",
      category: "completude",
      weight: 6,
      earned,
      hint: "SLA de aprovação, alçadas e fluxos padrão.",
      ctaTab: "config",
      detail: cfg ? "configurado" : "não configurado",
    });
  }

  // 2. Regras de aprovação ativas (8)
  {
    const earned = activeRules.length >= 3 ? 8 : activeRules.length === 2 ? 6 : activeRules.length === 1 ? 4 : 0;
    push({
      key: "comp-rules",
      label: "Regras de aprovação por alçada",
      category: "completude",
      weight: 8,
      earned,
      hint: "Defina ao menos 3 faixas (operacional, gerencial, diretoria).",
      ctaTab: "regras",
      detail: `${activeRules.length} regra(s) ativa(s)`,
    });
  }

  // 3. Fornecedores cadastrados (4)
  push({
    key: "comp-suppliers-min",
    label: "Pelo menos 1 fornecedor cadastrado",
    category: "completude",
    weight: 4,
    earned: activeSuppliers.length > 0 ? 4 : 0,
    ctaTab: "fornecedores",
    detail: `${activeSuppliers.length} ativo(s)`,
  });

  // 4. Fornecedores com identificação completa (8)
  {
    const total = activeSuppliers.length;
    const ok = activeSuppliers.filter(
      (s: any) => (s.cnpj || s.cpf) && (s.razao_social || s.nome) && (s.email || s.telefone)
    ).length;
    const earned = total > 0 ? 8 * pct(ok, total) : 0;
    push({
      key: "comp-suppliers-complete",
      label: "Fornecedores com documento, razão social e contato",
      category: "completude",
      weight: 8,
      earned,
      ctaTab: "fornecedores",
      detail: total > 0 ? `${ok}/${total}` : "—",
    });
  }

  // 5. SCs com itens e centro de custo (10)
  {
    const total = input.requests.length;
    const ok = input.requests.filter((r: any) => {
      const hasItems = Array.isArray(r.items) ? r.items.length > 0 : false;
      return hasItems && (r.cost_center_id || r.centro_custo_id);
    }).length;
    const earned = total > 0 ? 10 * pct(ok, total) : 0;
    push({
      key: "comp-requests-complete",
      label: "Solicitações com itens e centro de custo",
      category: "completude",
      weight: 10,
      earned,
      ctaTab: "solicitacoes",
      detail: total > 0 ? `${ok}/${total}` : "sem solicitações",
    });
  }

  // 6. Cotações nas SCs aprovadas (8)
  {
    const approved = input.requests.filter((r: any) =>
      ["aprovada", "em_cotacao", "em_pedido", "finalizada"].includes(r.status)
    );
    const total = approved.length;
    const quotedIds = new Set(input.quotations.map((q: any) => q.request_id ?? q.purchase_request_id));
    const ok = approved.filter((r: any) => quotedIds.has(r.id)).length;
    const earned = total > 0 ? 8 * pct(ok, total) : 0;
    push({
      key: "comp-quotations",
      label: "SCs aprovadas com cotação registrada",
      category: "completude",
      weight: 8,
      earned,
      hint: "Mínimo 1 cotação por solicitação aprovada.",
      ctaTab: "cotacoes",
      detail: total > 0 ? `${ok}/${total}` : "—",
    });
  }

  // 7. Recorrências cadastradas (6)
  {
    const earned = activeRecurrences.length > 0 ? 6 : 0;
    push({
      key: "comp-recurrences",
      label: "Compras recorrentes cadastradas",
      category: "completude",
      weight: 6,
      earned,
      hint: "Antecipa geração automática de SCs.",
      ctaTab: "recorrencias",
      detail: `${activeRecurrences.length} recorrência(s)`,
    });
  }

  // ============== B. ATUALIZAÇÃO (25) ==============

  // 1. SCs pendentes sem atraso (8)
  {
    const pending = input.requests.filter((r: any) =>
      ["rascunho", "em_aprovacao", "aguardando_aprovacao"].includes(r.status)
    );
    const stale = pending.filter(
      (r: any) => r.created_at && (today.getTime() - new Date(r.created_at).getTime()) / 86400000 > 7
    ).length;
    const earned = pending.length === 0 ? 8 : 8 * (1 - pct(stale, pending.length));
    push({
      key: "comp-stale-requests",
      label: "Solicitações pendentes sem atraso",
      category: "atualizacao",
      weight: 8,
      earned,
      ctaTab: "solicitacoes",
      detail: stale > 0 ? `${stale} parada(s) há +7 dias` : "tudo em dia",
    });
  }

  // 2. Pedidos abertos sem atraso de entrega (9)
  {
    const open = input.orders.filter((o: any) =>
      !["recebido", "concluido", "cancelado"].includes(o.status)
    );
    const late = open.filter(
      (o: any) => o.data_entrega_prevista && new Date(o.data_entrega_prevista) < today
    ).length;
    const earned = open.length === 0 ? 9 : 9 * (1 - pct(late, open.length));
    push({
      key: "comp-late-orders",
      label: "Pedidos abertos sem entrega atrasada",
      category: "atualizacao",
      weight: 9,
      earned,
      ctaTab: "pedidos",
      detail: late > 0 ? `${late} atrasado(s)` : "em dia",
    });
  }

  // 3. Recebimentos sem divergência aberta (8)
  {
    const open = input.divergences.filter(
      (d: any) => !["resolvida", "fechada", "aceita"].includes(d.status)
    ).length;
    const earned = open === 0 ? 8 : Math.max(0, 8 - open);
    push({
      key: "comp-open-divergences",
      label: "Recebimentos sem divergência aberta",
      category: "atualizacao",
      weight: 8,
      earned,
      ctaTab: "recebimentos",
      detail: open > 0 ? `${open} divergência(s) aberta(s)` : "tudo conciliado",
    });
  }

  // ============== C. ROTINAS (25) ==============

  // 1. Cumprimento das rotinas do mês (10)
  {
    const target = targets.routines_target_pct;
    const ratio = input.routinesGenerated > 0
      ? input.routinesCompleted / input.routinesGenerated
      : 1;
    const earned = 10 * Math.min(1, ratio / Math.max(0.01, target));
    push({
      key: "comp-routines",
      label: "Rotinas de Compras do mês cumpridas",
      category: "rotinas",
      weight: 10,
      earned,
      ctaTab: "rotinas",
      detail: input.routinesGenerated > 0
        ? `${input.routinesCompleted}/${input.routinesGenerated}`
        : "sem rotinas geradas",
    });
  }

  // 2. Aprovações dentro do SLA (8)
  {
    const recent = input.approvals.filter((a: any) => a.requested_at || a.created_at);
    const total = recent.length;
    const onTime = recent.filter((a: any) => {
      if (a.decided_at && a.due_at) return new Date(a.decided_at) <= new Date(a.due_at);
      if (a.status === "pendente" && a.due_at) return new Date(a.due_at) >= today;
      return a.status === "aprovada" || a.status === "rejeitada";
    }).length;
    const earned = total > 0 ? 8 * pct(onTime, total) : 8;
    push({
      key: "comp-approvals-sla",
      label: "Aprovações dentro do SLA",
      category: "rotinas",
      weight: 8,
      earned,
      ctaTab: "aprovacoes",
      detail: total > 0 ? `${onTime}/${total}` : "sem aprovações",
    });
  }

  // 3. Recebimentos conciliados com pedidos (7)
  {
    const receivedOrders = input.orders.filter((o: any) =>
      ["recebido", "concluido"].includes(o.status)
    );
    const total = receivedOrders.length;
    const receiptOrderIds = new Set(input.receipts.map((r: any) => r.order_id ?? r.purchase_order_id));
    const ok = receivedOrders.filter((o: any) => receiptOrderIds.has(o.id)).length;
    const earned = total > 0 ? 7 * pct(ok, total) : 7;
    push({
      key: "comp-receipts-matched",
      label: "Pedidos recebidos com recebimento registrado",
      category: "rotinas",
      weight: 7,
      earned,
      ctaTab: "recebimentos",
      detail: total > 0 ? `${ok}/${total}` : "—",
    });
  }

  // ============== Totais ==============
  const completeness = items.filter((i) => i.category === "completude").reduce((s, i) => s + i.earned, 0);
  const freshness = items.filter((i) => i.category === "atualizacao").reduce((s, i) => s + i.earned, 0);
  const routines = items.filter((i) => i.category === "rotinas").reduce((s, i) => s + i.earned, 0);
  const score = Math.round(completeness + freshness + routines);

  return {
    score,
    completeness: Math.round(completeness * 10) / 10,
    freshness: Math.round(freshness * 10) / 10,
    routines: Math.round(routines * 10) / 10,
    label: maturityLabelFromScore(score),
    checklist: items,
  };
}
