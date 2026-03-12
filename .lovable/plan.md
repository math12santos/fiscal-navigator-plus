# Configurador de Regras de Aglutinação — Fase 1 (MVP)

O documento descreve um motor completo de visualização operacional. A implementação será faseada. Esta é a **Fase 1** conforme o próprio documento sugere.

## O que muda em relação ao modelo atual

O modelo atual é muito simples: uma regra faz match de **um campo** contra **um valor exato** e opcionalmente sub-agrupa por outro campo. O novo modelo introduz:

1. **Macrogrupos e Grupos hierárquicos** — estrutura pai/filho para organizar regras
2. **Múltiplas condições por regra** — com operadores (igual, contém, começa com, está em lista)
3. **Regra por palavra-chave na descrição** — não apenas por campo exato
4. **Fallback obrigatório** — entradas sem match vão para "Não Classificado"
5. **Seed de macrogrupos padrão** — 10 macrogrupos pré-configurados com subgrupos

## Arquitetura de Dados

### Novas tabelas (migração SQL)

`**grouping_macrogroups**` — Macrogrupos (Pessoal e RH, Infraestrutura, Tributário, etc.)

- `id`, `organization_id`, `name`, `icon`, `color`, `order_index`, `enabled`

`**grouping_groups**` — Grupos dentro de macrogrupos (Folha, Benefícios, Aluguel, etc.)

- `id`, `macrogroup_id` (FK), `organization_id`, `name`, `order_index`, `enabled`

**Refatorar `grouping_rules**` — Regras agora apontam para um grupo destino:

- Adicionar colunas: `group_id` (FK para `grouping_groups`), `operator` (text, default `equals`), `match_keyword` (text, para busca por descrição)
- O campo `match_field` ganha novos valores possíveis: `descricao`, `cost_center_id`
- Operadores suportados na Fase 1: `equals`, `contains`, `starts_with`, `in_list`

### Seed de macrogrupos padrão

Ao clicar "Gerar Padrão", criar os 10 macrogrupos do documento com seus subgrupos:

- Pessoal e RH (Folha, Pró-labore, Encargos, Benefícios, VT, Férias, 13º, Rescisões, RPA)
- Infraestrutura (Aluguel, Condomínio, Água, Energia, Internet, Telefonia, Limpeza, Produtos de Limpeza)
- Tecnologia e Sistemas, Fornecedores Operacionais, Serviços Profissionais, Tributário, Financeiro, Contratos, Patrimonial/Investimentos, Despesas Eventuais

## Nova Interface — Aba "Aglutinação" em `/configuracoes`

Substituir a tela atual (tabela simples de regras) por **3 blocos**:

### Bloco 1 — Macrogrupos e Grupos

- Lista colapsável de macrogrupos com seus grupos filhos
- CRUD inline: adicionar/editar/excluir macrogrupo e grupo
- Toggle ativo/inativo
- Botão de Criar Macro-Grupo para criação manual
- Botão "Gerar Padrão" para popular com os 10 macrogrupos

### Bloco 2 — Regras de Classificação

- Tabela de regras com colunas: Nome, Condição (campo + operador + valor), Grupo Destino, Prioridade, Status
- Dialog de criação/edição com:
  - Nome da regra
  - Campo (`categoria`, `fornecedor`, `descrição`, `source`, `centro de custo`)
  - Operador (`é igual a`, `contém`, `começa com`, `está em lista`)
  - Fonte — **select dinâmico** conforme campo selecionado (categorias existentes, entidades, centros de custo) não utilizar texto livre apenas sugerir novas fontes. 
  - Grupo destino — select dos grupos cadastrados
  - Prioridade numérica

### Bloco 3 — Fallback

- Configuração do comportamento padrão: "Não Classificado" / "Revisão Necessária"
- Entradas sem match aparecem nesse grupo na Aging List

## Hook `useGroupingRules` — Refatoração

- Novo hook `useGroupingMacrogroups` para CRUD de macrogrupos e grupos
- Refatorar `useGroupingRules` para:
  - Suportar operadores (`equals`, `contains`, `starts_with`, `in_list`)
  - Match por `descricao` com keyword
  - Retornar o macrogrupo/grupo destino ao invés de um label simples
  - Fallback para "Não Classificado" quando nenhuma regra faz match

## Consumo no AgingListTab e FinanceiroTable

- Agrupar por **Macrogrupo → Grupo → Entrada** (3 níveis colapsáveis)
- Macrogrupo mostra total e contagem
- Grupo mostra total e contagem
- Entradas sem match vão para macrogrupo "Não Classificado"

## Arquivos


| Arquivo                                                   | Ação                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Migration SQL                                             | Criar `grouping_macrogroups`, `grouping_groups`; alterar `grouping_rules` |
| `src/hooks/useGroupingMacrogroups.ts`                     | Novo — CRUD macrogrupos + grupos                                          |
| `src/hooks/useGroupingRules.ts`                           | Refatorar — operadores, grupo destino, fallback                           |
| `src/components/financeiro/GroupingRuleDialog.tsx`        | Refatorar — operador, campo dinâmico, grupo destino                       |
| `src/components/financeiro/GroupingMacrogroupManager.tsx` | Novo — UI de macrogrupos/grupos                                           |
| `src/pages/Configuracoes.tsx`                             | Refatorar aba Aglutinação com 3 blocos                                    |
| `src/components/financeiro/AgingListTab.tsx`              | 3 níveis: macrogrupo → grupo → entrada                                    |
| `src/components/financeiro/FinanceiroTable.tsx`           | Mesma lógica de 3 níveis                                                  |
