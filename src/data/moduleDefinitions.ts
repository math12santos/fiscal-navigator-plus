/**
 * Canonical module definitions with their tabs.
 * Used by the CC permissions form and permission resolution.
 */
export interface ModuleDefinition {
  key: string;
  label: string;
  tabs?: { key: string; label: string }[];
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { key: "dashboard", label: "Dashboard" },
  {
    key: "financeiro",
    label: "Financeiro",
    tabs: [
      { key: "pagar", label: "Contas a Pagar" },
      { key: "receber", label: "Contas a Receber" },
    ],
  },
  { key: "fluxo-caixa", label: "Fluxo de Caixa" },
  { key: "contratos", label: "Contratos" },
  {
    key: "planejamento",
    label: "Planejamento",
    tabs: [
      { key: "visao-geral", label: "Visão Geral" },
      { key: "orcamento", label: "Orçamento" },
      { key: "cenarios", label: "Cenários" },
      { key: "planejado-realizado", label: "Plan. × Real." },
      { key: "liquidez", label: "Liquidez" },
      { key: "passivos", label: "Passivos" },
      { key: "rh", label: "RH" },
      { key: "comercial", label: "Comercial" },
    ],
  },
  {
    key: "dp",
    label: "Depto. Pessoal",
    tabs: [
      { key: "dashboard", label: "Dashboard" },
      { key: "colaboradores", label: "Colaboradores" },
      { key: "folha", label: "Folha" },
      { key: "ferias", label: "Férias / 13º" },
      { key: "rescisoes", label: "Rescisões" },
      { key: "encargos", label: "Encargos" },
      { key: "cargos", label: "Cargos & Rotinas" },
      { key: "beneficios", label: "Benefícios" },
      { key: "config", label: "Configurações" },
    ],
  },
  {
    key: "crm",
    label: "CRM",
    tabs: [
      { key: "carteira", label: "Carteira" },
      { key: "pipeline", label: "Pipeline" },
      { key: "indicadores", label: "Indicadores" },
    ],
  },
  { key: "conciliacao", label: "Conciliação" },
  { key: "tarefas", label: "Tarefas" },
  { key: "integracoes", label: "Integrações" },
  { key: "ia", label: "IA Financeira" },
  { key: "configuracoes", label: "Configurações" },
];
