

# Plano: Filtros aplicados de forma consistente em todo o Cockpit

## Objetivo
Hoje os filtros de unidade, conta bancária e centro de custo são aplicados ao gráfico mensal e às totais de receita/despesa, mas três blocos do Cockpit ainda mostram dados globais:
- KPI **Passivos Total** (usa `liabTotals` global)
- KPI **Pipeline Ponderado** (usa CRM global)
- **Alertas estratégicos** — runway, saldo, contratos vencendo, divergência receita×despesa, passivos judiciais e CRM são calculados sobre o universo inteiro, ignorando o recorte do usuário

O resultado é incoerente: um gestor que filtra por uma subsidiária vê o gráfico daquela unidade, mas o painel de alertas avisa sobre risco de runway da empresa toda.

Este plano alinha **todas** as visualizações ao mesmo recorte.

## Comportamento esperado

Quando o usuário aplica qualquer filtro:
- **Burn / Runway / Saldo Mínimo / Divergência** passam a refletir apenas o subconjunto filtrado.
- **Passivos Total** e o alerta de passivos judiciais consideram só passivos da unidade/centro de custo selecionados.
- **Pipeline Ponderado** e o alerta de oportunidades CRM consideram apenas oportunidades da unidade selecionada (CRM não tem centro de custo, então o filtro `cc` é ignorado para CRM — comportamento documentado).
- O título da seção de alertas exibe um discreto sufixo "(filtrado)" quando há qualquer filtro ativo, para deixar explícito ao executivo que aquela visão está restrita.
- Sem filtro: comportamento idêntico ao atual.

## Mudanças técnicas

**1. `src/hooks/useFinancialSummary.ts`**
- Aceitar parâmetro opcional `filters?: PlanningFilters`.
- Aplicar `entryMatchesFilters` em `entries` e recomputar `totals` localmente (mesmo padrão já usado no `PlanningCockpit`).
- Aplicar `contractMatchesFilters` em `contracts` e `liabilities` antes de derivar contratos vencendo, judiciais e `liabTotals`.
- Filtrar `opportunities` por `subsidiaryOrgId` (CRM não tem cost_center).
- Recalcular `monthlyBurn`, `runway`, `crmWeightedValue` e `liabTotals` (subset: total, judiciais, contingências) com base nos arrays filtrados.
- Manter `EMPTY_PLANNING_FILTERS` como default — chamadas existentes (Dashboard etc.) continuam funcionando sem alteração.

**2. `src/components/planning/PlanningCockpit.tsx`**
- Repassar `filters` para `useFinancialSummary(startDate, endDate, filters)`.
- Trocar a leitura dos KPIs **Passivos Total** e usar `liabTotals` retornado pelo summary (já filtrado), eliminando a chamada redundante atual a `useLiabilities()` no Cockpit.
- Adicionar badge "(filtrado)" no título "Alertas Estratégicos" quando `hasAnyFilter(filters)` for verdadeiro.

**3. `src/lib/planningFilters.ts`**
- Sem alteração estrutural — `hasAnyFilter` e os matchers já existem.

## Garantias
- **Consistência**: o mesmo recorte alimenta gráfico, KPIs primários, KPIs secundários e alertas — não existe mais "número fantasma" da empresa toda quando o usuário está olhando uma subsidiária.
- **PDF**: como o `usePlanningPdfReport` consome os mesmos hooks com os mesmos filtros, a exportação herda automaticamente a coerência.
- **Sem regressão**: o parâmetro `filters` é opcional e tem default vazio; Dashboard e outros consumidores de `useFinancialSummary` não mudam.

## Arquivos afetados
- **Editado:** `src/hooks/useFinancialSummary.ts`
- **Editado:** `src/components/planning/PlanningCockpit.tsx`

