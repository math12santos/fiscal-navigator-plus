# Etapa 2 — Estrutura da Empresa (Implementação Real)

## Objetivo

Substituir o placeholder `StepShell` da etapa 2 por um componente funcional com 3 seções que criam dados reais no sistema:

1. **Empresas do Grupo** — Listar empresas existentes da org atual + criar novas empresas (subsidiárias) vinculadas automaticamente via `organization_holdings`
2. **Usuários Principais** — Listar membros existentes da org + convidar novos via a edge function `create-user` (mesmo fluxo do `CreateUserDialog`)
3. **Áreas Organizacionais** — Cadastrar centros de custo do tipo "área" usando a tabela `cost_centers` existente (ex: Financeiro, Comercial, Operações)

Sem mudanças no banco de dados. Todas as tabelas necessárias já existem.

## Componente Principal

`**src/components/onboarding-guiado/Step2Estrutura.tsx**`

Layout com 3 cards/seções colapsáveis (Accordion):

### Seção 1: Empresas do Grupo

- Tabela com empresas já vinculadas (query `organization_holdings` + `organizations`)
- Empresa atual mostrada como "principal"
- Botão "Adicionar Empresa" abre formulário inline com: nome, tipo documento (CPF/CNPJ), número do documento
- Segmento da Empresa (necessário verificar estrutura de dados para implementar a análise por segmento de emrpesa em todo o sistema)
- Ao salvar: insere em `organizations` + `organization_members` (owner = user atual) + `organization_holdings` (holding = org atual, subsidiary = nova org)
- Badge com contagem de empresas

### Seção 2: Usuários Principais

- Tabela com membros atuais da org (query `organization_members` + `profiles`)
- Botão "Convidar Usuário" abre formulário inline: nome, email, senha, cargo, role
- Usa edge function `create-user` (mesmo do CreateUserDialog) para criar conta + vincular à org
- Roles disponíveis: owner, admin, member, viewer

### Seção 3: Áreas Organizacionais

- Lista de centros de custo existentes da org (query `cost_centers`)
- Botão "Adicionar Área" com input de nome
- Ao salvar: insere em `cost_centers` com `organization_id` e `user_id`
- Sugestões pré-definidas (Financeiro, Comercial, Operações, RH, TI, Administrativo) como chips clicáveis para criação rápida

## Integração no Wizard

`**src/pages/OnboardingGuiado.tsx**`

- Importar `Step2Estrutura`
- No render: quando `currentStep === 2`, renderizar `Step2Estrutura` ao invés do `StepShell`
- Passar `currentOrg` e callbacks necessários

## Dados salvos no `structure_data`

Ao avançar ou salvar, o `structure_data` no `onboarding_progress` é atualizado com um resumo:

```json
{
  "companies_count": 3,
  "members_count": 5,
  "areas_count": 4
}
```

Isso permite ao Step 10 (Score) avaliar a completude desta etapa.

## Arquivos

- **Novo**: `src/components/onboarding-guiado/Step2Estrutura.tsx`
- **Editado**: `src/pages/OnboardingGuiado.tsx` (render step 2)