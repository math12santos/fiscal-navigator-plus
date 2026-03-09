

# Etapa 4 — Estrutura Financeira (Plano de Contas + Centros de Custo)

## Objetivo

Substituir o placeholder `StepShell` da etapa 4 por um componente funcional com 2 seções que gerenciam dados reais usando os hooks existentes `useChartOfAccounts` e `useCostCenters`.

Sem mudanças no banco de dados — todas as tabelas e hooks já existem.

## Componente Principal

**`src/components/onboarding-guiado/Step4EstruturaFinanceira.tsx`**

Layout com 2 seções em Accordion (mesmo padrão do Step2):

### Seção 1: Plano de Contas
- Lista contas existentes em tree view simples (code + name, agrupadas por nível 1)
- Badge com contagem total de contas
- Botão **"Criar Plano Padrão"** que chama `seedDefaultAccounts()` do hook existente (se não houver contas)
- Botão **"Adicionar Conta"** com formulário inline simplificado (código, nome, tipo, conta pai)
- Usa `useChartOfAccounts()` — mesmo hook das telas de Configurações

### Seção 2: Centros de Custo
- Lista centros existentes (code + name)
- Badge com contagem
- Botão **"Criar Centros Padrão"** que chama `seedDefaultCenters()` do hook existente (se não houver centros)
- Botão **"Adicionar Centro"** com formulário inline (código, nome)
- Usa `useCostCenters()` — mesmo hook das telas de Configurações

### Progress Data
Atualiza `financial_structure_data` no `onboarding_progress`:
```json
{
  "accounts_count": 45,
  "cost_centers_count": 21
}
```

## Integração no Wizard

**`src/pages/OnboardingGuiado.tsx`**:
- Importar `Step4EstruturaFinanceira`
- Renderizar quando `currentStep === 4` (substituindo StepShell)
- Ajustar condição do StepShell para `currentStep >= 5`

## Arquivos

- **Novo**: `src/components/onboarding-guiado/Step4EstruturaFinanceira.tsx`
- **Editado**: `src/pages/OnboardingGuiado.tsx` (render step 4)

