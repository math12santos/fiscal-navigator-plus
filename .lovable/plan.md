

# Aprimorar Detecção de Duplicidades com Metodologia MECE

## Situação atual

Já existe um mecanismo básico em `useDuplicateDetection.ts` que detecta duplicatas com 3 critérios simultâneos: mesmo fornecedor + valor similar (±5%) + datas próximas (±7 dias). Porém ele é limitado:

- Só analisa entries com `entity_id` preenchido (ignora lançamentos sem fornecedor)
- Não detecta duplicatas entre importações e lançamentos existentes
- Não categoriza o tipo/gravidade da duplicidade
- Não oferece ações ao usuário (apenas lista)
- Não cobre Contas a Receber
- Não verifica duplicatas entre projeções e lançamentos manuais (violação MECE)

## Plano — Cobertura MECE completa

### Categorias de duplicidade (mutuamente exclusivas, coletivamente exaustivas)

| Categoria | Critérios | Severidade |
|---|---|---|
| **Exata** | Mesmo fornecedor + valor idêntico + mesma data | Alta (vermelha) |
| **Valor similar** | Mesmo fornecedor + valor ±5% + data ±7d | Média (âmbar) |
| **Sem fornecedor** | Sem entity_id, mas descrição similar (Levenshtein ≥80%) + valor ±5% + data ±7d | Média (âmbar) |
| **Projeção vs Manual** | Entry manual duplica projeção de contrato/DP no mesmo mês | Alta (vermelha) |
| **Importação vs Existente** | Entry com `source=importacao` duplica entry existente (valor ±2% + data ±3d + descrição similar) | Alta (vermelha) |

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useDuplicateDetection.ts` | Expandir para 5 categorias MECE, adicionar severidade, incluir entries sem entity_id via similaridade de descrição, cruzar projeções vs manuais |
| `src/components/financeiro/DuplicateAlerts.tsx` | UI com severidade (cores), agrupamento por categoria, botões de ação (ignorar, excluir, ver detalhes) |
| `src/components/financeiro/ContasAReceber.tsx` | Adicionar `useDuplicateDetection` + `DuplicateAlerts` (atualmente ausente) |
| `src/hooks/useFinanceiroImport.ts` | Na etapa de preview, cruzar rows importadas com entries existentes e sinalizar possíveis duplicatas antes de confirmar |

### Lógica de similaridade de descrição

Implementar função simples de similaridade (normalizar texto + comparar tokens) sem dependência externa — suficiente para detectar "Aluguel Sala 01" vs "Aluguel - Sala 01".

### Ações do usuário nos alertas

- **Ignorar** — marca o par como revisado (estado local, não persiste)
- **Excluir duplicata** — botão para remover a entry duplicada diretamente
- **Ver detalhes** — expande mostrando os dois lançamentos lado a lado

### Proteção na importação

Na etapa de preview do `ImportDialog`, adicionar coluna "Status" que mostra badge "Possível duplicata" quando a row cruza com entry existente, permitindo ao usuário desmarcar antes de importar.

