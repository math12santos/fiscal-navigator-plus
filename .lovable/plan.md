
# Correcao: Contratos x Fluxo de Caixa -- Conexoes quebradas e redundantes

## Problema Principal

Quando o usuario clica em "Receber" numa parcela de venda, o status da parcela muda para `"recebido"`. Porem, no `useCashFlow.ts` (linha 219), a verificacao so reconhece `"pago"`:

```typescript
status: inst.status === "pago" ? "pago" : "previsto",
```

O status `"recebido"` nao e tratado, entao a parcela continua aparecendo como "previsto" no fluxo de caixa mesmo apos confirmacao.

## Problema Secundario: Invalidacao de cache

Quando uma parcela e atualizada via `useContractInstallments.update`, o hook so invalida a query `["contract_installments", contractId]`. Ele **nao** invalida as queries do fluxo de caixa (`["cashflow_entries"]` e `["cashflow_installments"]`), entao o fluxo de caixa nao reflete a mudanca ate o usuario recarregar a pagina.

## Conexoes Redundantes/Inativas Identificadas

1. **`useLinkedTransactions.ts`**: Hook que chama a funcao `check_linked_transactions` no banco. A funcao retorna sempre `{ has_linked_transactions: false }` (corpo vazio). Nao e utilizada em nenhum lugar visivel da aplicacao -- e codigo morto.

2. **`getProjectedValue()` em `Contratos.tsx`**: Calcula projecoes financeiras de contratos para KPIs do modulo de contratos, mas usa logica propria que **nao** respeita a distincao `isRecurringCashflow()` do `useCashFlow`. Contratos de mercadoria com recorrencia mensal e 3 meses de vigencia mostram valor multiplicado por 3 nos KPIs de contratos, contradizendo a correcao feita no fluxo de caixa.

3. **Campo `valor_realizado` nas projecoes de parcelas**: As projecoes de installments sempre setam `valor_realizado: null`, mesmo quando o status e "pago"/"recebido". O valor realizado deveria ser preenchido com o valor da parcela quando confirmada.

## Plano de Implementacao

### 1. Corrigir mapeamento de status no useCashFlow (arquivo: `src/hooks/useCashFlow.ts`)

Na linha 219, alterar a verificacao para reconhecer ambos os status de confirmacao:

```typescript
// De:
status: inst.status === "pago" ? "pago" : "previsto",
// Para:
status: (inst.status === "pago" || inst.status === "recebido") ? "pago" : "previsto",
```

E tambem preencher `valor_realizado` quando a parcela esta confirmada:

```typescript
valor_realizado: (inst.status === "pago" || inst.status === "recebido") ? Number(inst.valor) : null,
```

### 2. Adicionar invalidacao cruzada de cache (arquivo: `src/hooks/useContractInstallments.ts`)

No `onSuccess` do mutation `update`, alem de invalidar `contract_installments`, tambem invalidar as queries do fluxo de caixa:

```typescript
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ["contract_installments", contractId] });
  qc.invalidateQueries({ queryKey: ["cashflow_entries"] });
  qc.invalidateQueries({ queryKey: ["cashflow_installments"] });
},
```

### 3. Alinhar KPIs de contratos com logica do fluxo de caixa (arquivo: `src/pages/Contratos.tsx`)

Atualizar a funcao `getProjectedValue()` para usar a mesma distincao de `isRecurringCashflow()`. Contratos de mercadoria devem mostrar o valor unico, nao multiplicado pelo numero de meses.

### 4. Remover codigo morto (arquivo: `src/hooks/useLinkedTransactions.ts`)

Marcar ou remover o hook `useLinkedTransactions` e a funcao SQL `check_linked_transactions`, que nao tem implementacao real.

### Arquivos Modificados

- `src/hooks/useCashFlow.ts` -- correcao do status "recebido" e valor_realizado
- `src/hooks/useContractInstallments.ts` -- invalidacao cruzada de cache
- `src/pages/Contratos.tsx` -- alinhamento da funcao getProjectedValue
- `src/hooks/useLinkedTransactions.ts` -- remocao de codigo morto (opcional)
