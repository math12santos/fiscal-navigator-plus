# Etapas 5, 6 e 7 do Onboarding Guiado

## Objetivo

Substituir os placeholders `StepShell` das etapas 5, 6 e 7 por componentes funcionais que usam hooks existentes. Sem mudanças no banco de dados.

---

## Etapa 5 — Cadastro de Contratos

**Componente**: `src/components/onboarding-guiado/Step5Contratos.tsx`

Usa `useContracts()` existente.

- Lista contratos cadastrados (nome, tipo, valor, status) em tabela simples
- Badge com contagem total
- Formulário inline simplificado para criar contrato rápido:
  - Nome, Tipo (receita/despesa/investimento), Valor, Recorrência, Data início
- Botão para abrir o formulário completo (`ContractFormDialog` existente) para contratos mais detalhados
- Sincroniza `contracts_data` no progress: `{ contracts_count: N, total_valor: X }`

---

## Etapa 6 — Planejamento Financeiro

**Componente**: `src/components/onboarding-guiado/Step6Planejamento.tsx`

Usa `useBudget()` e `usePlanningScenarios()` existentes.

### Seção 1: Orçamento

- Lista versões de orçamento existentes
- Botão para criar versão rápida (nome, período, status draft)
- Badge com contagem

### Seção 2: Cenários

- Lista cenários existentes (nome, tipo: base/conservador/otimista)
- Botão para criar cenário rápido com defaults (nome, tipo, variações)
- Badge com contagem

### Seção 3: Configurações de Liquidez

- Usa `usePlanningConfig()` existente
- Campos: saldo mínimo, colchão de liquidez, alerta de runway (meses)
- Salva via upsert

Sincroniza `planning_data`: `{ budget_versions_count: N, scenarios_count: N, config_set: true/false }`

---

## Etapa 7 — Rotinas Financeiras

**Componente**: `src/components/onboarding-guiado/Step7Rotinas.tsx`

Etapa de configuração de rotinas sugeridas. Sem tabela nova — salva checklist no JSONB `routines_data` do `onboarding_progress`.

- 3 seções (Accordion): Diárias, Semanais, Mensais
- Cada seção tem checklist de rotinas sugeridas com checkbox
- O usuário marca quais rotinas pretende adotar
- Agenda de rotina integrada ao Google Calendar
- Dados salvos: `{ daily: ["conciliacao", "saldo"], weekly: ["fluxo_caixa"], monthly: ["dre", "fechamento"] }`

Rotinas sugeridas pré-definidas:

- **Diárias**: Conciliação bancária, Atualização de saldo, Conferência de recebimentos, Aprovação de pagamentos
- **Semanais**: Revisão de fluxo de caixa, Análise de inadimplência, Pré Aprovação de pagamentos
- **Mensais**: Fechamento financeiro, DRE gerencial, Revisão de contratos, Análise de desvio orçamentário, Reunião Alinhamento
- Trimestrais: Reunião de alinhamento

---

## Integração no Wizard

`**src/pages/OnboardingGuiado.tsx**`:

- Importar Step5, Step6, Step7
- Render para `currentStep === 5`, `6`, `7`
- StepShell apenas para steps 8 e 9

## Arquivos

- **Novo**: `Step5Contratos.tsx`, `Step6Planejamento.tsx`, `Step7Rotinas.tsx`
- **Editado**: `OnboardingGuiado.tsx` (imports + render)