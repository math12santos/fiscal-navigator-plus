

# Classificação de Pendências: Materializar em vez de Duplicar

## Problema

Ao clicar "Classificar" no Painel de Pendências, o sistema abre o formulário de nova despesa com dados parciais. Isso viola MECE porque as projeções já existem na tabela (entries com id `proj-dp-*` ou `proj-*`). Criar uma nova entrada gera duplicidade.

O fluxo correto é **materializar** as projeções existentes — convertê-las em entradas reais no banco, usando `markAsPaid` (que já tem lógica de materialização para projeções).

## Solução

### 1. PendenciasPanel — passar projeções relacionadas

**Arquivo**: `src/components/financeiro/PendenciasPanel.tsx`

Alterar a interface: em vez de `onClassify(prefill)`, chamar `onClassify(projectedEntries[])` com as entradas projetadas reais do mês que precisam ser materializadas.

- **DP**: filtrar `entries` por `source === "dp"` e `id.startsWith("proj-")` no mês corrente → passar esse array
- **Contrato**: filtrar `entries` por `contract_id === c.id` e `id.startsWith("proj-")` no mês corrente → passar essa entrada

Mudar o tipo da pendência para incluir `entries: FinanceiroEntry[]` com as projeções encontradas.

### 2. Novo componente: MaterializeDialog

**Arquivo**: `src/components/financeiro/MaterializeDialog.tsx` (novo)

Dialog que mostra uma tabela/lista das projeções a materializar com:
- Checkbox por item (todos selecionados por padrão)
- Descrição, valor previsto, data prevista (read-only, vindos da projeção)
- Campo editável: `data_realizada` (padrão: hoje) e `valor_realizado` (padrão: valor_previsto)
- Botão "Confirmar Classificação" que chama `markAsPaid` para cada entrada selecionada

Isso reutiliza a lógica existente de materialização (`markAsPaid` com `isProjected: true`) que já insere no banco e de-duplica.

### 3. ContasAPagar — trocar handler

**Arquivo**: `src/components/financeiro/ContasAPagar.tsx`

- Adicionar state `materializeEntries` (array de projeções a materializar)
- `handleClassify` recebe o array de entries projetadas e abre `MaterializeDialog` em vez de `FinanceiroEntryDialog`
- Manter `FinanceiroEntryDialog` apenas para o botão "Nova Despesa" (criação manual genuína)

### 4. PendenciasPanel — ajustar detecção

Corrigir a lógica de detecção para considerar que projeções EXISTEM (geradas pelo hook) mas não estão MATERIALIZADAS. Atualmente o painel verifica se há projeções e não mostra a pendência se houver — isso está incorreto para contratos, pois a projeção existe mas precisa ser classificada.

Remover a condição `if (!hasProjection)` para contratos: a pendência deve aparecer enquanto não houver entrada materializada, independente de haver projeção.

## Fluxo MECE resultante

```text
Projeção virtual (proj-dp-*) ──[Classificar]──> MaterializeDialog ──[Confirmar]──> cashflow_entries (real)
                                                                                    ↓
                                                            Projeção desaparece da lista (de-dup automático)
                                                            Pendência desaparece do painel
```

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/financeiro/MaterializeDialog.tsx` | Novo — dialog de revisão e confirmação em batch |
| `src/components/financeiro/PendenciasPanel.tsx` | Passar entries projetadas em vez de prefill |
| `src/components/financeiro/ContasAPagar.tsx` | Usar MaterializeDialog para classificação |

