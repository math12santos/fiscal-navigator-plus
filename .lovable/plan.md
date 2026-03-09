

# Onboarding Guiado — Foco por Etapa com Estrutura do Backoffice

## Problema

As etapas do onboarding mostram todas as seções abertas simultaneamente (ex: Step2 abre "Empresas", "Usuários" e "Áreas" ao mesmo tempo com `defaultValue={["companies", "users", "areas"]}`). O ideal é que cada etapa tenha foco em uma seção por vez, guiando o usuário de forma progressiva. Além disso, as etapas 2-9 possuem configuração editável no Backoffice (`onboarding_step_config`), mas essa estrutura (título, descrição, itens) não é refletida de forma consistente na tela do onboarding.

## Mudanças

### 1. Accordion com foco único nas etapas que usam Accordion

Alterar `Step2Estrutura` e `Step4EstruturaFinanceira` para usar `Accordion type="single" collapsible` em vez de `type="multiple" defaultValue=[...]`. Isso garante que apenas uma seção fique aberta por vez, mantendo o foco do usuário.

- **`Step2Estrutura.tsx`**: Mudar de `type="multiple" defaultValue={["companies","users","areas"]}` para `type="single" collapsible defaultValue="users"` (ou a primeira seção relevante)
- **`Step4EstruturaFinanceira.tsx`**: Mesma mudança — `type="single" collapsible`

### 2. Cabeçalho dinâmico das etapas baseado no Backoffice

Cada etapa (2-9) que possui implementação própria (Step2, Step3, etc.) mostra título e descrição hardcoded. Vamos fazer com que esses componentes consumam a configuração do backoffice via `useOnboardingConfig` para exibir o título, descrição e ícone cadastrados, com fallback para os valores atuais.

- Criar um componente reutilizável `StepHeader` que recebe o `stepNumber` e busca o config do backoffice
- Integrar nos componentes Step2 a Step9, substituindo os headers hardcoded

### 3. Itens de checklist do backoffice como guia visual

Para as etapas que usam `StepShell` (etapas sem implementação completa), o shell já mostra os itens do config. Para as etapas implementadas (2, 3, 4, 5, 6, 7, 8, 9), adicionar uma sidebar ou header com os itens do backoffice como checklist de progresso, mostrando ao usuário o que precisa ser feito naquela etapa.

## Arquivos Afetados

- **`src/components/onboarding-guiado/Step2Estrutura.tsx`** — Accordion single + header dinâmico
- **`src/components/onboarding-guiado/Step4EstruturaFinanceira.tsx`** — Accordion single + header dinâmico
- **`src/components/onboarding-guiado/StepHeader.tsx`** — Novo componente reutilizável para cabeçalho dinâmico baseado no backoffice config
- **`src/components/onboarding-guiado/Step3Integracoes.tsx`** — Header dinâmico
- **`src/components/onboarding-guiado/Step5Contratos.tsx`** — Header dinâmico
- **`src/components/onboarding-guiado/Step6Planejamento.tsx`** — Header dinâmico
- **`src/components/onboarding-guiado/Step7Rotinas.tsx`** — Header dinâmico
- **`src/components/onboarding-guiado/Step8Cockpit.tsx`** — Header dinâmico
- **`src/components/onboarding-guiado/Step9Assistida.tsx`** — Header dinâmico

## Detalhes Técnicos

- O `StepHeader` usa `useOnboardingConfig().getStepConfig(stepNumber)` para buscar título/descrição/ícone do backoffice, com fallback para valores hardcoded passados como props
- Accordion `type="single" collapsible` já é suportado pelo Radix — apenas mudar os props
- Nenhuma mudança de banco de dados necessária

