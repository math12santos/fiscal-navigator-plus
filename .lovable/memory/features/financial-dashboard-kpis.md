---
name: Financial Dashboard KPIs
description: Aba Dashboard em /financeiro com 41 KPIs em 7 seções, registry declarativo, capabilities de dados, CTAs para coleta e preferências on/off por usuário+org
type: feature
---

# Dashboard Financeiro

Aba **Dashboard** (primeira) em `/financeiro` com KPIs nível CFO/Conselho.

## Arquitetura
- `src/components/financeiro/dashboard/kpiRegistry.ts` — registry declarativo de cada KPI com `requires: DataCapability[]` e `cta: { label, route }`.
- `src/hooks/useFinancialDashboardKPIs.ts` — agrega `useCashFlow` (12m), `useBankAccounts`, `useContracts`, `useLiabilities`, `useEmployees`, `useCRMClients`, `useCRMOpportunities`, `useFinanceiroAvgTerms`. Detecta capacidades via regex sobre `categoria`/`descricao` (CMV, OPEX, depreciação, juros, IR, tributos s/ vendas, marketing/vendas).
- `src/hooks/useKpiPreferences.ts` + tabela `dashboard_kpi_preferences (user_id, organization_id, kpi_id, enabled)` com unique constraint e RLS por `is_org_member`.

## Seções (41 KPIs)
1. Receita (Bruta, Líquida, Crescimento, Ticket, MRR, ARR)
2. Lucratividade (Lucro Bruto, M.Bruta, M.Operacional, EBITDA, M.EBITDA, M.Líquida)
3. Caixa (Saldo, FCO, Burn, Runway, Capital de Giro, Liquidez Corrente)
4. AR (PMR, Inadimplência ABC, Aging, DSO, Recuperação, Concentração)
5. AP (PMP, Endividamento, Dívida Líq, Dív/EBITDA, Cobertura Juros, Custo Dívida)
6. Eficiência (OPEX/Receita, Custo Fixo, Ponto Equilíbrio, Produtividade, Custo/Cliente, M.Contribuição)
7. Comercial (CAC, LTV, LTV/CAC, Payback, Churn, Expansion)

## Estados visuais (KpiTile)
- **ok** → valor formatado (negativos no padrão contábil `(R$ X)` em vermelho)
- **missing** → ícone âmbar + 1ª razão faltante + botão CTA navegando para a rota de coleta
- **disabled** → tile minimizado em cinza com botão "Reativar"

## Preferências
- Padrão: tudo ligado (exceto `defaultEnabled: false`).
- `KpiPreferencesDialog` oferece presets "Essencial PME" (17 KPIs) e "Completo".
- Persistência por usuário+org via upsert em `dashboard_kpi_preferences`.

## Princípio
Sem dados ≠ R$ 0,00. Cada ausência mostra **o que falta** e **como configurar**.
