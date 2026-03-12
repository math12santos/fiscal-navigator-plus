

# Correção da Projeção de Folha: Custo Total → Fluxo de Pagamentos

## Problema

Em `usePayrollProjections.ts` (linha 98), a sub-categoria "folha" gera **uma única entrada** com `salary + encargos` (custo total para a empresa). Isso é correto para análise de custo, mas **incorreto para fluxo de pagamentos** — na prática, existem **obrigações de pagamento separadas**:

| Obrigação | Destinatário | Valor |
|-----------|-------------|-------|
| Salário Líquido | Colaborador | Salário - INSS empregado - IRRF |
| FGTS | Caixa Econômica | 8% do salário |
| INSS (patronal + empregado) | Receita Federal | INSS patronal + INSS empregado |
| IRRF | Receita Federal | Calculado pela tabela progressiva |
| RAT + Terceiros | Receita Federal | RAT% + Terceiros% do salário |

## Solução

Desmembrar a entrada "folha" em **4 sub-categorias de pagamento** distintas, cada uma como uma entrada virtual separada:

1. **`salario_liquido`** — Valor líquido pago ao colaborador (salário - INSS empregado - IRRF)
2. **`encargos_fgts`** — FGTS depositado na CEF
3. **`encargos_inss`** — GPS (INSS patronal + empregado + RAT + Terceiros)
4. **`encargos_irrf`** — DARF de IRRF retido

As sub-categorias existentes (`vt`, `beneficios`, `provisoes`) permanecem inalteradas.

## Arquivo: `src/hooks/usePayrollProjections.ts`

Substituir o bloco da linha 90-111 (entrada única "folha") por 4 entradas separadas usando as funções `calcINSSEmpregado` e `calcIRRF` já existentes em `useDP.ts`:

```text
// Antes (1 entrada):
folha: salary + encargos  →  "Salário — João"

// Depois (4 entradas):
salario_liquido: salary - inssEmp - irrf  →  "Salário Líquido — João"
encargos_fgts:   salary * fgtsPct          →  "FGTS — João"
encargos_inss:   inssPatronal + inssEmp + rat + terceiros  →  "GPS/INSS — João"
encargos_irrf:   irrf                      →  "IRRF — João"
```

Atualizar `SUB_CATEGORY_LABELS` para incluir os novos rótulos:
```typescript
const SUB_CATEGORY_LABELS = {
  salario_liquido: "Salário Líquido",
  encargos_fgts: "FGTS",
  encargos_inss: "INSS / GPS",
  encargos_irrf: "IRRF",
  vt: "Vale Transporte",
  beneficios: "Benefícios",
  provisoes: "Provisões (13º + Férias)",
};
```

Cada entrada terá no campo `notes` o detalhamento do cálculo (ex: `"Base: 5000 | INSS Emp: 450 | IRRF: 230 | Líquido: 4320"`).

## Impacto nos Consumidores

Os componentes que usam `dp_sub_category` para agrupar (FinanceiroTable, AgingListTab) já suportam qualquer string — basta que `SUB_CATEGORY_LABELS` tenha a tradução. Nenhuma mudança necessária nesses componentes.

## Arquivo afetado

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePayrollProjections.ts` | Desmembrar "folha" em 4 entradas de pagamento; importar `calcINSSEmpregado`, `calcIRRF` de `useDP` |

