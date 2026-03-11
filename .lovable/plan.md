

# Refatoração do Modelo de Autorização Multi-Tenant com BackOffice BPO

## Contexto

O documento solicita criar uma camada de autorização de plataforma (BackOffice) separada da camada de tenant (organization_members), permitindo que operadores BPO acessem múltiplas organizações sem serem inseridos como membros comuns.

**Problema adicional identificado**: A tabela `organization_members` possui **duas políticas de INSERT conflitantes** — a nova "Only admins can add org members" (correta) e a antiga "Users can insert themselves or admins can add" (ainda com self-join). A segunda precisa ser removida.

## Plano de Implementação

### 1. Migração SQL — Estrutura e Funções

**Tabelas novas:**
- `backoffice_users` (user_id PK uuid, role text, is_active boolean, created_at timestamptz) — com RLS
- `backoffice_organization_access` (user_id uuid, organization_id uuid, scope text default 'managed', created_at timestamptz) — PK composta (user_id, organization_id), com RLS

**Funções auxiliares (SECURITY DEFINER):**
- `is_backoffice()` — verifica se auth.uid() existe em backoffice_users com is_active = true
- `has_backoffice_role(roles text[])` — verifica se o papel do usuário backoffice está em roles
- `has_backoffice_org_access(org_id uuid)` — verifica se is_backoffice() AND tem registro em backoffice_organization_access

**Remover política duplicada:**
- DROP "Users can insert themselves or admins can add" de organization_members

### 2. Migração SQL — Atualização das Políticas RLS

**Padrão geral para tabelas de dados:**
- SELECT: `is_org_member(org_id) OR has_backoffice_org_access(org_id) OR has_backoffice_role(ARRAY['master'])`
- INSERT: `(auth.uid() = user_id AND is_org_member(org_id)) OR has_backoffice_role(ARRAY['master','backoffice_admin','backoffice_operator'])`
- UPDATE: mesma lógica do INSERT
- DELETE: mais restritivo — `has_org_role(owner/admin) OR has_backoffice_role(ARRAY['master','backoffice_admin'])`

**Tabelas sensíveis** (employees, payroll_runs, payroll_items, contracts, employee_vacations):
- BackOffice limitado a `master` e `backoffice_admin` apenas (sem backoffice_operator)

**organization_members** (proteção reforçada):
- SELECT: `is_org_member(org_id) OR has_backoffice_role(ARRAY['master','backoffice_admin','backoffice_operator'])`
- INSERT: `has_org_role(owner/admin) OR has_backoffice_role(ARRAY['master','backoffice_admin'])` — nunca self-join
- UPDATE: `has_org_role(owner/admin) OR has_backoffice_role(ARRAY['master','backoffice_admin'])` — com WITH CHECK bloqueando alteração de organization_id/user_id e promoção a owner
- DELETE: `(auth.uid() = user_id) OR has_org_role(owner) OR has_backoffice_role(ARRAY['master','backoffice_admin'])`

### 3. Funções RPC Seguras

Criar RPCs com SECURITY DEFINER para operações sensíveis:
- `invite_org_member(org_id, user_id, role)` — valida permissão, insere membro
- `change_org_member_role(org_id, target_user_id, new_role)` — bloqueia promoção a owner por não-owners
- `remove_org_member(org_id, target_user_id)` — validação de privilégio
- `assign_backoffice_operator_to_org(target_user_id, org_id)` — apenas master/backoffice_admin

### 4. Integração com Auditoria

A tabela `audit_log` já existe. Adicionar coluna `actor_type` (text, default 'org_user') para distinguir ações de usuários BackOffice vs tenant.

### 5. Atualização do Frontend

**`src/hooks/useBackoffice.ts`**: Adicionar hooks para gerenciar backoffice_users e backoffice_organization_access (CRUD).

**`src/hooks/useUserPermissions.ts`**: Adicionar verificação de `is_backoffice` para que operadores BPO tenham acesso aos módulos das organizações atribuídas.

**`src/pages/BackofficeUsers.tsx`**: Adicionar coluna/badge para papel de BackOffice e UI para gerenciar acesso por organização.

**`src/components/BackofficeLayout.tsx`**: Sem mudanças estruturais — já protegido por papel master.

## Tabelas Afetadas (RLS update)

Todas as tabelas que usam `is_org_member` ou `has_org_role` serão atualizadas para incluir a camada BackOffice: organizations, organization_members, contracts, employees, payroll_runs, payroll_items, employee_vacations, chart_of_accounts, cost_centers, entities, financial_cashflow, liabilities, crm_clients, crm_activities, requests, request_tasks, request_comments, request_attachments, budget_versions, scenario_overrides, commercial_scenarios, commercial_budget_lines, hr_planning_items, onboarding_progress, onboarding_recommendations, user_permissions, user_cost_center_access, products, contract_adjustments, contract_documents, contract_installments, audit_log.

## Arquivos Afetados

- **Nova migração SQL** — toda a lógica de tabelas, funções e políticas
- **`src/hooks/useBackoffice.ts`** — hooks para backoffice_users e backoffice_organization_access
- **`src/hooks/useUserPermissions.ts`** — integração com camada BackOffice
- **`src/pages/BackofficeUsers.tsx`** — UI para gestão de operadores BPO

