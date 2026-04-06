# Descoberta Automática de Estrutura: Categorias, Centros de Custo e Regras a partir de Dados Importados

## Problema

Quando o usuário importa lançamentos com categorias e centros de custo preenchidos, esses valores aparecem nos módulos financeiros (Dashboard, Fluxo de Caixa) como agrupamentos visuais — mas não existem como registros na estrutura configurada do sistema (tabelas `cost_centers`, `chart_of_accounts`, `grouping_rules`). Isso cria uma **desconexão entre dados operacionais e estrutura de governança**: o sistema exibe informação que não pode ser gerenciada, auditada ou reutilizada.

## Solução: "Descoberta de Estrutura"

Criar uma funcionalidade que **detecta padrões órfãos** nos dados importados e oferece ao usuário a opção de **promovê-los** a registros reais do sistema ou ajuste automático de categoria quando muito repetido o mesmo padrão — categorias no plano de contas, centros de custo, e regras de aglutinação.

## Mudanças

### 1. Novo hook `useStructureDiscovery.ts`

Analisa `cashflow_entries` da organização e cruza com a estrutura existente para identificar:

- **Categorias órfãs**: valores únicos em `categoria` que não correspondem a nenhuma conta no plano de contas nem a nenhuma regra de aglutinação
- **Centros de custo órfãos**: valores em `cost_center_id` que não existem na tabela `cost_centers` (texto livre importado vs UUID real) — ou textos em campos como `categoria` que parecem centros de custo
- **Padrões recorrentes sem regra**: descrições/categorias que aparecem N+ vezes mas não têm regra de aglutinação associada

Retorna arrays tipados com: `valor`, `frequência`, `valor_total`, `sugestão_de_ação` (criar conta, criar CC, criar regra).

### 2. Novo componente `StructureDiscoveryPanel.tsx`

Painel exibido na aba **Aglutinação** (GroupingConfigTab) como seção superior, visível quando há itens descobertos. Mostra:

- Card resumo: "X categorias sem registro · Y padrões sem regra"
- Tabela com cada item órfão: nome, frequência, valor acumulado, e botões de ação:
  - **"Criar Categoria"** → abre dialog para criar conta analítica no plano de contas com o nome pré-preenchido
  - **"Criar Centro de Custo"** → abre dialog para criar CC com nome pré-preenchido
  - **"Criar Regra"** → abre GroupingRuleDialog com `match_field=categoria`, `operator=equals`, `match_value` pré-preenchido
  - **"Ignorar"** → adiciona a uma lista de ignorados (localStorage por org)
- Botão **"Promover Todos"** → cria em lote todas as sugestões aceitas

### 3. Integração com o fluxo de importação (pós-importação)

Após uma importação bem-sucedida no `ImportDialog`, exibir um toast/banner:

> "Detectamos 5 categorias e 2 centros de custo que não existem na estrutura. [Revisar →]"

O link direciona para a aba Aglutinação com o painel de descoberta em destaque.

### 4. Atualização em `GroupingConfigTab.tsx`

- Importar e renderizar `StructureDiscoveryPanel` no topo da aba, antes dos KPIs existentes
- Passar callbacks de criação (`createRule`, `createGroup`) para que as ações do painel usem as mutations existentes

### 5. Vinculação retroativa dos entries

Quando o usuário cria uma categoria/CC a partir da descoberta, oferecer opção de **atualizar os lançamentos existentes** que usam aquele texto para apontar para o novo registro criado (via batch update nos `cashflow_entries`).

## Arquivos envolvidos

- `src/hooks/useStructureDiscovery.ts` — novo hook de análise
- `src/components/financeiro/StructureDiscoveryPanel.tsx` — novo componente visual
- `src/components/financeiro/GroupingConfigTab.tsx` — integrar painel
- `src/components/financeiro/ImportDialog.tsx` — toast pós-importação com link
- Nenhuma migração SQL necessária — usa dados existentes em `cashflow_entries` cruzados com `cost_centers`, `chart_of_accounts` e `grouping_rules`