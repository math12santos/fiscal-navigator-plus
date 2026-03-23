

# Corrigir navegação na etapa Preview do ImportDialog

## Problema

Na etapa "Preview" do fluxo de importação, o botão "Voltar" chama `imp.buildPreview()`, que apenas reconstrói o preview em vez de retornar à etapa de mapeamento. O hook `useFinanceiroImport` não expõe uma função para navegar entre etapas.

O mesmo componente `ImportDialog` é usado tanto em Contas a Pagar quanto em Contas a Receber, então a correção resolve ambos.

## Correção

### 1. `src/hooks/useFinanceiroImport.ts`
- Expor uma função `goToMapping` que seta o step para `"mapping"` (mantendo headers, rows e mappings intactos para o usuário poder ajustar e voltar ao preview).
- Adicionar ao return do hook.

### 2. `src/components/financeiro/ImportDialog.tsx`
- No botão "Voltar" da etapa Preview (linha 320), trocar `imp.buildPreview()` por `imp.goToMapping()`.

Ambas são mudanças de 1-2 linhas. Os botões "Importar N lançamentos" e "Voltar" já existem visualmente — o problema é apenas funcional no "Voltar".

