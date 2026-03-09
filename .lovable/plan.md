

# Etapas 8 e 9 do Onboarding Guiado

## Objetivo

Substituir o `StepShell` placeholder das etapas 8 e 9 por componentes funcionais. Sem mudanças no banco — usa campos existentes `cockpit_activated` e `assisted_start_date` da tabela `onboarding_progress`.

---

## Etapa 8 — Ativação do Cockpit

**Componente**: `src/components/onboarding-guiado/Step8Cockpit.tsx`

Tela de ativação dos dashboards financeiros com:

- **Resumo de prontidão**: Checklist visual mostrando o que já foi configurado nas etapas anteriores (contas, centros de custo, contratos, cenários, rotinas) com ícones verde/cinza baseado nos `completedSteps`
- **Preview dos dashboards**: Cards visuais representando os dashboards que serão liberados (Dashboard CFO, Dashboard Board, Fluxo de Caixa, Planejamento)
- **Botão "Ativar Cockpit"**: Salva `cockpit_activated: true` via `saveProgress()` e mostra confirmação visual
- **Estado ativado**: Após ativação, exibe badge de sucesso e mensagem de que os dashboards estão disponíveis

---

## Etapa 9 — Operação Assistida

**Componente**: `src/components/onboarding-guiado/Step9Assistida.tsx`

Configuração do período de acompanhamento pós-onboarding:

- **Explicação**: Card informativo sobre os primeiros 90 dias de operação assistida
- **Funcionalidades incluídas**: Checklist informativo (alertas de dados faltantes, sugestões de classificação, acompanhamento de preenchimento, relatórios semanais automáticos)
- **Data de início**: Campo de data para definir quando começa a operação assistida (default: hoje). Salva em `assisted_start_date`
- **Timeline visual**: Mostra marcos dos 90 dias (Semana 1-2: Setup, Semana 3-4: Ajustes, Mês 2-3: Otimização)
- **Botão "Iniciar Operação Assistida"**: Confirma a data e marca a etapa como configurada

---

## Integração no Wizard

**`src/pages/OnboardingGuiado.tsx`**:
- Importar `Step8Cockpit` e `Step9Assistida`
- Render para `currentStep === 8` e `currentStep === 9`
- Remover condição do StepShell (não há mais steps usando shell)
- Passar `completedSteps` como prop para Step8

## Arquivos

- **Novo**: `Step8Cockpit.tsx`, `Step9Assistida.tsx`
- **Editado**: `OnboardingGuiado.tsx` (imports + render, remover StepShell)

