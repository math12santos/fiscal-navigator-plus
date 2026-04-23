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
      { key: "aging", label: "Aging List" },
      { key: "contas-bancarias", label: "Contas Bancárias" },
      { key: "fluxo-caixa", label: "Fluxo de Caixa" },
      { key: "conciliacao", label: "Conciliação" },
    ],
  },
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
  {
    key: "tarefas",
    label: "Tarefas",
    tabs: [
      { key: "dashboard", label: "Dashboard" },
      { key: "solicitacoes", label: "Solicitações" },
      { key: "minhas-tarefas", label: "Minhas Tarefas" },
    ],
  },
  { key: "integracoes", label: "Integrações" },
  { key: "ia", label: "IA Financeira" },
  {
    key: "relatorios-out",
    label: "Distribuição de Relatórios",
    tabs: [
      { key: "dashboard", label: "Dashboard" },
      { key: "canais", label: "Canais" },
      { key: "destinatarios", label: "Destinatários" },
      { key: "agendamento", label: "Agendamento" },
      { key: "historico", label: "Histórico" },
    ],
  },
  {
    key: "cadastro",
    label: "Cadastros",
    tabs: [
      { key: "fornecedores", label: "Fornecedores" },
      { key: "clientes", label: "Clientes" },
      { key: "produtos", label: "Produtos" },
      { key: "servicos", label: "Serviços" },
    ],
  },
  { key: "configuracoes", label: "Configurações" },
];
