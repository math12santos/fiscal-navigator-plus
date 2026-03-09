# Etapa 1 Diagnóstico — Fase Estrutura Detalhada

## Objetivo

Redesenhar a fase "Estrutura" do diagnóstico com perguntas detalhadas para mapear porte, complexidade societária e maturidade da equipe financeira. Essa fase terá seu score próprio de complexidade que será exposto no cadastro da empresa no Backoffice.   
  
O painel de configurações do backoffice para o Onboarding deve ser atualizado com ferramenta suficiente para editar essa etapa. 

## Novas Perguntas da Fase Estrutura


| Pergunta                            | Tipo                | Opções                                                                                     | Pontos       |
| ----------------------------------- | ------------------- | ------------------------------------------------------------------------------------------ | ------------ |
| Faturamento médio mensal            | radio               | Até R$50k (0), R$50k-R$500k (1), R$500k-R$2M (2), Acima de R$2M (3)                        | complexidade |
| Segmento de atuação                 | select/input        | Comércio, Serviços, Indústria, Tecnologia, Outro                                           | contextual   |
| Quantidade de sócios                | radio               | 1 (0), 2-3 (1), 4+ (2)                                                                     | complexidade |
| Distribuição societária             | radio               | Igualitária (0), Majoritário único (1), Complexa/múltiplos (2)                             | complexidade |
| Responsável formal pelo financeiro? | radio               | Sim/Não                                                                                    | condicional  |
| Se sim, qual o cargo?               | radio (condicional) | Administrador (1), Gerente Financeiro (2), CFO (3)                                         | complexidade |
| Tamanho da equipe financeira        | radio               | Não existe (0), 1 pessoa (1), 2-5 (2), 6+ (3)                                              | complexidade |
| Quantos bancos a empresa usa?       | radio               | 1 (0), 2-3 (1), 4+ (4)                                                                     | complexidade |
| Quantas contas bancárias existem?   | radio               | 1 ponto a cada conta bancária existente, acima de 5 contas acrescentar 2 pontos por conta. | complexidade |


## Score de Complexidade

Essa fase terá seu próprio score calculado e exibido com uma badge (ex: "Complexidade: Baixa / Média / Alta / Muito Alta"), com thresholds definidos no fallback e configuráveis pelo backoffice.

## Mudanças Técnicas

### `Step1Diagnostico.tsx`

- Substituir as 3 perguntas genéricas da fase "estrutura" pelas 9 perguntas detalhadas acima
- Adicionar lógica condicional: campo "cargo do responsável" só aparece se `responsavel_financeiro === "sim"`
- Adicionar campo de texto livre para "Segmento de atuação" (input com sugestões)
- Ao final de cada seção do Accordion, exibir um mini-card com o score de complexidade daquela fase
- Manter o score geral de maturidade (soma de todas as fases)

### Score por Fase

- Calcular `sectionScore` para cada seção individualmente
- Exibir badge de complexidade dentro do `AccordionContent`, após as perguntas
- Thresholds por fase: 0-3 Baixa, 4-6 Média, 7-9 Alta, 10+ Muito Alta

### Estrutura de dados

- Todas as respostas continuam salvando em `answers` (Record<string, string>) via `onChange`
- Novas keys: `faturamento_mensal`, `segmento`, `qtd_socios`, `distribuicao_societaria`, `responsavel_financeiro`, `cargo_responsavel`, `equipe_financeira`, `qtd_bancos`, `qtd_contas_bancarias`
- Backward-compatible: respostas antigas são ignoradas se não existirem

### Fallback atualizado

As perguntas ficam no `FALLBACK_SECTIONS[0]` (key "estrutura") com todas as opções e pontos. O backoffice pode sobrescrever via `onboarding_step_config`.

## Arquivos Afetados

- `**src/components/onboarding-guiado/Step1Diagnostico.tsx**` — Reescrever fase Estrutura com perguntas detalhadas, lógica condicional, score por fase