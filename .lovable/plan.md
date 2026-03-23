

# Inverter tabela de mapeamento: mostrar campos do sistema (PARA) como linhas

## Problema atual

A tabela de mapeamento mostra uma linha por **coluna do arquivo** (DE), com um dropdown para selecionar o campo do sistema (PARA). Se o arquivo não tem uma coluna que a IA mapeie para "Descrição", esse campo obrigatório fica invisível — o usuário não sabe que precisa atribuí-lo.

## Solução

Inverter a perspectiva da tabela: cada linha será um **campo do sistema** (PARA), e o dropdown permitirá escolher qual **coluna do arquivo** (DE) o alimenta. Campos não mapeados mostrarão "Ignorar / Não importar" por padrão.

### 1. `src/hooks/useFinanceiroImport.ts`

- Mudar a estrutura de `mappings` e `updateMapping` para trabalhar com chave = target_field em vez de source_column.
- Novo `updateMappingByTarget(targetField, sourceColumn)`: atualiza qual coluna do arquivo está atribuída a cada campo do sistema.
- Construir o mapeamento inicial a partir da resposta da IA, preenchendo todos os TARGET_FIELDS (não apenas os que a IA encontrou) — os não detectados começam com source `""` (ignorar).

### 2. `src/components/financeiro/ImportDialog.tsx`

- Na etapa "mapping", iterar sobre `TARGET_FIELDS` (não mais sobre `imp.mappings`).
- Cada linha mostra:
  - **Campo do sistema (PARA)**: nome do campo + badge "Obrigatório" se aplicável
  - **Coluna do arquivo (DE)**: dropdown com todas as `rawHeaders` + opção "— Não importar —"
  - **Confiança**: badge da confiança da IA (se mapeado)
- O dropdown exibirá as colunas do arquivo disponíveis.
- Campos obrigatórios sem coluna atribuída ficam destacados em amarelo.
- Remover o aviso separado de "campos obrigatórios faltantes" pois agora está visível na própria tabela.

### Layout da tabela (invertido)

```text
┌──────────────────────┬──────────┬──────────────────────────┐
│ Campo do sistema     │ Status   │ Coluna do arquivo (DE)   │
├──────────────────────┼──────────┼──────────────────────────┤
│ Descrição *          │ ⚠ —      │ [dropdown: headers]      │
│ Valor *              │ ✓ Alta   │ [dropdown: Valor_Total]  │
│ Data Vencimento *    │ ✓ Alta   │ [dropdown: Dt_Venc]      │
│ Data Pagamento       │ — —      │ [dropdown: —]            │
│ Fornecedor / Cliente │ ✓ Média  │ [dropdown: Razao_Social] │
│ ...                  │          │                          │
└──────────────────────┴──────────┴──────────────────────────┘
```

### Mudanças detalhadas

**`useFinanceiroImport.ts`**:
- Adicionar tipo `TargetMappingItem = { target_field: string; source_column: string | null; confidence: ... }`
- Após receber mapeamentos da IA, construir array com todos os TARGET_FIELDS, preenchendo source_column dos que foram mapeados e `null` para os demais
- Nova função `updateMappingByTarget(target, source)` que atualiza a source_column do target indicado
- Manter `buildPreview` funcionando com a nova estrutura (já usa `mappings.forEach` que continua compatível)

**`ImportDialog.tsx`**:
- Trocar iteração de `imp.mappings` para `TARGET_FIELDS`, buscando o mapeamento correspondente
- Dropdown agora lista `rawHeaders` + opção vazia "— Não importar —"
- Campos obrigatórios sem source ficam destacados
- Remover campo "Ignorar" do dropdown de targets (não faz mais sentido nesta direção)

