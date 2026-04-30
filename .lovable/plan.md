
# Dashboard Financeiro — KPIs Executivos (CFO/Board)

Adicionar nova aba **"Dashboard"** como primeira aba de `/financeiro`, agregando 7 blocos de KPIs do nível CFO/Conselho. Cada KPI é **calculado quando há dados**, ou exibe um **estado vazio explicativo + CTA** apontando para onde cadastrar a informação que falta. O usuário pode **ligar/desligar cada KPI** (preferência por organização, persistida).

---

## 1. Estrutura de arquivos

**Novos:**
- `src/components/financeiro/dashboard/FinancialDashboardTab.tsx` — orquestrador, renderiza as 7 seções.
- `src/components/financeiro/dashboard/KpiSection.tsx` — wrapper colapsável de seção (título + grid de cards).
- `src/components/financeiro/dashboard/KpiTile.tsx` — card individual: valor, hint, badge de saúde, estado "sem dados" com CTA, botão de toggle on/off.
- `src/components/financeiro/dashboard/KpiPreferencesDialog.tsx` — modal global "Configurar KPIs" para ativar/desativar em massa por seção.
- `src/components/financeiro/dashboard/kpiRegistry.ts` — registro central declarativo de cada KPI: id, seção, label, fórmula, dependências de dados, CTA (rota + texto).
- `src/hooks/useFinancialDashboardKPIs.ts` — agrega dados de `useCashFlow`, `useBankAccounts`, `useContracts`, `useLiabilities`, `useFinanceiroAvgTerms`, `usePayrollProjections`, `useCRMOpportunities`, `useEmployees` e produz um objeto `{ [kpiId]: { value, status: 'ok'|'partial'|'missing', missingReason, ctaRoute } }`.
- `src/hooks/useKpiPreferences.ts` — CRUD da tabela `dashboard_kpi_preferences` (enabled/disabled por usuário+org).

**Modificados:**
- `src/pages/Financeiro.tsx` — adicionar `{ key: "dashboard", label: "Dashboard" }` como primeiro item de `ALL_TABS`; default tab passa a ser `dashboard`.

**Migração nova:** tabela `dashboard_kpi_preferences (user_id, organization_id, kpi_id, enabled, created_at)` com RLS por `is_org_member` + unique `(user_id, organization_id, kpi_id)`.

---

## 2. Seções e KPIs (35 indicadores)

Cada KPI declara `requires: string[]` — uma lista de "capacidades" de dados. Se faltar qualquer uma, o card vai para estado `missing` e mostra **por que** + **link de ação**.

### 2.1 Receita e Crescimento
| KPI | Cálculo | Requisitos | CTA quando faltar |
|---|---|---|---|
| Faturamento (Receita Bruta) | Σ `cashflow_entries.tipo='entrada'` realizado no período | entradas realizadas | "Importe ou registre recebimentos" → /financeiro?tab=receber |
| Receita Líquida | Bruta − impostos sobre vendas (subgrupo "tributos s/ vendas") | classificação por subgrupo | "Configure subgrupos de tributos" → /configuracoes?tab=aglutinacao |
| Crescimento da Receita | (Receita mês N − N-1) / N-1 | ≥ 2 meses de receita | "Aguardando histórico mínimo (2 meses)" |
| Ticket Médio | Receita / nº de transações de entrada | nº transações > 0 | "Sem transações no período" |
| MRR | Σ contratos ativos com `tipo_recorrencia` em {mensal, bimestral, …} normalizados/mês e `impacto_resultado='receita'` | contratos recorrentes ativos | "Cadastre contratos recorrentes" → /contratos |
| ARR | MRR × 12 | idem MRR | idem |

### 2.2 Lucratividade
| KPI | Cálculo | Requisitos |
|---|---|---|
| Lucro Bruto | Receita Líquida − CMV/CSP | classificação CMV no plano de contas |
| Margem Bruta | Lucro Bruto / Receita Líquida | idem |
| Margem Operacional | (Receita Líq − CMV − OPEX) / Receita Líq | OPEX classificada |
| EBITDA | Op. + Depreciação + Amortização | depreciação registrada |
| Margem EBITDA | EBITDA / Receita Líquida | idem |
| Margem Líquida | (Op. − Juros − IR) / Receita Líquida | juros e IR identificados |

CTA padrão para faltas de classificação: **"Classifique despesas em CMV/OPEX/Financeiras"** → `/configuracoes?tab=plano-contas`.

### 2.3 Caixa e Liquidez
| KPI | Cálculo |
|---|---|
| Saldo de Caixa | Σ `contas_bancarias.saldo_atual` (ativas) |
| Fluxo de Caixa Operacional | Recebimentos op. − pagamentos op. (exclui financiamentos/investimentos) no período |
| Burn Rate | Σ saídas / nº meses no período |
| Runway | Saldo / Burn Rate (∞ se burn ≤ 0) — usa o helper já existente |
| Capital de Giro Necessário | (PMR + Estoque − PMP) × custo diário operacional |
| Liquidez Corrente | Ativos circulantes / Passivos circulantes (de `liabilities` + recebíveis em aberto) |

