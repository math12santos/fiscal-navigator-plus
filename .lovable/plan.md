

# Onboarding Guiado — Foco por Etapa

## Problema
Todas as seções dentro de cada step aparecem expandidas simultaneamente (accordions com `defaultValue` abrindo tudo), gerando uma tela longa e sem foco visual.

## Solução
Trocar os accordions de `type="multiple"` com todos abertos por `type="single"` com `collapsible`, abrindo apenas a primeira seção. Isso foca o usuário em uma tarefa por vez.

## Arquivos a Alterar

### 1. `src/components/onboarding-guiado/Step2Estrutura.tsx`
- Linha 308: Mudar `type="multiple" defaultValue={["companies", "users", "areas"]}` para `type="single" collapsible defaultValue="users"` (ou `"companies"` se holding)
- Garante que apenas uma seção fica aberta por vez

### 2. `src/components/onboarding-guiado/Step4EstruturaFinanceira.tsx`
- Linha 221: Mudar `type="multiple" defaultValue={["accounts", "centers"]}` para `type="single" collapsible defaultValue="accounts"`

### 3. `src/components/onboarding-guiado/Step5Contratos.tsx`
- Mesmo padrão: trocar accordion para `type="single" collapsible`

### 4. `src/components/onboarding-guiado/Step1Diagnostico.tsx`
- Este step não usa accordion, mas mostra todos os cards de seção abertos. Não será alterado pois cada seção é um formulário curto de radio buttons — o formato atual faz sentido para diagnóstico rápido.

