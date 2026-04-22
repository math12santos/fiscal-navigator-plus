

# Plano: Engenharia anti-duplicidade e unificação de cálculos financeiros

## 1. Diagnóstico — onde duplicidades e divergências nascem hoje

O sistema mistura **lançamentos reais** (DB) com **projeções virtuais** (`id` prefixado `proj-`) em vários hooks. A integridade depende de chaves de deduplicação espalhadas por arquivos diferentes — e elas **não concordam entre si**.

### 1.1 Duplicidade entre módulos (lançamentos)

| Caminho | Como duplica hoje |
|---|---|
| **Contrato → Fluxo** | `useCashFlow` deduplica por `${contract_id}-${data_prevista}`; `useFinanceiro` faz o mesmo, mas só para `source='contrato'`. Se o usuário materializar com `source` diferente, projeção volta a aparecer. |
| **Parcela de contrato → Fluxo** | Em `useCashFlow` deduplica por `${contract_id}-${data_vencimento}`; em `useFinanceiro` usa `contract_installment_id`. As duas chaves não conversam — uma parcela materializada pela tabela `cashflow_entries` sem `contract_installment_id` (caso do `markAsPaid` antigo) reaparece como projeção. |
| **DP/Folha → Fluxo** | `useCashFlow` simplesmente concatena `payrollProjections` (não dedup). `useFinanceiro` dedup por `month` se já existe **qualquer** entrada `source='dp'` no mês — derruba projeções legítimas de outros funcionários. |
| **CRM ganho → Fluxo** | `useCRM.moveToStage` insere `cashflow_entries` com marcador `notes ILIKE '%opp:<id>%'`. Não há índice; concorrência (dois cliques rápidos) cria duas entradas. |
| **Planejamento RH → Fluxo** | `useDP.execute` insere com `notes` contendo `Item: <id>`. Sem checagem de existência → executar duas vezes duplica. |
| **Importação CSV → Fluxo** | `useFinanceiroImport` insere todas as linhas como `source='importacao'` sem cruzar com lançamentos manuais existentes do mesmo período/valor/fornecedor. |
| **Materialização (markAsPaid)** | `useFinanceiro.markAsPaid` para uma projeção **insere uma nova linha** em vez de marcar a projeção como materializada. Se o usuário marcar 2 vezes (clique duplo), gera 2 lançamentos pagos. |

### 1.2 Divergências de cálculo (mesmos KPIs, números diferentes)

| KPI | Onde calcula | Divergência |
|---|---|---|
| **Burn / Runway** | `useFinancialSummary.monthlyBurn` (sobre `entries` mesclado) **vs** `PlanningCockpit.avgMonthlySaida` (sobre `monthlyData` local) | Dashboard mostra X, Cockpit mostra Y — fórmulas equivalentes mas com basements diferentes (uma inclui projeções, outra também, mas o `entries` pode ter dedup distinta). |
| **Custo Folha/mês** | `usePayrollProjections.avgMonthlyPayroll = total/monthCount` **vs** `useGroupTotals.payrollTotal` | Divisor diferente (uma usa meses do horizonte, outra soma bruta) → `groupShare` percentuais errados. |
| **Saldo / Totais** | `useCashFlow.totals` soma `valor_realizado ?? valor_previsto` para tudo. Inclui projeções **e** materializações. Conta dobrado quando ambas existem por janela de tempo na borda. |
| **Plan×Real "Realizado"** | Já corrigido (usa `materializedEntries` + filtro de status). Mas Cockpit e Dashboard ainda usam `entries` (mesclado). |
| **Total previsto AP/AR** | `useFinanceiro.totals.total_previsto` soma **todas** as entradas (incluindo já pagas). Subestima "pendente" e infla "previsto". |

### 1.3 Risco arquitetural

