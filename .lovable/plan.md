

# Melhorias de Empty States na Aba de Aglutinação

## 1. Macrogrupos — Estado vazio com ativação seletiva

**Problema**: Tela vazia genérica + botão "Gerar Padrão" cria tudo de uma vez.

**Solução**: Substituir o empty state por uma **lista visual dos 10 macrogrupos sugeridos** (do `DEFAULT_SEED`), cada um como um card compacto mostrando nome, cor, ícone e lista de subgrupos. Cada card terá:
- Botão **"Ativar"** — cria apenas aquele macrogrupo + seus grupos no banco
- Botão **"Ignorar"** — esconde da lista (estado local, sem persistência)
- Botão geral **"Ativar Todos"** no topo para quem quer tudo de uma vez

Ao ativar um macrogrupo, ele some da lista de sugestões e aparece na árvore real acima (ou a lista de sugestões desaparece quando todos foram ativados/ignorados).

**Arquivo**: `src/components/financeiro/GroupingMacrogroupManager.tsx`
- Renderizar `DEFAULT_SEED` como cards quando `macrogroups.length === 0` ou quando ainda há seeds não ativados
- Novo mutation `seedSingle` no hook que cria apenas 1 macrogrupo + seus grupos
- Comparar nomes existentes vs seed para saber quais já foram ativados

**Arquivo**: `src/hooks/useGroupingMacrogroups.ts`
- Exportar `DEFAULT_SEED` para uso no componente
- Adicionar mutation `seedSingleMacrogroup(seedIndex: number)` que cria apenas aquele item do seed

## 2. Regras — Estado vazio com exemplos didáticos

**Problema**: Mostra só ícone + "Nenhuma regra encontrada".

**Solução**: Quando `filteredRules.length === 0` e não há filtros ativos, mostrar **3 cards de exemplo** estáticos (não clicáveis, apenas ilustrativos):

| Exemplo | Visual |
|---------|--------|
| Se **Categoria** = Benefícios → Grupo Benefícios | Badge "Categoria" + Badge "é igual a" + "Benefícios" → seta → "Benefícios" |
| Se **Fornecedor** contém "CPFL" → Energia | Badge "Fornecedor" + Badge "contém" + "CPFL" → seta → "Energia" |
| Se **Descrição** contém "aluguel" → Grupo Aluguel | Badge "Descrição" + Badge "contém" + "aluguel" → seta → "Aluguel" |

Abaixo dos exemplos, botão **"Criar sua primeira regra"**.

**Arquivo**: `src/components/financeiro/GroupingConfigTab.tsx` (linhas ~256-259, o bloco de empty state das regras)

## 3. Fallback — Cards configuráveis

**Problema**: Zona 4 é um bloco simples com texto + botões condicionais.

**Solução**: Transformar em **2 cards lado a lado**:

**Card 1 — Grupo Destino Fallback**
- Mostra o grupo destino atual (hardcoded "Não Classificado" por ora)
- Badge com contagem de itens sem regra
- Valor total em BRL

**Card 2 — Ações**
- Botão "Revisar Agora" → abre a lista de não classificados inline
- Botão "Criar Regra" → abre o dialog de regra
- Botão "Testar Regras" → popula simulação com não classificados

**Arquivo**: `src/components/financeiro/GroupingConfigTab.tsx` (linhas ~369-434, Zona 4)

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useGroupingMacrogroups.ts` | Exportar `DEFAULT_SEED`, adicionar `seedSingleMacrogroup` mutation |
| `src/components/financeiro/GroupingMacrogroupManager.tsx` | Empty state com cards de sugestão seletiva |
| `src/components/financeiro/GroupingConfigTab.tsx` | Exemplos didáticos nas regras + cards no fallback |

