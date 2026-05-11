## Objetivo

Transformar a aba **Financeiro → Conciliação** na **porta de entrada da realidade financeira**: importar extratos bancários em **XLSX, OFX e PDF**, casar automaticamente com lançamentos previstos, e **exigir classificação contábil de qualquer linha não-prevista antes de marcá-la como conciliada** — gerando assim um `cashflow_entry` real e mantendo o caixa fiel ao banco.

## Estado atual

Já existe:
- `BankStatementImportDialog` (CSV/XLSX) → grava em `bank_statement_entries` com `status='pendente'`.
- RPC `match_statement_to_cashflow_v2` (similaridade textual + ±valor/data) e `auto_reconcile_statement_batch` (score ≥ 0.95).
- `ConciliacaoTab` com auto-conciliar, regras (`reconciliation_rules`) e snapshot de saldo.

Faltam:
1. Suporte a **OFX** e **PDF** no importador.
2. Fluxo de **classificação obrigatória** antes de conciliar linhas sem candidato.
3. Visual claro do **funil**: previstas casadas / divergentes / não-previstas.

## Escopo

### 1. Parsers adicionais no `useBankStatementImport`

- **OFX** (`.ofx`, `.qfx`): parser próprio em TS lendo blocos `<STMTTRN>` (DTPOSTED, TRNAMT, MEMO, NAME, FITID, CHECKNUM). FITID vira `documento` e participa da deduplicação. Detecta cabeçalho SGML/OFX 1.x e XML 2.x.
- **PDF** (`.pdf`): extração textual via `pdfjs-dist` no cliente. Heurística por linha: `dd/mm/aaaa  descrição  valor (D/C)`. Como PDFs variam por banco, oferecer **revisão manual obrigatória** no passo "mapeamento" — usuário confirma colunas detectadas/edita, mesmo fluxo do XLSX. Mostrar aviso "PDF é melhor esforço; recomendamos OFX/XLSX quando disponível".
- Reutilizar o resto do pipeline (preview, deduplicação, `bank_statement_entries`).

Aceitar arquivos: `.csv,.xlsx,.xls,.ofx,.qfx,.pdf`.

### 2. Motor "Pré-conciliação" após importar

Ao concluir a importação, executar automaticamente uma **análise de cobertura** que classifica cada linha nova em três baldes via `match_statement_to_cashflow_v2`:

```text
┌──────────────────────────┬───────────────────────────────────────────┐
│ casado_alto (≥ 0.85)     │ Auto-concilia em background.              │
│ casado_baixo (0.50–0.85) │ Aparece como "Sugestão" (1 clique).       │
│ nao_previsto (< 0.50 ou  │ Bloqueia conciliar até o usuário          │
│  sem candidato)          │ classificar contabilmente (ver passo 3).  │
└──────────────────────────┴───────────────────────────────────────────┘
```

Implementação: nova RPC `classify_statement_coverage(p_org_id, p_import_id)` que retorna contagens + lista. Dispara após `executeImport` e abre um painel-resumo "Resultado da importação" no próprio Dialog (passo `done`):

- ✅ `X` linhas casadas com lançamentos previstos
- ⚠ `Y` linhas com sugestões (revisar)
- 🚨 `Z` linhas **não previstas** — exigem classificação

### 3. Classificação obrigatória de não-previstos

Nova ação na `ConciliacaoTab` para linhas pendentes sem candidato: botão **"Classificar e conciliar"** (substitui "Conciliar" quando `match_score < 0.5` ou nenhum candidato). Abre um `Dialog` enxuto reaproveitando os campos do `ClassificacaoDialog` existente:

Campos obrigatórios:
- Tipo (`receita` ou `despesa`, pré-preenchido pelo sinal do valor)
- Conta contábil (`chart_of_accounts`, 4 níveis)
- Centro de custo (ou rateio)
- Entidade/fornecedor (opcional, com sugestão se descrição bater com `entities`)
- Competência (default = mês da `data` do extrato)
- Observação (default = descrição do extrato)

Ao confirmar, RPC `materialize_unplanned_statement_entry(p_statement_id, p_classification jsonb)`:
1. Cria `cashflow_entries` com `status='realizado'`, `data_realizada=data do extrato`, `valor_realizado=valor`, `source='conciliacao'`, `source_ref='statement:<id>'`.
2. Aplica RLS/cost-center splits se houver rateio (mesma lógica do `FinanceiroEntryDialog`).
3. Vincula `bank_statement_entries.cashflow_entry_id` e marca `status='conciliado'`.
4. Opcional: salva regra (`reconciliation_rules`) "se descrição contém X → usar conta Y / CC Z" para automatizar próximas importações.

Bloquear no front: para linhas marcadas `nao_previsto`, o botão "Conciliar" simples fica oculto — só aparece "Classificar e conciliar" ou "Ignorar".

### 4. UX da Conciliação

- Adicionar 1 KPI extra: **"Não previstos"** (count de pendentes sem candidato) com cor `destructive`.
- Filtro extra no Select de status: `"nao_previsto"`, `"sugestao"`, `"casado"`.
- Coluna `Match` na tabela mostrando badge de score ou "Sem candidato".
- Banner topo se `nao_previsto > 0`: "X lançamentos não estavam no plano. Classifique antes de conciliar para manter o caixa real."

### 5. Realtime e cache

- `useRealtimeSync(['bank_statement_entries','cashflow_entries'])` na aba (já parcialmente).
- Invalidar `cashflow-entries`, `dashboard_snapshots`, `cash-position` após materializar.

## Arquivos

**Novos**
- `src/lib/parsers/ofxParser.ts`
- `src/lib/parsers/pdfStatementParser.ts` (usa `pdfjs-dist`)
- `src/components/financeiro/ClassifyAndReconcileDialog.tsx`
- Migração SQL com:
  - RPC `classify_statement_coverage`
  - RPC `materialize_unplanned_statement_entry`
  - Coluna `match_score numeric` e `match_bucket text` em `bank_statement_entries` (preenchida no import + auto-reconcile)

**Editados**
- `src/hooks/useBankStatementImport.ts` (rotear por extensão; aceitar OFX/PDF; rodar `classify_statement_coverage` ao final)
- `src/components/financeiro/BankStatementImportDialog.tsx` (extensões aceitas, banner PDF, painel resultado)
- `src/components/financeiro/ConciliacaoTab.tsx` (KPI, filtro, badge match, botão "Classificar e conciliar", banner)
- `src/hooks/useConciliacao.ts` (mutações `materializeUnplanned`, filtros por bucket)
- `package.json`: adicionar `pdfjs-dist`

## Critérios de aceite

1. Importar `.ofx` real e ver linhas em `bank_statement_entries` com `documento=FITID`.
2. Importar `.pdf` de extrato e revisar/ajustar mapeamento antes de salvar.
3. Após importar, abrir painel "Resultado" mostrando casados/sugestões/não-previstos.
4. Linha "não-prevista" não pode ser marcada conciliado sem passar pelo dialog de classificação.
5. Ao classificar, um `cashflow_entry` realizado é criado com a mesma data/valor e a linha vira `conciliado`.
6. Saldo da conta (cash position) reflete imediatamente o novo realizado.
7. Re-importar o mesmo arquivo não duplica linhas (deduplicação por `source_ref`/FITID já existente).

## Fora de escopo (próxima onda)

- Parsing PDF por banco específico com templates (Itaú, Bradesco, BB) — fica como melhoria iterativa.
- Conciliação de cartão de crédito (fatura ≠ extrato).
- Importação direta via Open Finance API.