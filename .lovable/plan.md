# Seletor de Mês Competência no Dashboard

## Problema

No `src/pages/Dashboard.tsx` a referência temporal é fixa em `useMemo(() => new Date(), [])`. Todos os KPIs ("Receita Mensal", "Despesas Mensais", "Resultado Mensal", "Saldo do Período"), o gráfico de 6 meses e o "Despesas por Categoria" ficam travados no mês corrente do servidor. Não há como o CFO/Board:
- revisitar fechamentos passados (ex.: "como fechou 03/2026?"),
- antecipar projeções de meses futuros (ex.: "como está 06/2026 com base nos contratos e na folha provisionada?").

Isso quebra a promessa do produto de responder "Onde estamos hoje?" **e** "Para onde estamos indo?" a partir do mesmo painel.

## Solução

Adicionar um **seletor de mês competência** no header do Dashboard, que controla todo o estado temporal da página. O range de 6 meses do gráfico desliza junto: passa a ser **[mês selecionado − 5, mês selecionado]**, mantendo o mês escolhido como o "atual" da análise. O comparativo "vs mês anterior" passa a ser sempre relativo ao mês selecionado.

Quando o mês selecionado é futuro, o painel mostra os mesmos números, mas alimentados pela engine de projeções já existente (contratos recorrentes, folha provisionada, VR/VA antecipados, CRM ponderado) — exatamente os dados que `useFinancialSummary` já retorna via `cashflow_entries` + projeções virtuais (`proj-*`).

### UX

- No `PageHeader` do Dashboard, à direita do título, um **MonthPicker** compacto:
  - Botão com label "Competência: **abr/2026**" + ícone calendar.
  - Setas `‹ ›` para navegar mês a mês.
  - Popover com `Calendar` shadcn em modo `month` (ano + grid de 12 meses), permitindo escolher qualquer mês entre `2000` e `2099` (respeita memória `date-entry-logic`).
  - Botão "Hoje" para voltar ao mês corrente.
- Badge sutil ao lado quando mês ≠ corrente:
  - Mês passado → badge cinza "Histórico".
  - Mês futuro → badge primary outline "Projeção".
- Subtítulo do `PageHeader` reflete: `"Visão consolidada — Acme · abr/2026 (Projeção)"`.
- Estado persistido em `sessionStorage` (`dashboard.referenceMonth`) para sobreviver a navegação intra-sessão sem poluir preferências de longo prazo.

### Comportamento por bloco

| Bloco | Antes | Depois |
|---|---|---|
| KPIs "Receita / Despesas / Resultado Mensal" | Mês corrente vs anterior | Mês selecionado vs imediatamente anterior |
| KPI "Saldo do Período" | Últimos 6 meses até hoje | 6 meses encerrando no mês selecionado |
| Gráfico Receita × Despesas (6m) | Fixo até hoje | Janela deslizante até o mês selecionado |
| Despesas por Categoria | Mês corrente | Mês selecionado |
| Group Share (Holding) | Totais do range fixo | Totais do range deslizante (mesmo `useGroupTotals`) |
| Cards estáticos (Runway, Contingências, Contratos ativos, CRM) | Snapshot atual | **Mantêm snapshot atual** — são leituras de "estado da empresa hoje", não competência. Recebem badge "snapshot" para deixar claro. |

Runway, contratos ativos, contingências e CRM são intencionalmente desacoplados do mês escolhido: representam posição/estoque, não fluxo competência. O comportamento será documentado no tooltip do KPI.

## Arquivos

**Novos**
- `src/components/MonthPicker.tsx` — componente reutilizável (Popover + Calendar shadcn em modo mês, setas, botão "Hoje", limite 2000–2099).
- `src/hooks/useReferenceMonth.ts` — hook que expõe `{ referenceMonth, setReferenceMonth, isCurrent, isFuture, isPast }`, persistindo em `sessionStorage` com chave por página (`dashboard`).

**Editados**
- `src/pages/Dashboard.tsx`:
  - Substituir `const now = useMemo(() => new Date(), [])` por `const { referenceMonth } = useReferenceMonth("dashboard")`.
  - Recalcular `rangeFrom`, `rangeTo`, `prevMonthStart/End`, `curMonthStart/End`, `monthlyData` a partir de `referenceMonth`.
  - Renderizar `<MonthPicker />` no header e badge de contexto (Histórico / Projeção / Atual).
  - Atualizar subtitle do `PageHeader`.
- `src/components/PageHeader.tsx` — adicionar prop opcional `actions?: ReactNode` (se ainda não existir) para receber o picker à direita. Verificar antes de duplicar.

**Não tocar nesta iteração** (escopo intencionalmente fechado para evitar regressão):
- `DPDashboard`, `DPCockpitSection`, `BackofficeDashboard`, `MaturityOverviewSection`. Cada um tem semântica própria de período (folha do mês, maturidade vigente). Podem ganhar o mesmo seletor numa segunda passagem se o usuário pedir — o componente `MonthPicker` e o hook ficam prontos para reuso.

## Detalhes técnicos

- `useReferenceMonth(scope: string)` retorna sempre `startOfMonth(date)` para evitar bugs de fuso/dia.
- `MonthPicker` usa o `Calendar` do shadcn (`mode="default"` com captionLayout `"dropdown-buttons"` limitado a meses) — segue a memória `shadcn-datepicker` (incluir `pointer-events-auto`).
- `useFinancialSummary(rangeFrom, rangeTo)` já aceita range arbitrário e já materializa projeções virtuais (`proj-*`) — não precisa de mudança.
- `useGroupTotals(rangeFrom, rangeTo)` idem.
- Comparativo "vs mês anterior" continua usando `pctChange`; quando o mês selecionado for futuro e o anterior também não tiver realizado, o cálculo cai naturalmente em projeção vs projeção (consistente).
- Persistência em `sessionStorage` (não `localStorage`): o CFO sempre abre o produto no "hoje" no início do dia; a navegação por meses é exploratória.
- Acessibilidade: setas com `aria-label`, botão do popover com `aria-expanded`, valor anunciado em `aria-live="polite"` quando muda.

## Critérios de aceite

1. Ao abrir o Dashboard, mostra o mês corrente — comportamento idêntico ao atual.
2. Clicando `‹` uma vez, todos os KPIs de mês, gráfico de 6 meses e "Despesas por Categoria" recalculam para o mês anterior; badge "Histórico" aparece.
3. Clicando `›` para um mês futuro: KPIs mostram valores da projeção (vindos das engines de contratos + folha + VR/VA já existentes); badge "Projeção" aparece.
4. Botão "Hoje" volta ao mês corrente e remove o badge.
5. Estado sobrevive a navegação interna (Tarefas → Dashboard mantém o mês escolhido) e é zerado ao recarregar a aba.
6. Runway, Contratos Ativos, Contingências e CRM não mudam ao trocar o mês (snapshot) e exibem tooltip "Posição atual da empresa — independente do mês selecionado".
