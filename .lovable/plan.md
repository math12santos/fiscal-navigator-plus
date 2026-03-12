

# Sugestão Automática de Classificação + Anexos na Solicitação de Despesa

## 1. Hook `useSupplierClassificationHistory`

**Novo arquivo**: `src/hooks/useSupplierClassificationHistory.ts`

Query `cashflow_entries` filtrado por `entity_id` + `organization_id`, agrupando pelo último `account_id` e `cost_center_id` usados para aquele fornecedor. Retorna `{ suggestedAccountId, suggestedCostCenterId }`.

Usado em `ExpenseRequestButton` e `ClassificacaoDialog` — quando o usuário seleciona um fornecedor, auto-preenche conta e centro de custo com a última classificação usada, com badge "Sugestão baseada no histórico".

## 2. Storage Bucket `request-attachments`

**Migração SQL**: Criar bucket `request-attachments` (privado) com políticas RLS de upload (org member) e leitura (org member via request ownership).

## 3. Anexos no `ExpenseRequestButton`

Adicionar seção de upload de arquivos (PDF/XML) após a justificativa:
- Input `type="file"` aceitando `.pdf,.xml`
- Lista de arquivos selecionados com botão remover
- Após criar a request, fazer upload dos arquivos para `request-attachments/{orgId}/{requestId}/` e inserir registros em `request_attachments`
- Limite: 5 arquivos, 20MB cada

## 4. Mostrar anexos no `ClassificacaoDialog`

Na seção "Contexto da Solicitação", listar anexos com links para download (signed URLs) para que o financeiro veja as NFs antes de classificar.

## 5. Auto-sugestão na `ClassificacaoDialog`

Quando `request.entity_id` existir, chamar o hook de histórico e pré-preencher `account_id` e `cost_center_id` automaticamente (se não já preenchidos pela request), com indicador visual de sugestão.

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useSupplierClassificationHistory.ts` | **Novo** — busca última classificação do fornecedor |
| `src/components/financeiro/ExpenseRequestButton.tsx` | Upload de anexos + auto-sugestão ao selecionar fornecedor |
| `src/components/financeiro/ClassificacaoDialog.tsx` | Exibir anexos + auto-sugestão de classificação |
| Migração SQL | Criar bucket `request-attachments` + RLS |

