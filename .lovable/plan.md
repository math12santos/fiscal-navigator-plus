

# Expansão de Folha por Funcionário — Two-Level Grouping

## Contexto

Atualmente, `usePayrollProjections` gera entradas **agregadas** (uma linha "Folha de Pagamento", uma "VT", etc.). O agrupamento em `FinanceiroTable` colapsa tudo em "Pessoal — MM/YYYY". O pedido é que, ao expandir o grupo Pessoal, cada sub-item (Folha, VT, Benefícios, Provisões) também seja expansível mostrando o detalhamento **por funcionário**.

## Plano

### 1. Modificar `usePayrollProjections` — gerar entradas por funcionário

Ao invés de agregar todos os colaboradores em uma única linha "Folha de Pagamento — MM/YYYY", gerar **uma entrada por funcionário por categoria**:

- `proj-dp-folha-{empId}-{monthKey}` → "Salário — João Silva" com valor = salário + encargos daquele funcionário
- `proj-dp-vt-{empId}-{monthKey}` → "VT — João Silva"
- `proj-dp-beneficios-{empId}-{monthKey}` → "Benefícios — João Silva"
- `proj-dp-provisoes-{empId}-{monthKey}` → "Provisões — João Silva"

Cada entrada incluirá um campo auxiliar `dp_sub_category` (ex: "folha", "vt", "beneficios", "provisoes") para permitir sub-agrupamento.

### 2. Atualizar `FinanceiroTable` — two-level grouping

Modificar a lógica de `displayRows` para suportar **sub-grupos** dentro de um grupo:

- **Nível 1**: "Pessoal — 03/2026" (soma total) → ao expandir mostra sub-grupos
- **Nível 2**: "Folha de Pagamento" (soma dos salários), "Vale Transporte" (soma VT), etc. → ao expandir mostra cada funcionário

Implementação:
- Agrupar entradas dp primeiro por `month`, depois por `dp_sub_category`
- Estado `expandedGroups` já existe; adicionar `expandedSubGroups` (Set) para o segundo nível
- Renderizar: grupo principal → sub-grupo (indentado) → entrada individual (mais indentada)

### 3. Atualizar `AgingListTab` — mesma lógica

Aplicar o mesmo padrão de sub-agrupamento no Aging List para consistência.

## Arquivos Afetados

- **`src/hooks/usePayrollProjections.ts`** — gerar entradas per-employee com `dp_sub_category`
- **`src/components/financeiro/FinanceiroTable.tsx`** — two-level expand (grupo → sub-grupo → funcionário)
- **`src/components/financeiro/AgingListTab.tsx`** — aplicar sub-agrupamento

