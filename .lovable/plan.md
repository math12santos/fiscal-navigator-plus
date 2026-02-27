

# Revisao da Logica de Integracao Contratos x Fluxo de Caixa

## Problema Identificado

A funcao `generateProjectionsFromContract` em `useCashFlow.ts` trata **todos** os contratos com recorrencia da mesma forma: se um contrato tem `tipo_recorrencia = "mensal"` e dura 3 meses, o sistema gera 3 lancamentos no fluxo de caixa.

Isso esta correto para **servicos recorrentes** (assinatura mensal de software, contrato de limpeza, etc.), mas esta **errado para mercadorias/produtos**. Um contrato de venda de mercadoria com vigencia de 3 meses representa uma unica transacao comercial com prazo de entrega ou garantia -- nao implica cobranças mensais.

## Regras de Negocio Corrigidas

| Operacao | Subtipo | Comportamento no Fluxo de Caixa |
|----------|---------|--------------------------------|
| Compra/Venda | Servicos (recorrentes, terceirizacao) | Gera projecoes recorrentes conforme `tipo_recorrencia` |
| Compra/Venda | Mercadoria | Entrada unica (ou parcelas manuais via installments) |
| Compra/Venda | Material de Uso e Consumo | Entrada unica (ou parcelas manuais) |
| Compra/Venda | Servicos pontuais / tecnicos / projeto | Entrada unica (ou parcelas manuais) |
| Patrimonio | Investimento / Venda de Ativo | Entrada unica (ou parcelas manuais) |

Resumindo: **somente servicos com finalidade recorrente** devem gerar projecoes automaticas repetidas. Todos os demais tipos devem se comportar como contratos "unico" no fluxo de caixa, usando parcelas manuais (installments) quando necessario.

## Solucao Tecnica

### 1. Criar funcao auxiliar para determinar se contrato e recorrente no fluxo de caixa

Em `useCashFlow.ts`, adicionar uma funcao:

```typescript
function isRecurringCashflow(contract: Contract): boolean {
  if (contract.tipo_recorrencia === "unico") return false;
  
  // Somente servicos recorrentes geram projecoes automaticas
  const isServicos = contract.subtipo_operacao === "servicos";
  if (!isServicos) return false;
  
  // Servicos pontuais e por projeto nao sao recorrentes no fluxo
  const nonRecurringFinalidades = [
    "servicos_pontuais", 
    "servicos_tecnicos", 
    "servicos_contrato"
  ];
  if (contract.finalidade && nonRecurringFinalidades.includes(contract.finalidade)) {
    return false;
  }
  
  return true;
}
```

### 2. Atualizar `generateProjectionsFromContract`

Substituir a verificacao `if (contract.tipo_recorrencia === "unico") return projections;` por `if (!isRecurringCashflow(contract)) return projections;`.

### 3. Atualizar query de installments em `useCashFlow`

Atualmente o hook so busca installments para contratos com `tipo_recorrencia === "unico"`. Precisa expandir para buscar installments de **todos os contratos que nao sao recorrentes no fluxo de caixa**:

```typescript
const nonRecurringContractIds = useMemo(
  () => contracts
    .filter((c) => c.status === "Ativo" && !isRecurringCashflow(c))
    .map((c) => c.id),
  [contracts]
);
```

### 4. Gerar entrada unica para contratos sem parcelas

Para contratos de mercadoria/produto que nao tem installments cadastrados, gerar uma **unica** projecao na `data_inicio` (ou `data_fim` se for recebimento ao final) do contrato, em vez de multiplas entradas mensais.

Isso sera tratado na logica de `projectedEntries` no `useMemo`: se um contrato nao-recorrente nao possui installments, criar uma unica entrada virtual com o valor total do contrato na data de inicio.

### Arquivos Modificados

- `src/hooks/useCashFlow.ts` -- toda a logica de correcao concentrada neste arquivo

