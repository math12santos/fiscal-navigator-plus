
# Plano: Filtro de Dados por Departamento (Centro de Custo)

## Objetivo
Permitir que gestores de departamento vejam apenas os dados financeiros vinculados aos centros de custo sob sua responsabilidade. Hoje, todos os usuários com acesso a um modulo veem todos os dados da organizacao.

## Abordagem

A filtragem sera feita por **Centro de Custo**, que ja existe como conceito no sistema e esta vinculado a contratos, fluxo de caixa, colaboradores, orcamento, etc. A ideia e criar uma tabela de associacao entre usuarios e centros de custo permitidos, e usar isso como filtro nos hooks de dados.

---

## Etapas

### 1. Criar tabela `user_cost_center_access`

Nova tabela no banco de dados:

```text
user_cost_center_access
-----------------------
id              uuid PK
user_id         uuid NOT NULL
organization_id uuid NOT NULL
cost_center_id  uuid NOT NULL  (FK -> cost_centers)
granted_by      uuid NOT NULL
created_at      timestamptz
UNIQUE(user_id, organization_id, cost_center_id)
```

Com RLS: membros da organizacao podem visualizar; owners/admins podem inserir/deletar.

### 2. Criar hook `useUserDataScope`

Um hook central que:
- Consulta `user_cost_center_access` para o usuario atual na organizacao atual
- Retorna a lista de `cost_center_ids` permitidos
- Retorna `hasFullScope: true` se o usuario for master/owner/admin OU se nao houver restricoes configuradas (compatibilidade)
- Exporta uma funcao utilitaria `filterByScope(items)` que filtra arrays pelo campo `cost_center_id`

### 3. Integrar filtro nos hooks de dados

Alterar os seguintes hooks para aplicar o filtro de escopo:
- `useCashFlow` -- filtrar entries por `cost_center_id`
- `useContracts` -- filtrar contratos por `cost_center_id`
- `useBudget` -- filtrar budget lines por `cost_center_id`
- `useDP` (colaboradores) -- filtrar employees por `cost_center_id`
- `useLiabilities` -- filtrar passivos por `cost_center_id`

A filtragem sera feita no lado do cliente (pos-query) para manter a simplicidade. Usuarios privilegiados (master, owner, admin) continuam vendo tudo.

### 4. Interface de configuracao no Backoffice

Na aba "Permissoes" do BackofficeCompany, substituir a "Camada B -- Granularidade de Visualizacao" (que hoje sao toggles sem efeito real) por um seletor de centros de custo:
- Listar todos os centros de custo da organizacao com checkboxes
- Marcar/desmarcar quais centros de custo o usuario pode ver
- Se nenhum centro estiver selecionado, o usuario ve tudo (compatibilidade retroativa)
- Salvar na tabela `user_cost_center_access`

### 5. Indicador visual no app

Adicionar um indicador sutil na interface principal (proximo ao OrgSelector ou no header) mostrando "Visualizando: [nomes dos centros de custo]" quando o usuario tiver escopo restrito, para que fique claro que os dados estao filtrados.

---

## Detalhes Tecnicos

- A tabela `user_cost_center_access` segue o padrao multi-tenant com `organization_id` e RLS via `is_org_member`
- O hook `useUserDataScope` usa `useQuery` com cache de 30s
- A filtragem e aplicada via `useMemo` dentro de cada hook de dados, sem alterar as queries ao banco
- Itens sem `cost_center_id` (null) serao visíveis para todos os usuarios (dados nao classificados permanecem acessiveis)
- Usuarios com `hasFullAccess` (master/owner/admin) ignoram completamente o filtro

## Compatibilidade

- Se um usuario nao tiver nenhum registro em `user_cost_center_access`, ele continua vendo todos os dados (comportamento atual preservado)
- Nenhuma alteracao em tabelas existentes
- Nenhuma alteracao em RLS existentes
