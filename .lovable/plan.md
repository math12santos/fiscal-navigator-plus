

# Plano: Responsavel do Centro de Custo como Seletor de Usuarios com Acesso Automatico

## Objetivo

Transformar o campo "Responsavel" do centro de custo de texto livre para um seletor de usuarios membros da organizacao. Ao atribuir um responsavel, o sistema automaticamente concede acesso ao centro de custo para esse usuario na tabela `user_cost_center_access`.

---

## Etapas

### 1. Migrar coluna `responsible` de text para uuid

Alterar a coluna `cost_centers.responsible` de `text` para `uuid`, referenciando o `id` do usuario (tabela `profiles`). Como o campo atual e texto livre e provavelmente contem nomes (nao UUIDs), os valores existentes serao limpos (definidos como NULL) antes da conversao.

### 2. Atualizar o formulario de Centro de Custo

No `CostCenterFormDialog.tsx`:
- Receber a lista de membros da organizacao como prop
- Substituir o `<Input>` de "Responsavel" por um `<SearchableSelect>` que lista os membros da empresa (nome + cargo)
- Adaptar o estado do formulario para armazenar `responsible` como `uuid | null`

### 3. Carregar membros da organizacao na pagina de Configuracoes

Na pagina que renderiza o formulario de centros de custo (`Configuracoes.tsx`), buscar os membros da organizacao (via `organization_members` + `profiles`) e passa-los como prop para o dialog.

### 4. Automatizar concessao de acesso ao salvar

No hook `useCostCenters.ts`, apos criar ou atualizar um centro de custo com um `responsible` definido:
- Inserir automaticamente um registro em `user_cost_center_access` para o usuario responsavel (se ainda nao existir)
- Se o responsavel mudar, remover o acesso do responsavel anterior e conceder ao novo
- Isso garante que o gestor sempre tenha visibilidade sobre os dados do seu departamento

### 5. Exibir nome do responsavel na listagem

Atualizar a query de centros de custo para fazer join com `profiles` e exibir o nome do responsavel na tabela/listagem, em vez de um UUID.

---

## Detalhes Tecnicos

### Migracao SQL

```text
- ALTER cost_centers: SET responsible = NULL WHERE responsible IS NOT NULL
- ALTER cost_centers: ALTER COLUMN responsible TYPE uuid USING NULL
- Nao adicionar FK formal para manter flexibilidade (usuarios podem ser removidos)
```

### Logica de acesso automatico (no hook useCostCenters)

```text
onSuccess do create/update:
  1. Se responsible != null:
     - UPSERT em user_cost_center_access (user_id=responsible, cost_center_id=cc.id)
  2. Se houve mudanca de responsible (update):
     - DELETE do acesso antigo (se o antigo nao for responsavel de outro CC)
     - INSERT do acesso novo
  3. Invalidar query de user_cost_center_access
```

### Props do formulario

```text
CostCenterFormDialog recebe:
  orgMembers: { id: string; full_name: string; cargo: string }[]
```

### Compatibilidade

- Centros de custo sem responsavel continuam funcionando normalmente
- A concessao automatica e aditiva: nao remove acessos configurados manualmente pelo Backoffice
- Apenas remove o acesso automatico quando o responsavel e trocado por outro
