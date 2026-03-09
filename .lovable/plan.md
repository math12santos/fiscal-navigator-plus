# Correções da Etapa 2 — Estrutura Organizacional

## Problemas Identificados

### 1. Usuários criados nao aparecem

A edge function `create-user` exige papel `master`. No onboarding, o usuario logado e `owner` — a chamada retorna 403 silenciosamente.

### 2. Senha obrigatoria no formulário

O formulário exige senha manual. O ideal e gerar link para ativação de senha no primeiro acesso (`must_change_password: true`).

### 3. Areas nao criam / botoes desabilitam todos

O estado `savingArea` e um unico booleano. Ao clicar em uma sugestao, TODOS os botoes ficam desabilitados. Se o primeiro falhar ou demorar, nao ha como clicar em outro. Precisa rastrear qual area esta sendo salva individualmente e permitir ativar mais de uma área diferente. 

### 4. Nivel de integracao com o App

Cada area organizacional criada no onboarding ja vira um Centro de Custo (codigo funciona). O que falta e: alertar no app quando um modulo/area nao foi ativado pelo onboarding. Isso sera tratado como item separado apos as correções.

---

## Solucao

### A. Edge Function `create-user` — permitir `owner`/`admin`

Alterar a verificacao de role para aceitar `master` OU `owner`/`admin` de pelo menos uma organizacao do payload.

- Verifica se o caller tem `master` role OU se tem role `owner`/`admin` em alguma das `organization_ids` enviadas
- Mantem seguranca: so cria usuario vinculado a orgs onde o caller tem permissao

### B. Formulário de usuario sem senha

- Remover campo de senha do formulário
- Gerar senha temporaria automatica (UUID truncado) no frontend
- Enviar com `must_change_password: true` (ja acontece na edge function)
- Mostrar mensagem: "O usuario recebera um convite para definir sua senha no primeiro acesso"
- Apos criar, chamar `fetchMembers()` para atualizar a lista (ja acontece, mas so funciona se a criacao nao falhar)

### C. Botoes de area — controle granular de loading

- Trocar `savingArea: boolean` por `savingAreaId: string | null` que guarda o nome da area sendo criada
- Desabilitar apenas o botao da area em andamento
- Permitir cliques sequenciais apos conclusao

### D. Reforco visual: lista de usuarios

- Apos criar usuario, exibir toast de sucesso com nome/email
- Garantir que `fetchMembers()` roda apos sucesso

---

## Arquivos Afetados

- `**supabase/functions/create-user/index.ts**` — aceitar owner/admin alem de master
- `**src/components/onboarding-guiado/Step2Estrutura.tsx**` — remover campo senha, gerar senha temp, fix botoes de area