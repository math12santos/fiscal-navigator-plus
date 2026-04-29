## Objetivo

No preview da importação (Financeiro → Importar CSV/XLS), ao clicar em uma linha marcada com **erro**, abrir um editor inline que permita corrigir os campos problemáticos (descrição, valor, data de vencimento, data de pagamento, fornecedor) **sem excluir a linha**. Quando todos os erros forem resolvidos, a linha passa automaticamente para "válida" e entra na importação — preservando a deduplicação já existente.

## Comportamento

1. Cada linha com badge "X erros" recebe um botão **Corrigir** (ícone de lápis) ao lado do badge.
2. Clicar abre um drawer/sheet lateral com:
   - Os 5 campos chave editáveis: Descrição, Valor (input numérico BR), Data Vencimento, Data Pagamento (opcional), Fornecedor.
   - Painel "Problemas detectados" listando cada erro com a solução sugerida (reaproveitando `financeiroImportErrors`).
   - Pré-visualização do payload corrigido.
3. Ao salvar:
   - Os valores em `parsedRow.mapped` são sobrescritos.
   - Os erros são re-validados (mesmas regras de `buildPreview`: descrição ausente, valor ausente/zero, data ausente/inválida).
   - Se `errors.length === 0`, a linha sai do estado de erro e fica elegível para importação automaticamente.
4. Botão **Cancelar** descarta as edições. Não há opção de "excluir" nesse fluxo (a exclusão continua disponível pelo checkbox da própria linha, conforme já existe).
5. Linhas duplicatas continuam destacadas em âmbar mesmo após edição.

## Implementação técnica

### `src/hooks/useFinanceiroImport.ts`

- Adicionar função `updateParsedRow(index: number, patch: Partial<ParsedRow["mapped"]>)`:
  - Atualiza `mapped` da linha.
  - Re-roda a validação de campos obrigatórios (mesmas regras das linhas 289-291): `descricao`, `valor_previsto != null && != 0`, `data_prevista`.
  - Recalcula `errors` (limpando os antigos relativos a esses campos).
  - Atualiza `parsedRows` imutavelmente.
- Exportar `updateParsedRow` no `return`.

### `src/components/financeiro/ImportDialog.tsx`

- Importar `Sheet` (shadcn) ou usar `Dialog` aninhado controlado por `editingRowIndex: number | null`.
- No `<TableCell>` do Status (linha 447-460), quando `hasErrors`, renderizar:
  - Badge de erros (mantém tooltip atual).
  - Botão `Pencil` pequeno → `setEditingRowIndex(i)`.
- Novo componente local `RowErrorEditor` (mesmo arquivo, ~80 linhas):
  - Props: `row`, `index`, `onSave(patch)`, `onClose`.
  - Estado local com os 5 campos.
  - Lista de erros + dicas via `summarizeRowErrors([row])`.
  - Botão Salvar chama `imp.updateParsedRow(index, patch)` e fecha.

### Validação após edição

Reutilizar exatamente as três checagens existentes para garantir consistência com o resto do fluxo (deduplicação intra-arquivo, pré-check de banco e `source_ref` determinístico permanecem intocados — a linha corrigida participa naturalmente desses passos).

## Arquivos afetados

- `src/hooks/useFinanceiroImport.ts` — nova função `updateParsedRow` + export.
- `src/components/financeiro/ImportDialog.tsx` — botão "Corrigir" na coluna Status + componente `RowErrorEditor` inline.

## Fora do escopo

- Edição em massa (bulk edit) de erros do mesmo tipo — pode ser uma evolução futura.
- Edição de campos secundários (categoria, centro de custo) — esses não geram erros bloqueantes.
- Alterações no fluxo de deduplicação ou no pipeline de batch (já robusto).