Não existe **uma única função** que decida se uma entrada virtual deve ou não ser apresentada. A lógica vive duplicada em `useCashFlow`, `useFinanceiro`, `PendenciasPanel`, `PlannedVsActual`, `usePlanningPdfReport` — cinco implementações divergentes.

---

## 2. Solução — três camadas

### Camada A · Origem única de verdade para projeções (`src/lib/projectionRegistry.ts` – novo)

Centraliza **todas** as fontes de projeção e suas chaves de deduplicação canônicas:

```ts
type ProjectionSource = "contrato" | "contrato_parcela" | "dp" | "crm_won" | "hr_planning";

interface ProjectionKey {
  source: ProjectionSource;
  // chave estável usada para casar projeção ↔ realização
  dedupKey: string; // ex.: "contrato:<id>:2025-03-15"
  // chave secundária para deduplicar entre projeção e DB
  externalRef: string; // colocada em notes/metadata: "ref:contrato:<id>:2025-03-15"
}

export function buildProjections(ctx: ProjectionContext): VirtualEntry[];
export function dedupAgainstMaterialized(virtual, materialized): VirtualEntry[];
```

Regras MECE definitivas:
- **Contrato recorrente** → chave `contrato:<id>:<yyyy-MM-dd>`
- **Parcela** → chave `parcela:<installment_id>` (quando existir) **OU** `contrato:<id>:<vencimento>` (fallback)
- **Folha DP** → chave `dp:<employee_id>:<sub_category>:<yyyy-MM>` (granular, não por mês inteiro)
- **CRM ganho** → chave `crm:<opportunity_id>` (única por oportunidade)
- **Planejamento RH** → chave `hr:<item_id>`

### Camada B · Marcador persistente de origem (migração SQL)

Adicionar 2 colunas em `cashflow_entries`:
- `source_ref TEXT` — guarda o `dedupKey` quando a entrada nasce de uma projeção materializada
- `dedup_hash TEXT` — hash determinístico de `(organization_id, source, source_ref)` com **índice UNIQUE parcial** `WHERE source_ref IS NOT NULL`

Isso transforma deduplicação em garantia de banco, não suposição de UI. Substitui os `ILIKE '%opp:%'`, regex em `notes` e `Set<string>` espalhados.

```sql
ALTER TABLE cashflow_entries
  ADD COLUMN source_ref TEXT,
  ADD COLUMN dedup_hash TEXT GENERATED ALWAYS AS (
    CASE WHEN source_ref IS NOT NULL
      THEN md5(organization_id::text || '|' || source || '|' || source_ref)
    END
  ) STORED;

CREATE UNIQUE INDEX cashflow_entries_dedup_uq
  ON cashflow_entries (dedup_hash)
  WHERE dedup_hash IS NOT NULL;
```

Backfill: extrair `opp:<id>` e `Item: <id>` de `notes` para `source_ref` no script de migração.

### Camada C · Hook único de cálculo (`src/hooks/useFinancialMetrics.ts` – novo)

Substitui as 3+ implementações de burn/runway/totais. Expõe:

```ts
useFinancialMetrics(rangeFrom, rangeTo) → {
  realized: { entradas, saidas, saldo, byMonth },        // só DB com status realizado
  projected: { entradas, saidas, saldo, byMonth },        // só virtuais (sem dupla)
  consolidated: { entradas, saidas, saldo, byMonth },     // realized + projected sem overlap
  burn: { atual, projetado, media12m },                   // 3 visões nomeadas
  runway: { conservador, base, otimista },                // por cenário
  payroll: { mensalMedio, fonte: "dp_real" | "dp_proj" }
}
```

`useFinancialSummary`, `PlanningCockpit`, `Dashboard`, `FluxoCaixa`, `PlannedVsActual` e `usePlanningPdfReport` passam a consumir este hook → garante 1 número, 1 fórmula, 1 valor exibido.

---

## 3. Correções pontuais por hook

