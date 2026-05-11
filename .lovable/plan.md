
# Fluxo de Caixa: Previsto x Realizado (MECE) + Sugestão de Contas Fixas

## Problema atual

Na aba **Fluxo de Caixa** (`FluxoCaixaTab`, `FluxoCaixaCharts`, `FluxoCaixaTable`):

- KPIs e gráficos tratam um lançamento `previsto`/`confirmado` como se fosse caixa real, usando `valor_realizado ?? valor_previsto`. Isso quebra o princípio MECE recém-implementado (Previsto, Executado declarado, Realizado conciliado).
- A aba "Realizado" hoje aceita qualquer entrada com `status in (pago,recebido)`, mesmo sem conciliação com extrato — então um clique em "Marcar como pago" em Contas a Pagar vira "caixa real".
- O gráfico de evolução de saldo mistura previsto + realizado num único traçado.
- Não há nenhum recurso que pegue contratos recorrentes / despesas fixas e sugira sua projeção para orçamento.

## Princípios

1. **Previsto** = qualquer `cashflow_entry` com `status in (previsto, confirmado)` ou projeção virtual (`proj-*`) **ou** `status in (pago,recebido)` ainda sem `bank_statement_entries` conciliado.
2. **Realizado** = `cashflow_entry` que tem **linha de extrato conciliada** (existe `bank_statement_entries` vinculado) **ou** veio do próprio extrato (`source='extrato_bancario'`). Estornos descontam o original; transferências internas não contam em entradas/saídas.
3. **Visão Geral** mostra **dois traçados sobrepostos**: linha sólida = Realizado acumulado (até hoje), linha pontilhada = Previsto acumulado (do hoje em diante e sobre o passado para auditoria de aderência).
4. Contas fixas (contratos recorrentes ativos + lançamentos repetidos nos últimos 3 meses) viram **sugestões de orçamento** na aba Projetado.

## Mudanças de UI/dados

### 1. `useCashFlow` — derivar flag `is_realizado_caixa`

Adicionar, na materialização de `entries`, um campo derivado por entrada:

```ts
is_realizado_caixa: boolean
// true se: source === 'extrato_bancario'
//       OU existe link em bank_statement_entries onde cashflow_entry_id = e.id
//       (consultar via novo subquery por organization+período, hash em memória)
```

Buscar uma única vez `bank_statement_entries` do período (id, cashflow_entry_id, status) e montar `Set<cashflow_entry_id>` para anotar `is_realizado_caixa` nos entries.

Também expor já no hook:
- `realizadoEntries` — `is_realizado_caixa === true` e não-estorno (estornos abatem)
- `previstoEntries` — todo o resto (inclui virtuais `proj-*`, AP/AR ainda não conciliados, mesmo se `status='pago'`)
- `transferEntries` — `categoria='transferencia_interna'` (excluídos de KPIs de E/S)

### 2. `FluxoCaixaTab` — KPIs e abas

- **Visão Geral**: KPIs passam a ter dois valores cada — "Realizado" (grande) + "Previsto" (subtítulo cinza), por exemplo:
  - `Entradas: R$ 120k realizado / R$ 300k previsto`
  - `Saídas: R$ 80k realizado / R$ 250k previsto`
  - `Saldo Final = Saldo Abertura + Realizado + (Previsto restante até fim do período)`
- **Aba Realizado**: usa **somente** `realizadoEntries`. Adicionar aviso se houver lançamentos com `status='pago'` mas **sem** conciliação — link "Conciliar agora" para a aba Conciliação.
- **Aba Projetado**: usa `previstoEntries` (inclui virtuais e `pago`-não-conciliado).
- Runway recalculado com base em saídas previstas (mantém comportamento), mas saldo de abertura passa a ser `openingBalance + Σ realizado até hoje` (em vez de só saldo das contas), garantindo continuidade entre passado conciliado e futuro projetado.

### 3. `FluxoCaixaCharts` — Previsto x Realizado

Cada gráfico passa a ter duas séries:

- **Entradas vs Saídas (barras)**: 4 barras por dia — `entradas_realizadas`, `entradas_previstas`, `saidas_realizadas`, `saidas_previstas`. Realizadas em cor sólida, previstas em padrão hachurado/opacidade 0.5.
- **Evolução do Saldo (área)**: duas linhas:
  - Sólida: saldo acumulado **só com Realizado** até a data de hoje.
  - Tracejada: saldo acumulado **Previsto** (Realizado até hoje + previsto a partir de hoje).
  - `ReferenceLine` vertical em "Hoje".

