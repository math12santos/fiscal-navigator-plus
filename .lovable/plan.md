

# Plano de Integração entre Módulos

## Contexto Atual

Os módulos operam de forma relativamente isolada:
- **Dashboard** mostra apenas dados do Fluxo de Caixa
- **DP** calcula custos de folha mas nao projeta no Fluxo de Caixa
- **Planejamento** tem dados de orçamento e cenários sem cruzar com custos reais de DP
- **Passivos** existem no Planejamento mas nao aparecem no Dashboard

## O Que Será Integrado

### Fase 1 -- DP gera projeções no Fluxo de Caixa

O hook `useCashFlow` será estendido para gerar projeções virtuais (assim como já faz com contratos) a partir dos colaboradores ativos do DP. Para cada mês no range consultado, o sistema gerará lançamentos do tipo "saída" com:

- **Folha de pagamento**: salário base + encargos (INSS, FGTS, RAT, Terceiros)
- **Vale Transporte**: custo líquido (VT diário x 22 dias - desconto 6%)
- **Benefícios**: soma dos benefícios ativos de cada colaborador
- **Provisões**: 13o proporcional e férias proporcionais

Cada projeção terá `source: "dp"` e um `id` prefixado com `proj-dp-` para diferenciar de projeções de contratos. Os lançamentos serão agrupados por centro de custo quando o colaborador tiver um `cost_center_id` associado.

### Fase 2 -- Dashboard Executivo Consolidado

O Dashboard será reformulado para exibir dados de todos os módulos:

**Seção 1 -- KPIs Principais (já existem, serão enriquecidos)**
- Receita, Despesas, Resultado e Saldo (já funciona via cashflow)

**Seção 2 -- Cards de Contexto (novos)**
- Contratos Ativos / Valor comprometido mensal
- Custo total de folha mensal (do DP)
- Passivos totais / Contingências prováveis
- Runway estimado (saldo / burn rate mensal)

**Seção 3 -- Alertas Inteligentes (novo)**
- Contratos próximos do vencimento (< 30 dias)
- Saldo projetado abaixo do mínimo configurado
- Passivos com status "Judicial"
- Orçamento excedido vs realizado

**Seção 4 -- Gráficos (aprimorados)**
- Receita vs Despesas (já existe)
- Composição de Despesas incluindo DP como categoria
- Evolução de Receita (já existe)

### Fase 3 -- Planejamento usa dados reais

A aba "Planejado x Realizado" do Planejamento será conectada ao:
- Fluxo de Caixa real (já parcialmente feito)
- Custo de DP real (folha efetiva vs orçada)
- Passivos realizados vs provisionados

A aba "Visão Geral" incluirá o custo de DP nos KPIs de despesa projetada.

---

## Detalhes Técnicos

### Alterações no `useCashFlow.ts`
- Importar dados de colaboradores ativos via `useDP` ou query direta
- Nova função `generateProjectionsFromPayroll()` similar a `generateProjectionsFromContract()`
- Mesclar projeções de DP no array `allEntries` mantendo a mesma interface `CashFlowEntry`

### Novo hook `useFinancialSummary.ts`
Hook centralizado que agrega dados de múltiplos módulos para o Dashboard:
- `useCashFlow` para receitas/despesas
- `useContracts` para contagem e valor comprometido
- `useDP` + `useDPBenefits` para custo de folha
- `useLiabilities` para passivos
- `usePlanningConfig` para alertas de liquidez

### Alterações no `Dashboard.tsx`
- Importar `useFinancialSummary` em vez de apenas `useCashFlow`
- Adicionar seção de cards contextuais
- Adicionar painel de alertas
- Incluir DP na composição de despesas

### Alterações em `PlanningOverview.tsx` e `PlannedVsActual.tsx`
- Incluir custo de DP nas projeções de despesa
- Cruzar orçamento de RH com folha real

### Arquivos a criar
- `src/hooks/useFinancialSummary.ts`

### Arquivos a modificar
- `src/hooks/useCashFlow.ts` -- adicionar projeções de DP
- `src/pages/Dashboard.tsx` -- dashboard consolidado
- `src/components/planning/PlanningOverview.tsx` -- incluir DP nos KPIs
- `src/components/planning/PlannedVsActual.tsx` -- cruzar DP real vs orçado

### Sem alterações de banco de dados
Todas as tabelas necessárias já existem. A integração é puramente lógica no frontend, usando os dados já disponíveis para gerar projeções e cruzamentos.

