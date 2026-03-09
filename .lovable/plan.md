# Atualizar Gestão de Onboarding no Backoffice

## Problema

O `OnboardingConfigTab` (backoffice) ainda usa o editor genérico de perguntas (`QuestionsEditor`) que não suporta os novos tipos de pergunta implementados no Step1 (`select_input`, `number_input`, `conditional`), nem o score de complexidade por seção. O administrador não consegue editar adequadamente a fase Estrutura com suas particularidades.

## Mudanças

### `OnboardingConfigTab.tsx` — Atualizar `Step1Config` e `QuestionsEditor`

1. **QuestionsEditor ampliado**: Adicionar campos para `type` (radio/select_input/number_input) e lógica `conditional` (key + value) em cada pergunta
2. **Complexity Thresholds**: Adicionar seção editável para os thresholds de complexidade por seção (Baixa/Média/Alta/Muito Alta com min/max)
3. **Preview do tipo**: Mostrar badge do tipo da pergunta (radio, select_input, number_input) ao lado de cada pergunta no editor
4. **Campo conditional**: Cada pergunta ganha campos opcionais "Conditional Key" e "Conditional Value" para definir visibilidade condicional
5. Crie Tooltips para dar contexto ao editor do onboarding. 

### Campos novos por pergunta no editor


| Campo               | Tipo             | Descrição                                 |
| ------------------- | ---------------- | ----------------------------------------- |
| `type`              | select           | radio, select_input, number_input         |
| `conditional.key`   | input (opcional) | Key da pergunta que controla visibilidade |
| `conditional.value` | input (opcional) | Valor que ativa a pergunta                |


### Seção nova: Thresholds de Complexidade

Ao lado dos thresholds de maturidade existentes, adicionar editor para `complexity_thresholds` com campos: label, min, max, color.

## Arquivo Afetado

- `**src/components/onboarding-guiado/OnboardingConfigTab.tsx**` — Atualizar QuestionsEditor com suporte a type/conditional, adicionar editor de complexity thresholds no Step1Config