| Arquivo | Correção |
|---|---|
| `useCashFlow.ts` | Remover dedup local; delegar a `projectionRegistry`. `totals` passa a usar `useFinancialMetrics`. |
| `useFinanceiro.ts` | `markAsPaid` em projeção → **upsert por `source_ref`** em vez de insert puro (idempotente). `totals.pendente` passa a excluir status `pago/recebido/conciliado`. |
| `useCRM.ts` | `moveToStage` Won → `upsert(..., { onConflict: 'dedup_hash' })` em vez de `select+insert`. |
| `useDP.ts` | `execute` planejamento RH → mesmo upsert idempotente. |
| `useFinanceiroImport.ts` | Antes do insert em massa: rodar `detectImportDuplicates` **server-side** (RPC) e oferecer skip/merge na revisão. |
| `usePayrollProjections.ts` | Manter granularidade por funcionário+sub_categoria (já correta). Documentar chave canônica. |
| `useFinancialSummary.ts` | Reescrito sobre `useFinancialMetrics`. Burn/runway alinhados ao Cockpit. |
| `useGroupTotals.ts` | `payrollTotal` passa a usar `monthlyPayrollTotal` (não `avg`) para o denominador de share. |

---

## 4. Detecção em runtime (já parcial, completar)

`useDuplicateDetection` ganha uma 6ª categoria: **`source_ref_collision`** — entradas com mesmo `(source, source_ref)` que escaparam do índice (ex.: dados pré-migração). Severity = `high`, ação direta de exclusão da mais nova.

Banner persistente no header do Financeiro quando houver ≥1 colisão de `source_ref` no escopo ativo.

---

## 5. Migração e ordem de execução

1. **SQL** — colunas `source_ref` + `dedup_hash` + índice + backfill (`opp:` e `Item:`).
2. **`projectionRegistry.ts`** — extrair lógica atual e padronizar chaves.
3. **`useFinancialMetrics.ts`** — novo hook único.
4. **Refatorar** `useCashFlow`/`useFinanceiro` para consumir A+C.
5. **Idempotência** — converter os 3 inserts (CRM, RH, materialização) para upsert por `source_ref`.
6. **Migrar consumidores** (Dashboard, Cockpit, FluxoCaixa, PlannedVsActual, PDF) para `useFinancialMetrics`.
7. **Importação** — RPC server-side de pré-checagem + UI de skip/merge.
8. **Detecção runtime** — adicionar 6ª categoria + banner.

---

## 6. Detalhes técnicos relevantes

- **Sem breaking change visível**: telas continuam mostrando os mesmos campos; apenas valores ficam consistentes entre módulos.
- **Hist comp**: backfill preserva entradas já existentes; `dedup_hash` só impede **futuras** duplicatas.
- **RLS**: nova coluna herda políticas existentes (já scoped por `organization_id`).
- **Performance**: `dedup_hash` é `STORED` → índice rápido; substitui scans `ILIKE '%opp:%'` (full table scan hoje).
- **Compatibilidade Holding**: chaves incluem `organization_id` no hash → não há colisão cruzada entre subsidiárias.
- **Testes**: criar `src/test/projectionRegistry.test.ts` cobrindo cada uma das 5 fontes + colisões.

## 7. Resultado esperado

| Antes | Depois |
|---|---|
| 5 lugares fazem dedup com chaves diferentes | 1 registry + 1 índice DB |
| Burn/Runway diferem entre Dashboard, Cockpit e PDF | Mesmo número em todas as telas |
| Clique duplo cria duplicata em CRM/RH | Upsert idempotente garantido pelo banco |
| `notes ILIKE '%opp:%'` (lento) | Lookup por `dedup_hash` (UNIQUE index) |
| Custo Folha/mês com 2 fórmulas | 1 fonte (`useFinancialMetrics.payroll.mensalMedio`) |
| Materialização repetida vira 2 pagos | Upsert por `source_ref` impede |

