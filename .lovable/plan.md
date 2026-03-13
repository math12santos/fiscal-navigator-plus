

# Templates de Regras Sugeridas + IA para Aglutinação Inteligente

## Contexto

Atualmente, criar regras de classificação é um processo manual — o usuário precisa definir campo, operador, valor e grupo destino para cada regra. Faltam:
1. **Templates pré-definidos** que derivem automaticamente dos macrogrupos/grupos já ativados
2. **IA** que analise o histórico de lançamentos da empresa e sugira regras otimizadas

## Mudanças

### 1. Templates de Regras Sugeridas (baseados em macrogrupos/grupos)

**Novo componente**: `SuggestedRuleTemplates` dentro de `GroupingConfigTab`

- Para cada grupo ativado (ex: "Energia" dentro de "Infraestrutura"), gerar templates de regras pré-definidas com mapeamento estático:
  - Grupo "Folha" → regra `source equals dp`
  - Grupo "Contratos Recorrentes" → regra `source equals contrato`
  - Grupo "Energia" → regra `descricao contains energia, cpfl, cemig, enel`
  - Grupo "Aluguel" → regra `descricao contains aluguel, locação`
  - Grupo "Internet" → regra `descricao contains internet, banda larga`
  - etc. (~30 templates mapeados dos `DEFAULT_SEED` groups)

- Exibir como cards com badge "Sugerido", mostrando a condição da regra e o grupo destino
- Botão "Ativar" por template (cria a regra no banco vinculada ao group_id correto)
- Botão "Ativar Todos" para criar todas as regras sugeridas de uma vez
- Ocultar templates cujas regras já existem (match por group_id + match_field + match_value)
- Posicionar entre a seção de Macrogrupos/Regras e a Simulação

**Arquivo**: `src/components/financeiro/SuggestedRuleTemplates.tsx` (novo)
**Arquivo**: `src/components/financeiro/GroupingConfigTab.tsx` (integrar)
**Arquivo**: `src/data/ruleTemplates.ts` (novo — mapeamento grupo→templates)

### 2. IA para Sugestão de Regras baseada no Histórico

**Edge Function**: `supabase/functions/suggest-grouping-rules/index.ts`

- Recebe `organization_id` e consulta os últimos 500 `cashflow_entries` da org
- Agrupa por padrões de descrição, categoria, fornecedor e fonte
- Envia ao Lovable AI (gemini-3-flash-preview) com prompt para:
  - Identificar clusters de lançamentos semelhantes
  - Sugerir regras (campo, operador, valor, nome do grupo sugerido)
  - Priorizar regras que cubram maior volume de lançamentos
- Retorna array de sugestões estruturadas via tool calling

**Hook**: `src/hooks/useAISuggestedRules.ts` (novo)
- Chama a edge function e retorna sugestões com estado de loading
- Cache no react-query para evitar chamadas repetidas

**UI no GroupingConfigTab**: Botão "Sugerir com IA" na seção de regras
- Abre um painel/dialog com sugestões da IA
- Cada sugestão mostra: nome, condição, grupo destino sugerido, cobertura estimada (quantos lançamentos)
- Botão "Aplicar" por sugestão (cria a regra) ou "Aplicar Todas"
- Badge "IA" diferenciando de templates estáticos

**Arquivo**: `supabase/functions/suggest-grouping-rules/index.ts` (novo)
**Arquivo**: `src/hooks/useAISuggestedRules.ts` (novo)
**Arquivo**: `src/components/financeiro/AIRuleSuggestions.tsx` (novo)
**Arquivo**: `src/components/financeiro/GroupingConfigTab.tsx` (integrar botão + dialog)

### 3. Atualizar config.toml

Adicionar a nova edge function com `verify_jwt = false`.

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/data/ruleTemplates.ts` | **Novo** — mapeamento grupo→templates de regras |
| `src/components/financeiro/SuggestedRuleTemplates.tsx` | **Novo** — cards de templates ativáveis |
| `supabase/functions/suggest-grouping-rules/index.ts` | **Novo** — edge function com Lovable AI |
| `src/hooks/useAISuggestedRules.ts` | **Novo** — hook para chamar a edge function |
| `src/components/financeiro/AIRuleSuggestions.tsx` | **Novo** — UI de sugestões da IA |
| `src/components/financeiro/GroupingConfigTab.tsx` | Integrar templates + botão IA |
| `supabase/config.toml` | Adicionar function suggest-grouping-rules |

