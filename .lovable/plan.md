
# Reconciliação de Fornecedores/Clientes na Importação

## Problema

A importação captura o campo `entity_name` (Fornecedor/Cliente) como texto livre, mas não vincula ao cadastro de entidades (`entities`). Isso gera registros órfãos — o sistema exibe nomes de fornecedores que não existem formalmente, impedindo rastreabilidade e governança.

## Solução

Adicionar uma etapa de **reconciliação de entidades** entre o Preview e a Importação. Nessa etapa o sistema cruza os nomes importados com o cadastro existente e apresenta o resultado ao usuário.

## Fluxo atualizado

```text
Upload → Mapeamento → Preview → RECONCILIAÇÃO DE ENTIDADES → Importação
```

## Mudanças

### 1. Nova etapa `entity_matching` no hook `useFinanceiroImport.ts`

- Adicionar step `"entity_matching"` ao tipo `ImportStep`
- Após o Preview, ao clicar "Próximo", extrair todos os valores únicos de `entity_name` dos `parsedRows` válidos
- Buscar entidades existentes da org via `supabase.from("entities").select("id, name, document_number, type")`
- Fazer matching por similaridade (normalização: lowercase, trim, remoção de acentos e pontuação)
- Classificar cada nome importado como:
  - **Encontrado** (match exato ou muito próximo) — vincula automaticamente ao `entity_id`
  - **Possível match** (similaridade parcial) — sugere candidato para confirmação
  - **Não encontrado** — oferece cadastro rápido ou ignorar
- Armazenar um mapa `entityNameToId: Record<string, string | null>` no state

### 2. Novo componente `EntityMatchingStep.tsx`

Tabela com colunas:
- Nome importado
- Status (Encontrado / Possível / Novo)
- Entidade sugerida (dropdown com busca para trocar)
- Ação: "Criar cadastro" (abre EntityFormDialog com nome pré-preenchido) ou "Ignorar"

Indicadores no topo:
- X encontrados automaticamente
- Y para revisar
- Z não encontrados

Botão "Cadastrar todos não encontrados" para criação em lote (tipo baseado no `tipo` da importação: saida→fornecedor, entrada→cliente).

### 3. Atualizar `executeImport` no hook

- Ao montar cada `cashflow_entry`, incluir `entity_id` do mapa de reconciliação quando disponível
- Manter `entity_name` como campo de texto para referência (campo já existe na importação)

### 4. Atualizar `ImportDialog.tsx`

- Renderizar a nova etapa entre Preview e Importing
- Footer com botões "Voltar ao Preview" e "Importar N lançamentos"
- A etapa só aparece se houver pelo menos um `entity_name` nos dados importados; caso contrário, pula direto para importação

### 5. Lógica de matching (normalização)

```typescript
function normalize(s: string): string {
  return s.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

function similarity(a: string, b: string): number {
  // Token-based: % de tokens em comum
  const ta = new Set(normalize(a).split(" "));
  const tb = new Set(normalize(b).split(" "));
  const inter = [...ta].filter(t => tb.has(t)).length;
  return inter / Math.max(ta.size, tb.size);
}
// >= 0.9 → match automático, >= 0.6 → possível, < 0.6 → não encontrado
```

## Arquivos envolvidos

- `src/hooks/useFinanceiroImport.ts` — novo step, estado de matching, lógica de normalização
- `src/components/financeiro/EntityMatchingStep.tsx` — novo componente visual
- `src/components/financeiro/ImportDialog.tsx` — integrar nova etapa no fluxo
- Nenhuma migração SQL — `cashflow_entries` já possui coluna `entity_id`

## Detalhes técnicos

- O matching usa normalização de texto client-side (sem IA) para ser instantâneo
- A criação de entidades usa a mutation `create` do `useEntities` existente
- O campo `entity_id` em `cashflow_entries` já existe e aceita UUID nullable — basta populá-lo na importação
