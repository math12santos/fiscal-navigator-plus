

# Plano: Eliminar divergências de totais entre Cockpit, Plan×Real×Projetado e PDF

## Diagnóstico — divergências reais hoje

Após revisar os três pontos de cálculo (`PlanningCockpit.tsx`, `useFinancialSummary.ts`, `usePlanningPdfReport.ts`) e o componente `PlannedVsActual.tsx`, encontrei **4 inconsistências numéricas** que aparecem ao trocar filtros:

| # | Sintoma | Causa |
|---|---------|-------|
| 1 | "Burn Mensal Médio" (KPI) ≠ burn citado no alerta de Runway | Cockpit divide por **todos os meses do horizonte**; `useFinancialSummary` divide só por **meses com saída** |
| 2 | PDF mostra "Passivos (total)" global mesmo com filtro ativo | PDF lê `useLiabilities().totals` em vez do `liabTotals` já filtrado de `useFinancialSummary` |
| 3 | "Projetado" no PDF e em Plan×Real pode somar folha já paga (materializada) | `payrollProjections` é usado bruto, sem subtrair DP entries já materializadas — `useCashFlow` faz esse dedup, mas só para o stream consolidado |
| 4 | "Custo Folha/mês" filtrado por CC drifta | Cockpit usa divisor aproximado `(endDate - startDate) / 30` em vez de `horizonMonths.length` |

Itens 1, 2 e 4 são **bugs de cálculo**. Item 3 é **risco de dupla contagem** entre Realizado e Projetado quando o usuário materializa folha do mês corrente.

## Comportamento esperado após correção

- O número exibido em **Burn Mensal Médio** é exatamente o mesmo divisor usado para calcular **Runway** e a descrição do alerta de runway.
- KPIs do PDF refletem os mesmos filtros aplicados na tela — incluindo Passivos.
- Projetado nunca soma mais folha do que efetivamente projetada para o mês: se já foi materializada (paga), entra em Realizado e sai do Projetado.
- Divisores mensais (folha, burn, stress) usam **a mesma contagem `horizonMonths.length`** em todo lugar.

## Mudanças técnicas

### 1. `src/hooks/useFinancialSummary.ts`
- `monthlyBurn`: dividir por **número de meses do horizonte** (não por meses com saída). Calcular `horizonMonths` a partir de `rangeFrom`/`rangeTo` e usar como divisor — mesmo padrão do Cockpit.
- Garante que `runway = saldo / monthlyBurn` use o mesmo burn que o Cockpit exibe.

### 2. `src/components/planning/PlanningCockpit.tsx`
- Remover o cálculo local `avgMonthlySaida` e passar a consumir `monthlyBurn` retornado por `useFinancialSummary`. KPI "Burn Mensal Médio" passa a usar `monthlyBurn` (já alinhado ao runway).
- Substituir o divisor `(endDate - startDate) / (1000*60*60*24*30)` por `horizonMonths.length` no cálculo de `avgMonthlyPayroll` filtrado.

### 3. `src/hooks/usePlanningPdfReport.ts`
- **Passivos**: trocar `useLiabilities().totals` por `liabTotals` retornado por `useFinancialSummary(startDate, endDate, filters)` (que já está sendo chamado na linha 58).
- **Burn / Runway**: consumir `monthlyBurn` e `runway` diretamente de `useFinancialSummary` (mesmos números do Cockpit).
- **Folha no Projetado**: filtrar `payrollProjections` removendo aquelas cuja `source_ref` já apareça em `materializedEntries` — mesma lógica que `useCashFlow` aplica para o stream consolidado. Isso elimina dupla contagem entre Realizado e Projetado.
- **Folha por CC**: usar `monthsCount` (= `Object.keys(monthly).length`) como divisor, não fórmula de 30 dias.

### 4. `src/components/planning/PlannedVsActual.tsx`
- Mesmo dedup de folha materializada que o PDF: filtrar `payrollProjections` por `source_ref` ausente em `materializedEntries` antes de somar em `projectedByMonth.gasto`. Caso contrário, ao confirmar um pagamento de folha, o gráfico passa a contar duas vezes.

### 5. Pequena helper compartilhada
- Criar `getHorizonMonths(start, end): string[]` em `src/lib/planningFilters.ts` (ou novo `src/lib/planningHorizon.ts`) e reutilizar nas 4 superfícies acima — única fonte de verdade para o array de chaves `yyyy-MM` e contagem.

## Garantias

- **Consistência cruzada**: Cockpit, Plan×Real×Projetado e PDF passam a derivar Burn, Runway, Passivos, Folha e totais filtrados das **mesmas funções**, com os **mesmos divisores** e o **mesmo conjunto deduplicado** de projeções.
- **Nenhuma regressão visual**: comportamento sem filtros permanece idêntico; mudanças afetam apenas o que já estava divergindo.
- **Auditável**: o PDF salvo no histórico mostra os mesmos números que estavam na tela no momento da exportação — pré-requisito do princípio "o passado é imutável".

## Arquivos afetados

- **Editado:** `src/hooks/useFinancialSummary.ts`
- **Editado:** `src/components/planning/PlanningCockpit.tsx`
- **Editado:** `src/components/planning/PlannedVsActual.tsx`
- **Editado:** `src/hooks/usePlanningPdfReport.ts`
- **Editado (novo helper):** `src/lib/planningFilters.ts`

