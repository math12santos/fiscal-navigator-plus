

# Refinamento da Aglutinação no Aging List — Baseado em Data de Vencimento

## Correção de Premissa

O Aging List é uma ferramenta de **análise diária da rotina de pagamentos**, pautada pela **data de vencimento** (`data_vencimento`), não pelo mês de competência. A aglutinação atual agrupa por `categoria + mês de competência` (usando `data_prevista`), o que está errado para esse contexto.

## O que muda

### Arquivo: `src/components/financeiro/AgingListTab.tsx`

**1. Critério de agrupamento: vencimento, não competência**

Dentro de cada bucket do aging (ex: "Vencido 1-30d", "Vence em 7d"), as entradas já estão segmentadas por prazo de vencimento. A aglutinação deve agrupar **por categoria/fonte** dentro de cada bucket — sem referência ao mês.

- Chave de grupo: `aging-{bucketLabel}-{categoria ?? source}` (sem mês)
- Label: apenas a categoria (ex: "Pessoal", "Impostos", "Contratos") com badge de contagem

**2. Aglutinação universal (não só DP)**

Remover `GROUPABLE_SOURCES` como filtro exclusivo. Qualquer categoria/fonte com 2+ entradas no mesmo bucket será agrupada:
- "Pessoal" → sub-agrupa por `dp_sub_category` (Folha, VT, etc.) → funcionários
- "Contratos" → sub-agrupa por entidade/fornecedor se disponível
- Outras categorias (Impostos, Serviços, etc.) → expande direto para entradas

**3. Sub-agrupamento inteligente por tipo**

Dentro de um grupo expandido:
- Se `source === "dp"`: sub-agrupar por `dp_sub_category` (já funciona)
- Se `source === "contrato"`: sub-agrupar por `entity_id` ou descrição do contrato
- Demais: mostrar entradas diretamente (sem nível intermediário)

### Arquivo: `src/components/financeiro/FinanceiroTable.tsx`

Sem alterações — o Contas a Pagar **é** pautado por competência, então a lógica atual está correta para aquela view.

## Resumo das Mudanças

| Item | Antes | Depois |
|------|-------|--------|
| Chave de grupo | `categoria + mês` | `categoria` (dentro do bucket) |
| Fontes agrupáveis | Só `dp` / `Pessoal` | Qualquer com 2+ itens |
| Sub-grupo DP | Por `dp_sub_category` | Mantém |
| Sub-grupo contratos | Não existia | Por entidade/contrato |
| Sub-grupo outros | Não existia | Expande direto |

## Arquivo Afetado

- `src/components/financeiro/AgingListTab.tsx` — refatorar `renderBucketRows`

