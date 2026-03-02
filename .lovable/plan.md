
# Propagação de Permissões em Holding

## Problema
Ao configurar permissões para funcionários que atuam em múltiplas empresas de um grupo (holding), o administrador precisa acessar cada empresa individualmente e repetir a mesma configuração. No caso da Thayna Leite, foram 6 organizações configuradas uma a uma, totalizando mais de 20 registros manuais.

## Solução
Adicionar uma funcionalidade de **"Propagar para o Grupo"** na tela de permissões do Backoffice (aba Permissões da empresa). Quando o admin configura as permissões de um usuário em uma empresa que faz parte de uma holding, ele poderá replicar essas permissões para todas as subsidiárias do grupo com um clique.

## Funcionalidades

### 1. Botão "Propagar para o Grupo"
- Visível apenas quando a organização atual é uma holding ou faz parte de uma holding
- Aparece na aba de Permissões, ao lado do seletor de usuário, após selecionar um usuário
- Ao clicar, abre um diálogo de confirmação mostrando:
  - As permissões atuais do usuário nesta empresa (resumo)
  - A lista de empresas do grupo onde as permissões serão aplicadas
  - Checkboxes para selecionar/deselecionar empresas específicas
  - Indicação de quais empresas o usuário já é membro

### 2. Lógica de Propagação
- Copia as permissões (`user_permissions`) da organização atual para todas as organizações selecionadas do grupo
- Para cada empresa destino: remove permissões existentes do usuário e insere as novas (mesmo comportamento do "Clonar Permissões" existente)
- Se o usuário não for membro de alguma subsidiária selecionada, exibe aviso e pula essa empresa

### 3. Feedback
- Toast de sucesso indicando quantas empresas foram atualizadas
- Invalidação de cache para todas as organizações afetadas

## Detalhes Técnicos

### Alterações em `src/hooks/useBackoffice.ts`
- Adicionar mutation `propagateToGroup` que:
  1. Busca as subsidiárias da holding via tabela `organization_holdings`
  2. Busca as permissões atuais do usuário na org fonte
  3. Para cada org destino selecionada: deleta permissões existentes e insere cópia
  4. Utiliza a mesma lógica já existente em `clonePermissions`, mas iterando sobre múltiplas orgs

### Alterações em `src/pages/BackofficeCompany.tsx`
- Adicionar query para verificar se a org atual pertence a uma holding (busca `organization_holdings`)
- Adicionar botão "Propagar para o Grupo" com icone `Copy` ou `Building2`
- Adicionar `AlertDialog` de confirmação com lista de empresas e checkboxes
- Após execução, invalidar queries de permissões de todas as orgs afetadas

### Fluxo
```text
[Seleciona usuário] -> [Configura permissões na empresa atual]
       |
       v
[Clica "Propagar para o Grupo"]
       |
       v
[Dialog: lista subsidiárias com checkboxes]
  - [x] Danfessi (membro)
  - [x] Davanti (membro)  
  - [x] Licita Winners (membro)
  - [x] Viva7 (membro)
       |
       v
[Confirma] -> Replica permissões -> Toast "4 empresas atualizadas"
```

### Nenhuma migração de banco necessária
A funcionalidade utiliza as tabelas existentes (`user_permissions`, `organization_holdings`, `organization_members`) sem alterações de schema.
