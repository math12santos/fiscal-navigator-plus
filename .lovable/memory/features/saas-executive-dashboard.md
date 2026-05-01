---
name: SaaS Executive Dashboard
description: Painel executivo do BackOffice com MRR/ARR/ARPU, churn, crescimento, receita e listas de risco via RPC get_saas_kpis
type: feature
---

# Dashboard Executivo SaaS (BackOffice)

**Onde:** topo de `/backoffice` (`src/pages/BackofficeDashboard.tsx`) via `<SaasOverviewPanel />`.

## RPC `get_saas_kpis()`
- SECURITY DEFINER, autorizado apenas via `public.is_backoffice()` (revoke from PUBLIC + grant to authenticated).
- Retorna jsonb único — uma chamada server-side substitui múltiplos roundtrips.
- **MRR**: normaliza `yearly→/12`, aplica `custom_price`, `discount_pct` e `seats`. Considera `status IN ('active','past_due')`.
- **ARR** = MRR × 12. **ARPU** = MRR / active.
- Séries 12m geradas via `generate_series` + LEFT JOIN para preencher meses sem dados (zero-fill).
- Top listas limitadas a 5 (revenue 12m / overdue).

## Hook `useSaasKpis`
- React Query, `staleTime: 5min` / `gcTime: 30min` (preset operacional).
- Tipo forte em `src/hooks/useSaasKpis.ts`.

## UI
- 8 KpiCards (MRR, ARPU, crescimento líquido, churn, ativas, trial, inadimplentes, receita 12m).
- Recharts: BarChart crescimento (Novas/Canceladas), LineChart receita (Faturado/Recebido).
- 3 listas clicáveis: mix de planos, top receita, top inadimplência → navegam para `/backoffice/empresa/:id`.
- Churn: <2% verde, 2-5% amarelo, >5% vermelho.

## Quando estender
- Adicionar nova métrica: estender RPC e tipo `SaasKpis`. **Não** consultar tabelas de billing direto no client (latência + RLS desnecessário).
- Adicionar invalidação realtime: registrar `subscriptions`/`invoices` em `useRealtimeSync` e invalidar `["saas_kpis"]`.
