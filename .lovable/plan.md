

# Plano: Configuracao de Modulos e Abas por Centro de Custo

## Objetivo

Quando o Owner cria ou edita um centro de custo, ele define:
1. Quais **modulos** aquele centro de custo tera acesso
2. Quais **abas** dentro de cada modulo serao visiveis para cada **nivel de acesso** (role) do setor

Isso transforma o centro de custo de uma unidade de agrupamento de dados em uma **unidade organizacional com permissoes proprias**.

---

## Modelo Conceitual

Hoje as permissoes sao definidas por usuario (`user_permissions`). A proposta e adicionar uma camada intermediaria:

```text
Organizacao
  -> Centro de Custo
       -> Modulos habilitados para o setor
       -> Abas visiveis por role (admin, member, viewer)
  -> Usuario
       -> Vinculado a 1+ centros de custo (user_cost_center_access)
       -> Herda as permissoes do centro de custo conforme seu role na org
```

Owner/Admin continuam com bypass total. A configuracao do centro de custo define o que members e viewers podem ver quando estao restritos a um setor.

---

## Etapas

### 1. Criar tabela `cost_center_permissions`

Nova tabela para armazenar quais modulos e abas cada centro de custo permite, por nivel de acesso:

```text
cost_center_permissions
-----------------------
id                uuid PK
organization_id   uuid NOT NULL
cost_center_id    uuid NOT NULL (FK -> cost_centers)
module_key        text NOT NULL
tab_key           text NULL (NULL = permissao no nivel do modulo)
role              text NOT NULL ('member' | 'viewer')
allowed           boolean NOT NULL DEFAULT true
created_at        timestamptz
UNIQUE(cost_center_id, module_key, tab_key, role)
```

RLS: membros da organizacao podem visualizar; owners/admins podem inserir/atualizar/deletar.

### 2. Expandir o formulario de Centro de Custo

No `CostCenterFormDialog.tsx`, apos os campos basicos, adicionar uma secao colapsavel "Modulos e Permissoes" com:
- Lista de modulos da organizacao (habilitados em `organization_modules`)
- Para cada modulo: toggle de ativacao para o setor
- Para modulos com abas: grid de checkboxes (abas x roles)
- Roles configuráveis: `member` (Analista) e `viewer` (Visualizador)
- Owner e Admin nao aparecem na grid pois tem acesso total

O dialog sera expandido para `sm:max-w-2xl` para acomodar a grid.

### 3. Salvar permissoes ao criar/editar centro de custo

No hook `useCostCenters.ts`, apos salvar o centro de custo:
- Deletar permissoes antigas do centro de custo (`cost_center_permissions`)
- Inserir as novas permissoes em batch
- Invalidar queries de permissoes

### 4. Integrar no hook de permissoes do usuario

Atualizar `useUserPermissions.ts` para considerar as permissoes herdadas do centro de custo:
- Se o usuario tem escopo restrito (vinculado a centros de custo via `user_cost_center_access`):
  - Consultar `cost_center_permissions` dos centros de custo permitidos
  - Unificar as permissoes: se qualquer centro de custo permite um modulo/aba, o usuario pode acessar
- Se o usuario tem escopo total (sem restricoes ou Owner/Admin): comportamento atual mantido
- A tabela `user_permissions` continua existindo como override manual (prioridade sobre heranca do CC)

### 5. Valores padrao e compatibilidade

- Centros de custo sem permissoes configuradas: todos os modulos da org ficam acessiveis (compatibilidade retroativa)
- Se um centro de custo tem pelo menos uma permissao configurada, o modo restritivo e ativado para aquele CC
- Modulos desativados na organizacao (`organization_modules`) nao aparecem como opcao no formulario do CC

---

## Detalhes Tecnicos

### Resolucao de permissoes (ordem de precedencia)

```text
1. system_modules (global) -- modulo desativado globalmente = bloqueado para todos
2. organization_modules (tenant) -- modulo desativado na org = bloqueado para todos da org
3. Owner/Admin/Master -- bypass total, ignora camadas abaixo
4. cost_center_permissions (setor) -- define o que member/viewer podem ver no setor
5. user_permissions (individual) -- override manual por usuario (opcional)
```

### Fluxo de dados no formulario

```text
CostCenterFormDialog recebe:
  orgModules: { key: string; label: string; tabs?: { key: string; label: string }[] }[]
  existingPermissions: CostCenterPermission[] (ao editar)

Armazena estado local:
  permissions: Map<string, { enabled: boolean; tabs: Map<string, { member: boolean; viewer: boolean }> }>

Ao submeter: envia junto com os dados do CC
```

### Migracao SQL

```text
CREATE TABLE cost_center_permissions (
  id uuid PK DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  cost_center_id uuid NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  tab_key text,
  role text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cost_center_id, module_key, COALESCE(tab_key, '__module__'), role)
);

RLS: org member can SELECT; owner/admin can INSERT/UPDATE/DELETE
```

### Compatibilidade

- Nenhuma alteracao em tabelas existentes
- `user_permissions` continua funcionando como override
- Centros de custo sem configuracao de permissoes mantem comportamento atual
- A UI no Backoffice (BackofficeCompany) continua permitindo override individual por usuario

