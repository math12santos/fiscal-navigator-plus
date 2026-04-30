/**
 * Registro central declarativo dos KPIs do Dashboard Financeiro.
 * Cada KPI declara seção, fórmula resumida, capacidades de dados (`requires`)
 * e CTA padrão para quando o dado falta.
 */

export type KpiSection =
  | "receita"
  | "lucratividade"
  | "caixa"
  | "ar"
  | "ap"
  | "eficiencia"
  | "comercial";

export type KpiFormat = "currency" | "percent" | "days" | "ratio" | "number";

/**
 * Capacidades de dados que um KPI pode requerer.
 * O hook `useFinancialDashboardKPIs` calcula um snapshot de quais estão
 * presentes na organização atual; o tile apenas consulta.
 */
export type DataCapability =
  | "entradas_realizadas"
  | "saidas_realizadas"
  | "historico_2_meses"
  | "tributos_classificados"
  | "cmv_classificado"
  | "opex_classificada"
  | "depreciacao_registrada"
  | "juros_classificados"
  | "ir_classificado"
  | "contratos_recorrentes"
  | "saldo_bancario"
  | "contas_a_pagar"
  | "contas_a_receber"
  | "passivos_registrados"
  | "passivos_onerosos"
  | "headcount"
  | "crm_clientes"
  | "crm_pipeline"
  | "ticket_medio";

export interface KpiCta {
  label: string;
  route: string;
}

export interface KpiDefinition {
  id: string;
  section: KpiSection;
  label: string;
  description: string;
  formula: string;
  format: KpiFormat;
  requires: DataCapability[];
  cta: KpiCta;
  /** Vir desligado por padrão quando provavelmente uma PME não tem dados. */
  defaultEnabled?: boolean;
  /** "Menor é melhor" para colorir o delta. */
  lowerIsBetter?: boolean;
}

export const SECTION_META: Record<KpiSection, { title: string; subtitle: string }> = {
  receita: {
    title: "Receita e Crescimento",
    subtitle: "Volume de vendas, recorrência e expansão de top-line",
  },
  lucratividade: {
    title: "Lucratividade",
    subtitle: "Margens em cada nível da DRE",
  },
  caixa: {
    title: "Caixa e Liquidez",
    subtitle: "Disponibilidade, queima e capacidade de honrar compromissos",
  },
  ar: {
    title: "Contas a Receber e Cobrança",
    subtitle: "Velocidade e qualidade da entrada de caixa",
  },
  ap: {
    title: "Contas a Pagar e Endividamento",
    subtitle: "Prazos, alavancagem e custo da dívida",
  },
  eficiencia: {
    title: "Eficiência Operacional",
    subtitle: "Produtividade e estrutura de custos",
  },
  comercial: {
    title: "Indicadores Comerciais Financeiros",
    subtitle: "Qualidade econômica da aquisição e retenção de clientes",
  },
};

