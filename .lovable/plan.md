

# Corrigir Botões de Ativar nas Sugestões de Regras

## Diagnóstico

O componente `SuggestedRuleTemplates` possui os botões "Ativar" e "X" (ignorar) no código (linhas 173-192), porém na coluna esquerda do layout de 2 colunas (`lg:grid-cols-2`), o espaço horizontal limitado pode fazer com que os botões fiquem comprimidos ou ocultos por overflow. O container usa `flex items-center gap-2` sem `flex-wrap`, e a área de conteúdo com badges e keywords pode empurrar os botões para fora da área visível.

## Correção

**Arquivo**: `src/components/financeiro/SuggestedRuleTemplates.tsx`

1. Alterar o layout de cada item de template de `flex items-center` horizontal para um layout empilhado (vertical) em telas menores, garantindo que os botões sempre apareçam:
   - Mover os botões "Ativar" e "X" para uma linha separada abaixo da condição da regra, alinhados à direita
   - Usar `flex flex-col` no container do item, com uma sub-row para os botões

2. Tornar os botões mais proeminentes:
   - Botão "Ativar" com `variant="default"` (já é) mas com tamanho levemente maior (`h-8` em vez de `h-7`)
   - Garantir `min-w-fit` nos botões para evitar compressão

