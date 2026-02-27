## Problema

O hook `useFinanceiro` (que alimenta as abas Contas a Pagar e Contas a Receber) nao gera projecoes automaticas para contratos recorrentes de servicos. Ele so exibe:

1. Lancamentos materializados na tabela `cashflow_entries`
2. Parcelas manuais da tabela `contract_installments`

A logica de projecao automatica para contratos recorrentes (`generateProjectionsFromContract`) existe apenas no hook `useCashFlow`, mas nao foi replicada no `useFinanceiro`.

## Solucao

Incorporar no `useFinanceiro` a mesma logica de projecao de contratos recorrentes que ja existe no `useCashFlow`, adaptada para funcionar sem filtro de datas (o Financeiro mostra todos os periodos) evitando duplicidade de lançamentos.

### Alteracoes

**Arquivo: `src/hooks/useFinanceiro.ts**`

1. Importar as funcoes `addMonths`, `format`, `isBefore`, `isAfter` de `date-fns` (algumas ja estao importadas)
2. Copiar/reutilizar as funcoes `isRecurringCashflow` e `generateProjectionsFromContract` do `useCashFlow` (ou extrair para um utilitario compartilhado)
3. No `useMemo` que monta `allEntries`, alem das parcelas manuais, tambem gerar projecoes automaticas para contratos recorrentes ativos filtrados pelo tipo (receita para "entrada", custo/despesa para "saida")
4. Usar um range padrao (ex: hoje ate +12 meses) para gerar as projecoes, ja que o Financeiro nao tem filtro de periodo

### Abordagem tecnica

A melhor abordagem e extrair `isRecurringCashflow` e `generateProjectionsFromContract` para um arquivo utilitario compartilhado (ex: `src/lib/contractProjections.ts`) e usa-lo em ambos os hooks, evitando duplicacao de logica.

**Novo arquivo: `src/lib/contractProjections.ts**`

- Mover `isRecurringCashflow()` e `generateProjectionsFromContract()` do `useCashFlow.ts`
- Exportar ambas as funcoes

**Arquivo: `src/hooks/useCashFlow.ts**`

- Importar de `@/lib/contractProjections` em vez de ter as funcoes locais

**Arquivo: `src/hooks/useFinanceiro.ts**`

- Importar `isRecurringCashflow` e `generateProjectionsFromContract` de `@/lib/contractProjections`
- No `useMemo` de `allEntries`:
  - Identificar contratos recorrentes ativos do tipo correto (receita/custo)
  - Gerar projecoes com range de hoje ate +12 meses
  - Deduplicar contra entries ja materializadas (mesmo contract_id + data_prevista)
  - Mesclar com as parcelas manuais existentes

### Resultado esperado

Contratos recorrentes de servico (como o "Visa S.A - SPB IA AUDITORIA") aparecerao automaticamente em Contas a Receber com projecoes mensais para os proximos 12 meses, assim como ja apareceriam no Fluxo de Caixa.