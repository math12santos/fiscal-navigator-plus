

# Redesign do Editor de Diagnóstico no Backoffice

## Problemas Identificados

1. **Accordion dentro de Accordion**: O Step 1 abre dentro de um accordion geral, e dentro dele há seções com perguntas aninhadas — muita profundidade visual
2. **Excesso de campos técnicos visíveis**: Key, tipo, condicional, cor CSS — tudo aparece ao mesmo tempo para cada pergunta, criando ruído visual
3. **Sem preview**: O editor não mostra como a pergunta ficará para o usuário final
4. **Thresholds e perguntas misturados**: Os 3 blocos (seções, thresholds de maturidade, thresholds de complexidade) competem por atenção na mesma view
5. **Opções em grid denso**: Label + Value + Points + Delete em colunas apertadas, difícil de ler com muitas opções

## Proposta de Redesign

### 1. Separar em sub-abas internas (Tabs dentro do Step 1)

Em vez de tudo empilhado, dividir o editor do Step 1 em 3 tabs:
- **Perguntas** — Editor visual das seções e perguntas
- **Pontuação** — Thresholds de maturidade + complexidade
- **Preview** — Simulação read-only de como o diagnóstico aparece para o usuário

### 2. Modo colapsado para perguntas (Progressive Disclosure)

Cada pergunta mostra apenas uma linha resumo: `[tipo] Pergunta — X opções — Y pts max`. Ao clicar, expande para edição inline com os campos detalhados (key, tipo, condicional, opções). Reduz drasticamente o ruído visual.

### 3. Drag-and-drop visual para reordenação

Adicionar handle de arraste nas perguntas e seções para reordenar sem editar campo "order" manualmente. (Possível com CSS + lógica de swap, sem lib extra.)

### 4. Preview inline por seção

Na tab "Preview", renderizar as perguntas como o usuário final veria — usando os mesmos componentes de `Step1Diagnostico` mas em modo read-only. Permite ao admin validar o resultado sem sair do backoffice.

### 5. Campos técnicos em popover/drawer

Mover "Key", "Condicional" e "Tipo" para um popover "Configurações avançadas" acessível por um botão de engrenagem em cada pergunta. O fluxo principal fica limpo: label + opções.

## Mudanças Técnicas

### `OnboardingConfigTab.tsx`

- **Step1Config**: Substituir layout empilhado por `Tabs` com 3 abas (Perguntas, Pontuação, Preview)
- **QuestionsEditor**: Cada pergunta vira um card colapsável. Linha resumo mostra tipo (badge), label, contagem de opções e pontuação máxima. Expansão revela campos de edição
- **Campos técnicos**: Key, tipo e condicional movidos para um `Popover` acessível por ícone de engrenagem (Settings) no header da pergunta
- **OptionsEditor**: Manter grid mas com melhor espaçamento e labels mais claros
- **Preview tab**: Importar componentes de renderização do `Step1Diagnostico` em modo read-only para simular a experiência do usuário final
- **Seções**: Cada seção mostra resumo (nome, qtd perguntas, score máximo) e expande para editar

### Nenhuma mudança no banco de dados

A estrutura de dados JSON permanece idêntica. Apenas a interface de edição muda.

## Arquivos Afetados

- **`src/components/onboarding-guiado/OnboardingConfigTab.tsx`** — Redesign completo do `Step1Config` e `QuestionsEditor`