Excluir entradas de `categoria='transferencia_interna'` (já tem flag) das duas séries; estornos somam negativo do tipo original.

### 4. `FluxoCaixaTable` — coluna Origem

Adicionar coluna **Origem** com badge:
- "Extrato" (verde) para `is_realizado_caixa`
- "Conciliado" para `status pago/recebido` com link de extrato
- "Previsto" para o resto
- "Transferência" / "Estorno" para categorias especiais

A coluna Status existente continua, mas o destaque visual passa a ser a Origem.

### 5. Sugestão de contas fixas para orçamento — novo `FixedExpensesSuggestionsCard`

Componente acima do gráfico na aba **Projetado**, que lista despesas fixas candidatas a entrar no orçamento do próximo período:

Fonte das sugestões (lado cliente, já temos os dados):
- **Contratos recorrentes ativos** (`useContracts` + `isRecurringCashflow`) que **ainda não têm projeção materializada** dentro do `rangeFrom..rangeTo`.
- **Padrão de repetição em `cashflow_entries`**: agrupar por `(descricao normalizada, account_id, fornecedor)` nos últimos 3 meses; se ocorreu em ≥2 dos 3, é candidato.

Cada sugestão mostra: descrição, valor médio, recorrência detectada, e dois botões:
- **Adicionar à projeção** → cria `cashflow_entry` com `status='previsto'`, `data_prevista` = mesmo dia do mês, dentro do período visualizado.
- **Ignorar** (persistido em `localStorage` por organização + chave da sugestão; sem migração).

Sem novas tabelas, sem nova RPC. Tudo deriva de dados já em cache do React Query.

## Arquivos

- `src/hooks/useCashFlow.ts` — adicionar busca de `bank_statement_entries`, anotar `is_realizado_caixa`, expor `realizadoEntries`/`previstoEntries`/`transferEntries`.
- `src/components/financeiro/FluxoCaixaTab.tsx` — KPIs duplos, recomputo de totais, alerta de "pago não conciliado".
- `src/components/fluxocaixa/FluxoCaixaCharts.tsx` — séries previsto x realizado, ReferenceLine "Hoje".
- `src/components/fluxocaixa/FluxoCaixaTable.tsx` — coluna Origem.
- `src/components/financeiro/FixedExpensesSuggestionsCard.tsx` — novo, sugestões de contas fixas.
- `src/lib/fixedExpensesDetection.ts` — novo, helpers puros: detectar recorrência e gerar candidatos.

Sem migrations. Sem mudanças em RPCs nem no engine de projeção (`projectionRegistry`/`contractProjections`).

## Fora do escopo

- Reescrever Conciliação ou regras de matching automático.
- Mudar estrutura de `cashflow_entries`.
- Tocar no DRE/KPIs do Dashboard executivo (já consomem RPC `get_dashboard_kpis` separada).

## Status: implementado (2026-05-11)

- `useCashFlow` agora consulta `bank_statement_entries` do período e anota `is_realizado_caixa` em cada entry. Expõe `realizadoEntries`, `previstoEntries`, `transferEntries`, `paidNotReconciledEntries`, `totalsRealizado`, `totalsPrevisto`. Estornos abatem (sign -1); transferências internas excluídas dos totais.
- `FluxoCaixaTab`: na Visão Geral, KPIs mostram Realizado em destaque + Previsto no subtítulo; Saldo Final = abertura + realizado + previsto. Aba Realizado exibe Alert "pago sem conciliação" linkando para Conciliação.
- `FluxoCaixaCharts`: novo modo overlay (Visão Geral) com 4 barras (entradas/saídas × real/prev) e duas linhas de saldo (Realizado sólido / Projetado tracejado) + ReferenceLine "Hoje".
- `FluxoCaixaTable`: coluna Origem agora usa badges semânticas: Extrato (success), Conciliado, Previsto (outline), Transferência, Estorno.
- Novo `FixedExpensesSuggestionsCard` na aba Projetado: lista contratos recorrentes ativos sem projeção + padrões repetidos em ≥2 dos últimos 3 meses; Adicionar cria `cashflow_entry` `status=previsto` `source=sugestao_fixa`; Ignorar é persistido em localStorage por org.