### 2.4 Contas a Receber
PMR, Aging (já tem `useFinanceiroAvgTerms` com buckets 0-30/31-60/61-90/90+), DSO, Inadimplência ABC, Taxa de Recuperação (recebido em atraso / total vencido), Concentração (% top 5 clientes em recebíveis).

### 2.5 Contas a Pagar e Endividamento
PMP, Endividamento Geral (passivos/ativos), Dívida Líquida (passivos onerosos − caixa), Dívida Líquida/EBITDA, Cobertura de Juros (EBITDA/juros), Custo da Dívida — separado por categoria (`fiscal`, `clientes`, `bancos`) lendo `liabilities.tipo`/`categoria`, mais Custo Ponderado Total.

### 2.6 Eficiência Operacional
OPEX/Receita, Custo Fixo Mensal (média móvel 3m de despesas com `recorrencia` ≠ pontual), Ponto de Equilíbrio (CF / margem contribuição %), Produtividade por Colaborador (Receita / headcount de `useEmployees`), Custo por Cliente Atendido (OPEX / nº clientes ativos CRM), Margem de Contribuição.

### 2.7 Indicadores Comerciais Financeiros
CAC (custo total marketing+vendas / nº novos clientes ganhos no CRM), LTV (ticket médio × margem bruta × tempo médio retenção), LTV/CAC, Payback CAC (CAC / lucro mensal por cliente), Churn (perdas/base inicial do período), Expansion Revenue (upsell em contratos existentes).

---

## 3. Sistema de "Dados Faltando" + CTAs

Cada `KpiTile` tem 4 estados visuais:

```text
ok        → valor + delta + sparkline (quando há série)
partial   → valor + badge âmbar "X% de cobertura — clique para melhorar"
missing   → ícone ⓘ + frase explicando o que falta + botão "Configurar"
disabled  → card minimizado em cinza com toggle pra reativar
```

Exemplo de payload no `kpiRegistry`:
```ts
{
  id: "ebitda",
  section: "lucratividade",
  label: "EBITDA",
  requires: ["receita_liquida", "opex_classificada", "depreciacao"],
  cta: { label: "Configurar plano de contas", route: "/configuracoes?tab=plano-contas" },
  format: "currency",
}
```

O hook `useFinancialDashboardKPIs` retorna, para cada `requires`, se a capacidade está atendida. O Tile junta o motivo: *"EBITDA indisponível: nenhuma despesa de Depreciação registrada nos últimos 12 meses."*

---

## 4. Configuração on/off de KPIs

- Cada Tile tem menu `⋮` → "Ocultar este KPI". Persiste em `dashboard_kpi_preferences`.
- Botão **"Configurar Dashboard"** no header da aba abre `KpiPreferencesDialog`: lista dos 35 KPIs agrupados por seção com switches; preset "Essencial PME" (subset enxuto) e "Completo".
- Padrão (sem registro na tabela): todos habilitados **exceto** os marcados `defaultEnabled: false` no registry (ex.: LTV/CAC se não há CRM ativo).

---

## 5. Considerações técnicas

- **Performance**: o hook agrega vários hooks já existentes; usa `useMemo` por seção para evitar recalcular tudo a cada toggle.
- **Holding mode**: respeita `useHolding().activeOrgIds` automaticamente porque consome hooks que já tratam isso.
- **Permissões**: aba só aparece se `getAllowedTabs("financeiro", ALL_TABS)` incluir `dashboard`. Preferências por usuário+org via RLS.
- **Reuso**: aproveita `KPICard` existente (com `valueClassName` para negativos vermelhos no padrão contábil), `PMPMRKpiCard`, `useFinancialSummary` (runway, burn, alertas) e `useFinanceiroAvgTerms` (aging).
- **MECE**: nenhum cálculo duplica entradas — todos derivam de `cashflow_entries` materializadas via os hooks centralizados, mantendo a fonte única de verdade.
- **Sem dados ≠ zero**: nunca exibir "R$ 0,00" como sucesso. Sempre `missing` com motivo.

---

## 6. Entregáveis desta fase

1. Migration: `dashboard_kpi_preferences` + RLS.
2. Registry com os 35 KPIs.
3. Hook agregador.
4. UI: aba Dashboard, seções colapsáveis, tiles com 4 estados, dialog de preferências.
5. Integração na rota `/financeiro` e atualização do `FinanceiroSkeleton` para incluir a nova aba.
6. Memória do projeto atualizada (`features/financial-dashboard-kpis.md`) descrevendo o registry e o padrão de "missing data + CTA".

Próximas iterações (não nesta entrega): sparklines históricos por KPI, exportação PDF do Dashboard, alertas configuráveis por KPI, comparativo período-a-período.