export const KPI_REGISTRY: KpiDefinition[] = [
  // 1. Receita
  {
    id: "receita_bruta",
    section: "receita",
    label: "Faturamento (Receita Bruta)",
    description: "Total de entradas realizadas no período selecionado.",
    formula: "Σ entradas (status = recebido)",
    format: "currency",
    requires: ["entradas_realizadas"],
    cta: { label: "Registrar recebimentos", route: "/financeiro?tab=receber" },
  },
  {
    id: "receita_liquida",
    section: "receita",
    label: "Receita Líquida",
    description: "Receita Bruta menos tributos sobre vendas.",
    formula: "Receita Bruta − tributos s/ vendas",
    format: "currency",
    requires: ["entradas_realizadas", "tributos_classificados"],
    cta: { label: "Configurar tributos", route: "/configuracoes?tab=aglutinacao" },
  },
  {
    id: "crescimento_receita",
    section: "receita",
    label: "Crescimento da Receita",
    description: "Variação percentual da receita do mês atual vs. mês anterior.",
    formula: "(Receita N − N-1) / N-1",
    format: "percent",
    requires: ["entradas_realizadas", "historico_2_meses"],
    cta: { label: "Importar histórico", route: "/financeiro?tab=importacoes" },
  },
  {
    id: "ticket_medio",
    section: "receita",
    label: "Ticket Médio",
    description: "Valor médio por transação de receita.",
    formula: "Receita Bruta / nº de transações",
    format: "currency",
    requires: ["entradas_realizadas"],
    cta: { label: "Registrar recebimentos", route: "/financeiro?tab=receber" },
  },
  {
    id: "mrr",
    section: "receita",
    label: "MRR — Receita Recorrente Mensal",
    description: "Soma de contratos ativos recorrentes normalizados por mês.",
    formula: "Σ contratos ativos /mês equivalente",
    format: "currency",
    requires: ["contratos_recorrentes"],
    cta: { label: "Cadastrar contratos", route: "/contratos" },
  },
  {
    id: "arr",
    section: "receita",
    label: "ARR — Receita Recorrente Anual",
    description: "MRR projetado para 12 meses.",
    formula: "MRR × 12",
    format: "currency",
    requires: ["contratos_recorrentes"],
    cta: { label: "Cadastrar contratos", route: "/contratos" },
  },

  // 2. Lucratividade
  {
    id: "lucro_bruto",
    section: "lucratividade",
    label: "Lucro Bruto",
    description: "Receita Líquida menos Custo das Mercadorias/Serviços Vendidos.",
    formula: "Receita Líquida − CMV",
    format: "currency",
    requires: ["entradas_realizadas", "cmv_classificado"],
    cta: { label: "Classificar CMV", route: "/configuracoes?tab=plano-contas" },
  },
  {
    id: "margem_bruta",
    section: "lucratividade",
    label: "Margem Bruta",
    description: "Lucro Bruto sobre Receita Líquida.",
    formula: "Lucro Bruto / Receita Líquida",
    format: "percent",
    requires: ["entradas_realizadas", "cmv_classificado"],
    cta: { label: "Classificar CMV", route: "/configuracoes?tab=plano-contas" },
  },
  {
    id: "margem_operacional",
    section: "lucratividade",
    label: "Margem Operacional",
    description: "Resultado operacional sobre Receita Líquida.",
    formula: "(Receita Líq − CMV − OPEX) / Receita Líq",
    format: "percent",
    requires: ["entradas_realizadas", "cmv_classificado", "opex_classificada"],
    cta: { label: "Classificar OPEX", route: "/configuracoes?tab=plano-contas" },
  },
  {
    id: "ebitda",
    section: "lucratividade",
    label: "EBITDA",
    description: "Lucro antes de juros, impostos, depreciação e amortização.",
    formula: "Op. + Depreciação + Amortização",
    format: "currency",
    requires: ["opex_classificada", "depreciacao_registrada"],
    cta: { label: "Cadastrar depreciação", route: "/configuracoes?tab=plano-contas" },
  },
  {
    id: "margem_ebitda",
    section: "lucratividade",
    label: "Margem EBITDA",
    description: "EBITDA sobre Receita Líquida.",
    formula: "EBITDA / Receita Líquida",
    format: "percent",
    requires: ["entradas_realizadas", "depreciacao_registrada"],
    cta: { label: "Cadastrar depreciação", route: "/configuracoes?tab=plano-contas" },
  },
  {
    id: "margem_liquida",
    section: "lucratividade",
    label: "Margem Líquida",
    description: "Resultado líquido após juros e impostos sobre Receita Líquida.",
    formula: "(Op. − Juros − IR) / Receita Líquida",
    format: "percent",
    requires: ["entradas_realizadas", "juros_classificados", "ir_classificado"],
    cta: { label: "Classificar juros e IR", route: "/configuracoes?tab=plano-contas" },
  },

  // 3. Caixa
  {
    id: "saldo_caixa",
    section: "caixa",
    label: "Saldo de Caixa",
    description: "Soma do saldo atual de todas as contas bancárias ativas.",
    formula: "Σ saldo_atual (contas ativas)",
    format: "currency",
    requires: ["saldo_bancario"],
    cta: { label: "Cadastrar contas bancárias", route: "/financeiro?tab=contas-bancarias" },
  },
  {
    id: "fluxo_caixa_operacional",
    section: "caixa",
    label: "Fluxo de Caixa Operacional",
    description: "Recebimentos operacionais menos pagamentos operacionais no período.",
    formula: "Recebimentos op. − Pagamentos op.",
    format: "currency",
    requires: ["entradas_realizadas", "saidas_realizadas"],
    cta: { label: "Ver fluxo de caixa", route: "/financeiro?tab=fluxo-caixa" },
  },
  {
    id: "burn_rate",
    section: "caixa",
    label: "Burn Rate",
    description: "Saídas médias mensais no período (queima de caixa).",
    formula: "Σ saídas / nº meses",
    format: "currency",
    requires: ["saidas_realizadas"],
    cta: { label: "Registrar pagamentos", route: "/financeiro?tab=pagar" },
    lowerIsBetter: true,
  },
  {
    id: "runway",
    section: "caixa",
    label: "Runway",
    description: "Meses de sobrevida ao burn atual.",
    formula: "Saldo de Caixa / Burn Rate",
    format: "number",
    requires: ["saldo_bancario", "saidas_realizadas"],
    cta: { label: "Cadastrar contas bancárias", route: "/financeiro?tab=contas-bancarias" },
  },
  {
    id: "capital_giro",
    section: "caixa",
    label: "Capital de Giro Necessário",
    description: "Valor mínimo de caixa para sustentar o ciclo operacional.",
    formula: "(PMR − PMP) × custo diário operacional",
    format: "currency",
    requires: ["entradas_realizadas", "saidas_realizadas"],
    cta: { label: "Registrar movimentações", route: "/financeiro?tab=pagar" },
  },
  {
    id: "liquidez_corrente",
    section: "caixa",
    label: "Liquidez Corrente",
    description: "Capacidade de honrar passivos circulantes com ativos circulantes.",
    formula: "Ativos circulantes / Passivos circulantes",
    format: "ratio",
    requires: ["saldo_bancario", "contas_a_receber", "passivos_registrados"],
    cta: { label: "Cadastrar passivos", route: "/planejamento" },
  },

  // 4. AR
  {
    id: "pmr",
    section: "ar",
    label: "PMR — Prazo Médio de Recebimento",
    description: "Dias médios entre o fim da competência e o recebimento.",
    formula: "Σ (dias × valor) / Σ valor",
    format: "days",
    requires: ["entradas_realizadas"],
    cta: { label: "Registrar recebimentos", route: "/financeiro?tab=receber" },
    lowerIsBetter: true,
  },
  {
    id: "inadimplencia_abc",
    section: "ar",
    label: "Inadimplência (Curva ABC)",
    description: "Distribuição de recebíveis vencidos por faixa de atraso.",
    formula: "Buckets: 0–30, 31–60, 61–90 dias",
    format: "currency",
    requires: ["contas_a_receber"],
    cta: { label: "Ver Aging List", route: "/financeiro?tab=aging" },
    lowerIsBetter: true,
  },
  {
    id: "aging_recebiveis",
    section: "ar",
    label: "Aging de Recebíveis",
    description: "Total a receber em aberto, separado por faixa.",
    formula: "Σ a receber por bucket",
    format: "currency",
    requires: ["contas_a_receber"],
    cta: { label: "Ver Aging List", route: "/financeiro?tab=aging" },
  },
  {
    id: "dso",
    section: "ar",
    label: "DSO — Days Sales Outstanding",
    description: "Dias médios de vendas em aberto.",
    formula: "(Recebíveis / Receita) × dias do período",
    format: "days",
    requires: ["entradas_realizadas", "contas_a_receber"],
    cta: { label: "Registrar recebimentos", route: "/financeiro?tab=receber" },
    lowerIsBetter: true,
  },
  {
    id: "taxa_recuperacao",
    section: "ar",
    label: "Taxa de Recuperação de Cobrança",
    description: "Percentual de recebíveis vencidos que foram recuperados.",
    formula: "Recebido em atraso / Total vencido",
    format: "percent",
    requires: ["contas_a_receber"],
    cta: { label: "Ver Aging List", route: "/financeiro?tab=aging" },
  },
  {
    id: "concentracao_recebiveis",
    section: "ar",
    label: "Concentração de Recebíveis",
    description: "Percentual concentrado nos 5 maiores clientes.",
    formula: "Top 5 / Total a receber",
    format: "percent",
    requires: ["contas_a_receber"],
    cta: { label: "Ver Aging List", route: "/financeiro?tab=aging" },
    lowerIsBetter: true,
  },

  // 5. AP
  {
    id: "pmp",
    section: "ap",
    label: "PMP — Prazo Médio de Pagamento",
    description: "Dias médios entre competência e pagamento.",
    formula: "Σ (dias × valor) / Σ valor",
    format: "days",
    requires: ["saidas_realizadas"],
    cta: { label: "Registrar pagamentos", route: "/financeiro?tab=pagar" },
  },
  {
    id: "endividamento_geral",
    section: "ap",
    label: "Endividamento Geral",
    description: "Percentual do passivo sobre o ativo total.",
    formula: "Passivos / (Caixa + Recebíveis + Passivos)",
    format: "percent",
    requires: ["passivos_registrados", "saldo_bancario"],
    cta: { label: "Cadastrar passivos", route: "/planejamento" },
    lowerIsBetter: true,
  },
  {
    id: "divida_liquida",
    section: "ap",
    label: "Dívida Líquida",
    description: "Passivos onerosos menos caixa e equivalentes.",
    formula: "Passivos onerosos − Caixa",
    format: "currency",
    requires: ["passivos_onerosos", "saldo_bancario"],
    cta: { label: "Cadastrar passivos onerosos", route: "/planejamento" },
    lowerIsBetter: true,
  },
  {
    id: "divida_ebitda",
    section: "ap",
    label: "Dívida Líquida / EBITDA",
    description: "Anos necessários para quitar a dívida com o EBITDA atual.",
    formula: "Dívida Líquida / EBITDA anualizado",
    format: "ratio",
    requires: ["passivos_onerosos", "depreciacao_registrada"],
    cta: { label: "Configurar dívidas e EBITDA", route: "/planejamento" },
    lowerIsBetter: true,
  },
  {
    id: "cobertura_juros",
    section: "ap",
    label: "Cobertura de Juros",
    description: "Quantas vezes o EBITDA cobre os juros do período.",
    formula: "EBITDA / Juros pagos",
    format: "ratio",
    requires: ["juros_classificados", "depreciacao_registrada"],
    cta: { label: "Classificar juros", route: "/configuracoes?tab=plano-contas" },
  },
  {
    id: "custo_divida",
    section: "ap",
    label: "Custo da Dívida (ponderado)",
    description: "Taxa média ponderada das dívidas (fiscal, clientes, bancos).",
    formula: "Σ (saldo × taxa) / Σ saldo",
    format: "percent",
    requires: ["passivos_onerosos"],
    cta: { label: "Cadastrar taxas de juros", route: "/planejamento" },
    lowerIsBetter: true,
  },

  // 6. Eficiência
  {
    id: "opex_receita",
    section: "eficiencia",
    label: "OPEX / Receita",
    description: "Quanto da receita é consumido por despesas operacionais.",
    formula: "OPEX / Receita Bruta",
    format: "percent",
    requires: ["entradas_realizadas", "opex_classificada"],
    cta: { label: "Classificar OPEX", route: "/configuracoes?tab=plano-contas" },
    lowerIsBetter: true,
  },
  {
    id: "custo_fixo_mensal",
    section: "eficiencia",
    label: "Custo Fixo Mensal",
    description: "Despesas recorrentes mensais (média do período).",
    formula: "Σ saídas recorrentes / nº meses",
    format: "currency",
    requires: ["saidas_realizadas"],
    cta: { label: "Cadastrar contratos de OPEX", route: "/contratos" },
    lowerIsBetter: true,
  },
  {
    id: "ponto_equilibrio",
    section: "eficiencia",
    label: "Ponto de Equilíbrio",
    description: "Receita necessária para cobrir custos fixos.",
    formula: "Custo Fixo / Margem de Contribuição %",
    format: "currency",
    requires: ["entradas_realizadas", "cmv_classificado"],
    cta: { label: "Classificar CMV", route: "/configuracoes?tab=plano-contas" },
  },
  {
    id: "produtividade_colab",
    section: "eficiencia",
    label: "Produtividade por Colaborador",
    description: "Receita gerada por cada colaborador ativo.",
    formula: "Receita / headcount",
    format: "currency",
    requires: ["entradas_realizadas", "headcount"],
    cta: { label: "Cadastrar colaboradores", route: "/dp" },
  },
  {
    id: "custo_por_cliente",
    section: "eficiencia",
    label: "Custo por Cliente Atendido",
    description: "OPEX dividido pela base ativa de clientes.",
    formula: "OPEX / nº clientes ativos",
    format: "currency",
    requires: ["opex_classificada", "crm_clientes"],
    cta: { label: "Cadastrar clientes no CRM", route: "/crm" },
    lowerIsBetter: true,
  },
  {
    id: "margem_contribuicao",
    section: "eficiencia",
    label: "Margem de Contribuição",
    description: "Percentual que sobra após custos variáveis.",
    formula: "(Receita − Custos variáveis) / Receita",
    format: "percent",
    requires: ["entradas_realizadas", "cmv_classificado"],
    cta: { label: "Classificar custos variáveis", route: "/configuracoes?tab=plano-contas" },
  },

  // 7. Comercial
  {
    id: "cac",
    section: "comercial",
    label: "CAC — Custo de Aquisição",
    description: "Investimento médio para adquirir um novo cliente.",
    formula: "Custos comerciais / nº novos clientes",
    format: "currency",
    requires: ["opex_classificada", "crm_pipeline"],
    cta: { label: "Configurar pipeline CRM", route: "/crm" },
    defaultEnabled: true,
    lowerIsBetter: true,
  },
  {
    id: "ltv",
    section: "comercial",
    label: "LTV — Lifetime Value",
    description: "Valor total estimado por cliente ao longo da relação.",
    formula: "Ticket × Margem × Tempo de retenção",
    format: "currency",
    requires: ["ticket_medio", "crm_clientes"],
    cta: { label: "Cadastrar clientes no CRM", route: "/crm" },
  },
  {
    id: "ltv_cac",
    section: "comercial",
    label: "LTV / CAC",
    description: "Qualidade econômica da aquisição. Saudável > 3.",
    formula: "LTV / CAC",
    format: "ratio",
    requires: ["ticket_medio", "crm_clientes", "crm_pipeline"],
    cta: { label: "Configurar CRM e CMV", route: "/crm" },
  },
  {
    id: "payback_cac",
    section: "comercial",
    label: "Payback do CAC",
    description: "Meses para recuperar o investimento na aquisição.",
    formula: "CAC / lucro mensal por cliente",
    format: "number",
    requires: ["crm_pipeline", "ticket_medio"],
    cta: { label: "Configurar CRM", route: "/crm" },
    lowerIsBetter: true,
  },
  {
    id: "churn",
    section: "comercial",
    label: "Churn",
    description: "Percentual de clientes perdidos no período.",
    formula: "Clientes perdidos / base inicial",
    format: "percent",
    requires: ["crm_clientes"],
    cta: { label: "Configurar CRM", route: "/crm" },
    lowerIsBetter: true,
  },
  {
    id: "expansion_revenue",
    section: "comercial",
    label: "Expansion Revenue",
    description: "Receita adicional vinda de upsell/cross-sell em clientes existentes.",
    formula: "Σ aumentos em contratos ativos",
    format: "currency",
    requires: ["contratos_recorrentes"],
    cta: { label: "Registrar reajustes em contratos", route: "/contratos" },
  },
];

export const KPI_BY_ID: Record<string, KpiDefinition> = Object.fromEntries(
  KPI_REGISTRY.map((k) => [k.id, k]),
);
