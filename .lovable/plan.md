

## Validações de range + granularidade (Mensal/Trimestral) no Relatório KPI

Adicionar **validações robustas** ao seletor de período e introduzir um **seletor de granularidade (Mensal/Trimestral)** que reagrega a composição e o total exibidos no drill-down do KPI, sem alterar a lógica do Dashboard.

### O que o usuário verá

**1. Validações de range (em todos os pontos que aplicam datas)**

Aplicadas no `RangePicker`, no `KpiPeriodPresetsPopover` e ao salvar um preset:

- `to >= from` — bloqueia "data fim antes da data início".
- Range dentro de **2000–2099** (alinhado à regra de entrada de datas do projeto).
- Janela máxima de **5 anos** — evita drill-down impraticável (centenas de milhares de linhas).
- `from`/`to` precisam ser datas válidas; URL com `?from=` inválido cai no default e exibe um toast "Período da URL inválido — usando últimos 6 meses".
- Botão "Aplicar" desabilitado enquanto o range estiver inválido, com mensagem inline em texto pequeno destrutivo (ex.: "A data fim não pode ser anterior à data início").
- Ao tentar **salvar preset** com range inválido, o form bloqueia o submit e mostra a mesma mensagem.

**2. Seletor de granularidade**

Um pequeno `ToggleGroup` (`Mensal` / `Trimestral`) ao lado do "Total", persistido em `?gran=mensal|trimestral` (default: `mensal`):

- **Mensal** (comportamento atual): tabela mostra cada lançamento/contrato individualmente.
- **Trimestral**: a tabela passa a mostrar **uma linha por trimestre** (`2025-Q1`, `2025-Q2`...) com colunas:
  - Período (ex.: "2025-Q1 — jan–mar/2025")
  - Itens (contagem)
  - Valor total (soma do trimestre)
  - Para KPIs com tipo (entrada/saída): colunas separadas Entradas / Saídas / Líquido.

A granularidade afeta apenas KPIs com dimensão temporal de fluxo (`receita-mensal`, `despesas-mensais`, `resultado-mensal`, `saldo-periodo`, `runway`). Para KPIs **estruturais** (`contratos-ativos`, `custo-folha`, `passivos`, `crm-pipeline`) o toggle fica oculto — não faz sentido agrupar por trimestre uma lista de contratos vigentes.

O **Total** continua sendo a soma única do horizonte (independe da granularidade — granularidade é apenas a forma de exibição), e o painel de **Reconciliação** com o KPI do Dashboard continua válido. Adicionamos uma nota curta sob o toggle: "A granularidade muda apenas a forma de exibição; o total e a reconciliação não mudam".

**3. CSV consciente da granularidade**

O export CSV passa a respeitar a visão atual:
- Mensal: exporta linhas individuais (como hoje).
- Trimestral: exporta linhas agregadas por trimestre.
Sufixo no arquivo: `-trimestral` quando aplicável.

### Como funciona por baixo

- **Novo helper `src/lib/kpiRangeValidation.ts`**:
  - `validateRange(from: string, to: string): { ok: boolean; reason?: "invalid_date" | "inverted" | "out_of_bounds" | "too_wide"; message?: string }`.
  - Constantes `MIN_YEAR=2000`, `MAX_YEAR=2099`, `MAX_YEARS_SPAN=5`.
- **`src/pages/RelatorioKpi.tsx`**:
  - Lê `?gran=` do URL (default `mensal`); novo callback `applyGranularity(g)` atualiza a query.
  - Saneia `?from`/`?to` na inicialização: se inválidos → cai no default + `toast.warning`.
  - Novo memo `aggregatedRows` que pega `filteredItems` e, quando `gran === "trimestral"` e `kind ∈ {cashflow, result}`, agrupa por `format(parseISO(item.data), "yyyy-'Q'Q")` somando valores e contando itens.
  - `renderHeader`/`renderRow` ganham um `kind` adicional `"cashflow-quarter"` / `"result-quarter"` para a visão trimestral.
  - `exportCsv` usa `aggregatedRows` em vez de `filteredItems` quando trimestral.
- **`KpiPeriodPresetsPopover`**:
  - Form de salvar preset chama `validateRange` antes do submit; mostra erro inline e bloqueia "Salvar".
- **Sem alteração de schema**: as validações vivem no client; o trigger SQL de `kpi_period_presets` já garante `range_from <= range_to` no servidor (defesa em profundidade).

### Auditabilidade & princípios

- Granularidade é puramente de **apresentação** — o total bruto e a reconciliação contra o Dashboard permanecem como referência única de verdade.
- Validações impedem URLs compartilhadas que produziriam tabelas vazias por engano (ex.: range invertido) ou cargas excessivas (>5 anos), mantendo o relatório reproduzível e performático.
- Toast informa o usuário quando o sistema corrige uma URL inválida — nada acontece silenciosamente.

### Arquivos

- **Criar**: `src/lib/kpiRangeValidation.ts`.
- **Editar**: `src/pages/RelatorioKpi.tsx` (toggle de granularidade, agregação trimestral, saneamento da URL, CSV ciente).
- **Editar**: `src/components/relatorio/KpiPeriodPresetsPopover.tsx` (validação no form de salvar).

