## Objetivo

Garantir que todo lançamento financeiro tenha **mês de competência** registrado e expor os indicadores **PMP (Prazo Médio de Pagamento)** e **PMR (Prazo Médio de Recebimento)** nos respectivos módulos.

## Conceito

- **Competência** = mês ao qual o gasto/receita "pertence" economicamente (quando o serviço foi prestado / a obrigação foi gerada), independente de quando é pago.
- **PMP** = média ponderada (por valor) de dias entre **competência** e **data de pagamento realizada** das contas pagas.
- **PMR** = mesmo cálculo para contas recebidas.

Fórmula:

```text
PMP = Σ(valor_pago × (data_pagamento − último dia do mês de competência)) / Σ(valor_pago)
```

## 1. Captura da competência (3 frentes)

### A. Importação CSV/XLS (`useFinanceiroImport.ts` + `ImportDialog.tsx`)

- Adicionar campo `competencia` em `TARGET_FIELDS`:
  ```ts
  { value: "competencia", label: "Mês Competência", required: false }
  ```
- No `buildPreview`, parsear o valor:
  - Se vier como `MM/YYYY`, `YYYY-MM`, ou data completa → normalizar para `YYYY-MM`.
  - Se ausente → fallback automático = mês de `data_prevista` (`YYYY-MM`).
- No editor inline de erros (recém criado), incluir campo `Mês Competência` (input `type="month"`) com badge "auto-preenchido" quando vier do fallback.

### B. Edge function `detect-import-mapping`

- Acrescentar `competencia` à lista de targets sugeridos (sinônimos: "competência", "mês ref", "ref", "período", "competence", "ref month").

### C. Lançamento manual (`FinanceiroEntryDialog.tsx`)

- Já existe input. Adicionar **fallback automático**: se usuário não preencher, salvar `format(data_prevista, "yyyy-MM")` antes do submit.

### D. Materialização de virtuais (contratos, folha, Notas Fiscais via XML e PDF etc.)

- Verificar nos hooks `usePayrollProjections`, contratos, CRM: garantir que ao materializar a `cashflow_entry` o campo `competencia` seja preenchido (folha já tem `reference_month`; mapear para `competencia`).

## 2. Cálculo e exibição de PMP/PMR

Novo hook `src/hooks/useFinanceiroAvgTerms.ts`:

- Recebe `tipo: "saida" | "entrada"` e janela (default últimos 90 dias por `data_realizada`).
- Query: `cashflow_entries` onde `status` ∈ {pago, recebido}, `data_realizada` não nulo, `competencia` não nulo, `organization_id`.
- Calcula:
  - `pmp` (ou `pmr`) ponderado por `valor_realizado`.
  - `cobertura` = % de lançamentos pagos com competência preenchida (alerta se < 80%).
  - Série mensal (últimos 6 meses) para mini-gráfico.

### Onde exibir

- **Contas a Pagar** (`ContasAPagar.tsx`): novo `KPICard` "PMP — últimos 90 dias" com valor em dias + sub `cobertura X%`.
- **Contas a Receber** (`ContasAReceber.tsx`): `KPICard` "PMR — últimos 90 dias".
- Tooltip explicando a fórmula e link "Ver detalhes" abrindo dialog com:
  - Distribuição por faixa (0–30, 31–60, 61–90, 90+ dias).
  - Top 5 fornecedores/clientes por prazo.
  - Lista de lançamentos sem competência (link para corrigir).

## 3. Banco de dados

Criar **trigger** `cashflow_entries_set_competencia_default`:

- BEFORE INSERT/UPDATE: se `NEW.competencia IS NULL` e `NEW.data_prevista IS NOT NULL`, preenche com `to_char(NEW.data_prevista, 'YYYY-MM')`.
- Garante MECE: nenhum lançamento fica sem competência.

Backfill (insert tool, via script SQL): atualizar `cashflow_entries` históricos onde `competencia IS NULL` usando `to_char(data_prevista, 'YYYY-MM')`.

Índice: `CREATE INDEX idx_cashflow_competencia ON cashflow_entries(organization_id, tipo, competencia)` para acelerar agregações.

## 4. Memória

Salvar memória `mem://features/financial-pmp-pmr` documentando:

- Convenção `competencia = "YYYY-MM"` (texto).
- Fallback automático = mês de `data_prevista`.
- Fórmula PMP/PMR ponderada por valor.

## Arquivos afetados

- `supabase/migrations/<new>.sql` — trigger + índice.
- `src/hooks/useFinanceiroImport.ts` — novo target field + parsing + fallback.
- `src/components/financeiro/ImportDialog.tsx` — editor inline ganha campo competência.
- `src/components/financeiro/FinanceiroEntryDialog.tsx` — fallback no submit.
- `src/components/financeiro/ContasAPagar.tsx` + `ContasAReceber.tsx` — KPI PMP/PMR.
- `src/hooks/useFinanceiroAvgTerms.ts` — **novo** (cálculo).
- `src/components/financeiro/AvgTermsDetailDialog.tsx` — **novo** (drill-down).
- `supabase/functions/detect-import-mapping/index.ts` — sugerir competência.
- Backfill via insert tool + memória.

## Fora do escopo

- PMP/PMR por centro de custo/cliente individual no dashboard executivo (pode ser evolução).
- Reclassificação retroativa de competência em lote (hoje basta editar lançamento por lançamento).