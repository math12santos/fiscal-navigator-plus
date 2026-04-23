

## Novo módulo "Cadastros" — separar Fornecedores, Clientes, Produtos e Serviços

Hoje o módulo **Configurações** mistura estrutura financeira (Plano de Contas, Centros de Custo, Aglutinação) com cadastros operacionais (Fornecedores/Clientes e Produtos/Serviços). Vou extrair os cadastros para um módulo dedicado, com **4 abas distintas**, deixando Configurações focada apenas em estrutura.

### O que será feito

**1. Nova página `src/pages/Cadastros.tsx`** com 4 abas independentes:

| Aba | Filtro aplicado | Botão de ação |
|---|---|---|
| **Fornecedores** | `entities` onde `type ∈ {fornecedor, ambos}` | "Novo Fornecedor" (pré-seleciona `type=fornecedor`) |
| **Clientes** | `entities` onde `type ∈ {cliente, ambos}` | "Novo Cliente" (pré-seleciona `type=cliente`) |
| **Produtos** | `products` onde `type=produto` | "Novo Produto" (pré-seleciona `type=produto`) |
| **Serviços** | `products` onde `type=servico` | "Novo Serviço" (pré-seleciona `type=servico`) |

- Cada aba terá sua própria busca, filtros secundários (categoria/unidade), tabela e diálogo (`EntityFormDialog` ou `ProductFormDialog`).
- A coluna **Tipo** em Fornecedores e Clientes continua sendo exibida para sinalizar registros marcados como "Ambos".
- KPIs no topo: total de ativos por aba (ex.: "37 fornecedores ativos").

**2. Registro do módulo `cadastro` no sistema**
- Migration inserindo em `system_modules`: `module_key='cadastro'`, `label='Cadastros'`, `enabled=true`.
- Adicionar entrada em `MODULE_DEFINITIONS` (`src/data/moduleDefinitions.ts`) com 4 abas (`fornecedores`, `clientes`, `produtos`, `servicos`) — habilita controle granular de permissão por aba no Backoffice.

**3. Navegação e roteamento**
- `src/App.tsx`: nova rota `/cadastros` com `ModuleMaintenanceGuard moduleKey="cadastro"`, lazy-loaded com `pageFactories.cadastros`.
- `src/components/AppLayout.tsx`: novo item de sidebar "Cadastros" usando ícone `BookUser` (Lucide), posicionado logo abaixo de **CRM** (cadastros são insumo de CRM, Contratos e Financeiro).
- Redirect de compatibilidade: visitas a `/configuracoes?tab=entities` ou `?tab=products` redirecionam para `/cadastros`.

**4. Limpeza em `Configuracoes.tsx`**
- Remover as abas `entities` e `products` de `ALL_TABS`, os states/filters relacionados, os imports `useEntities`/`useProducts`/`EntityFormDialog`/`ProductFormDialog`, e os dois `<TabsContent>` correspondentes.
- Configurações passa a ter 3 abas: **Plano de Contas**, **Centros de Custo**, **Aglutinação**.
- Atualizar a descrição do `PageHeader` para "Plano de Contas, Centros de Custo e Aglutinação".

**5. Permissões e onboarding**
- `OnboardingModules.tsx`: incluir `cadastro` na lista de módulos disponíveis (não está na lista de exclusão `["configuracoes","integracoes"]`, então aparecerá automaticamente após a migration).
- `useUserPermissions.getAllowedTabs("cadastro", ...)` aplicado nas 4 abas para respeitar permissões granulares.
- Fallback: se o usuário tinha permissão em `configuracoes/entities` ou `configuracoes/products`, recebe automaticamente acesso à aba equivalente em `cadastro` via uma migration de espelhamento (única, idempotente).

### Detalhes técnicos

- **Hooks intactos**: `useEntities` e `useProducts` permanecem como estão — apenas mudam de página consumidora.
- **Reuso total dos diálogos**: `EntityFormDialog` e `ProductFormDialog` aceitam o objeto a editar e são reaproveitados sem alteração; o "tipo" pré-selecionado é passado via prop inicial ao criar.
- **Filtros em memória** (mesmo padrão atual do Configuracoes), mantendo a separação por aba via `.filter(e => ['fornecedor','ambos'].includes(e.type))` etc.
- **Backoffice**: como `cadastro` herda o padrão de `MODULE_DEFINITIONS.tabs`, o `BackofficeUsers`/permissões já passa a oferecer toggles para as 4 abas automaticamente.
- **Sem perda de dados**: nenhuma tabela/coluna alterada — apenas reorganização de UI e novo registro em `system_modules`.

### Arquivos afetados

- `src/pages/Cadastros.tsx` (novo)
- `src/pages/Configuracoes.tsx` (remoção das 2 abas)
- `src/App.tsx` (rota + lazy factory)
- `src/components/AppLayout.tsx` (item de sidebar)
- `src/data/moduleDefinitions.ts` (módulo + abas)
- Migration: `INSERT INTO system_modules` + espelhamento de permissões existentes

