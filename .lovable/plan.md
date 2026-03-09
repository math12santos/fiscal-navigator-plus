

# Onboarding Guiado — Escopo por Empresa (sem Holding)

## Situação Atual

O onboarding guiado opera sobre `currentOrg` (a organização selecionada). Se o usuário selecionar uma holding, o onboarding roda normalmente — mas não deveria, pois a holding tem necessidades diferentes que ainda não foram implementadas.

A tabela `onboarding_progress` já é escopada por `organization_id`, então cada empresa já pode ter seu próprio progresso independente. O problema é que não há bloqueio para holdings.

## Mudanças

### 1. Detectar se a org atual é uma holding

Usar o `HoldingContext` (já existe `isHolding`) ou, se o contexto não estiver disponível na rota do onboarding, fazer uma query rápida em `organization_holdings` para verificar se `currentOrg` aparece como `holding_id`.

### 2. Bloquear onboarding guiado para holdings

No `OnboardingGuiado.tsx`:
- Se `currentOrg` for uma holding, exibir uma tela informativa em vez do fluxo de etapas
- Mensagem: "O onboarding guiado é configurado individualmente por empresa. Selecione uma subsidiária para iniciar."
- Listar as subsidiárias com botão para trocar de org e iniciar/continuar o onboarding de cada uma
- Mostrar o status do onboarding de cada subsidiária (não iniciado / em andamento / concluído)

### 3. Dashboard — banner contextual

O banner de "Continuar onboarding" no Dashboard já consulta `onboarding_progress` da `currentOrg`. Se a org for holding, o banner deve mostrar o status das subsidiárias em vez de um link direto.

### 4. Step2Estrutura — remover seção de subsidiárias

Como cada empresa faz seu próprio onboarding, a seção "Empresas do Grupo" no Step 2 não faz sentido para uma subsidiária individual. Ela deve ser simplificada para mostrar apenas a empresa atual (sem criar subsidiárias — isso é feito no Backoffice).

## Arquivos Afetados

- **`src/pages/OnboardingGuiado.tsx`** — Guard de holding + tela de seleção de subsidiária
- **`src/pages/Dashboard.tsx`** — Ajustar banner para holdings (mostrar status por subsidiária)
- **`src/components/onboarding-guiado/Step2Estrutura.tsx`** — Remover/ocultar seção de criação de subsidiárias quando a org não é holding

## Detalhes Técnicos

- Reusar `useHolding()` do `HoldingContext` que já provê `isHolding` e `subsidiaryOrgs`
- Para a tela de holding no onboarding, fazer um batch query em `onboarding_progress` filtrando por `organization_id IN (subsidiaryIds)` para mostrar status de cada uma
- A troca de empresa usa `setCurrentOrg()` do `OrganizationContext`, que já existe

