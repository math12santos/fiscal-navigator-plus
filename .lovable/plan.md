# Extrato imutável + criar lançamento + transferências + estornos (MECE)

Este plano consolida 4 demandas que se entrelaçam no fluxo de resolução de extrato bancário, todas regidas pelo princípio: **o extrato é a verdade realizada e imutável; o sistema deve absorver toda movimentação sem duplicidade.**

## Princípios

1. **Imutabilidade do extrato** — data e valor de uma linha bancária não podem ser editados pelo usuário.
2. **Cobertura total (MECE-collectively exhaustive)** — toda linha do extrato precisa virar um destino: vincular a previsto, criar lançamento novo, marcar como transferência (par) ou estornar um realizado anterior.
3. **Não-duplicação (MECE-mutually exclusive)** — transferência aparece como **uma única operação** (1 saída + 1 entrada = mesmo evento); estorno **anula** o realizado original em vez de criar uma receita/despesa nova.

---

## 1. Travar data/valor na correção (Corrigir → "Complementar dados")

- Renomear ação **"Corrigir"** para **"Complementar dados"** em `StatementResolutionPanel.tsx`.
- Campos `data` e `valor` ficam **read-only** com badge "imutável (vem do extrato)" quando o `parsed` original já tinha valores válidos.
- Continuam editáveis apenas: **descrição** e **documento**.
- Caso o parser não tenha conseguido ler data/valor (erro real do arquivo OFX), os campos abrem para edição com aviso explícito.
- Backend: `resolve_correct_and_retry` recusa alteração de data/valor quando `staging.parsed` já tinha esses campos válidos (compara com snapshot original em `raw`); registra tentativas em `audit_log`.

---

## 2. Criar lançamento a partir da linha do extrato

Novo botão **"Criar lançamento"** ao lado de "Vincular", para o caso "não existe previsto".

- Habilitado quando data/valor estão válidos.
- Abre `CreateCashflowFromStatementDialog` com:
  - Cabeçalho fixo: data + valor (read-only, badge imutável).
  - Tipo (`despesa`/`receita`) inferido pelo sinal — não editável.
  - Campos do usuário: descrição (pré-preenchida), conta contábil, centro de custo, fornecedor/cliente, contrato (opcional), observações.
  - Botão **"Criar e marcar como realizado"**.
- Backend: nova RPC `resolve_create_cashflow` (SECURITY DEFINER) que, em transação:
  1. Insere `cashflow_entries` com `tipo` derivado do sinal, `data_prevista = data_realizada = parsed.data`, `valor_previsto = valor_realizado = abs(parsed.valor)`, `status = 'pago'|'recebido'`, `source = 'extrato_bancario'`, classificação informada, `bank_account_id`.
  2. Insere `bank_statement_entries` apontando para o novo `cashflow_entry_id`, status `conciliado`.
  3. Atualiza `bank_statement_staging` → `status='vinculado'`, `resolution = {"via":"create_from_statement", ...}`.
  4. `audit_log` com ação `cashflow_created_from_statement`.
  5. Respeita trava de fechamento de período fiscal já existente.
- Como passa por `bank_statement_entries`, a regra MECE 3 estados ("só conciliação promove a realizado") permanece íntegra — previsto e realizado nascem juntos no mesmo ato.

---

## 3. Transferências entre contas da mesma empresa

Toda transferência interna gera **duas linhas no extrato** (saída na conta A, entrada na conta B). O sistema deve representá-la como **um único evento** (sem virar despesa+receita).

### Modelo de dados

- Nova tabela `internal_transfers`:
  - `organization_id`, `from_bank_account_id`, `to_bank_account_id`, `valor`, `data`, `descricao`, `notes`, `created_by`.
  - `from_cashflow_entry_id`, `to_cashflow_entry_id`, `from_bank_statement_entry_id`, `to_bank_statement_entry_id` (todos nullable até a contraparte aparecer).
  - `status`: `aguardando_contraparte` (1 lado conciliado) | `completa` (2 lados conciliados).
- `cashflow_entries` ganha coluna `transfer_id uuid references internal_transfers(id)` e `categoria='transferencia_interna'` reservada.
- Trigger `cashflow_realize_guard` permite `pago/recebido` em entradas com `transfer_id` se ambas as pontas estão pareadas via reconciliação.
- **DRE/KPIs/Dashboard** ignoram entradas com `categoria='transferencia_interna'` (não contam como receita/despesa) — apenas afetam saldo bancário por conta.

### Fluxo na resolução

Novo botão **"É transferência entre contas"** no `StatementResolutionPanel`:

- Abre `MarkAsTransferDialog` mostrando:
  - Cabeçalho com a linha atual (conta + valor + data, read-only).
  - Lista de candidatos automáticos: linhas do staging/extrato em **outras contas da mesma org** com `valor` oposto e `data` em janela de ±3 dias úteis.
  - Opção "Criar contraparte virtual" caso a outra ponta ainda não tenha sido importada (cria registro `aguardando_contraparte`; quando o outro extrato chegar, o sistema sugere o pareamento).
- Backend RPC `resolve_mark_as_transfer(p_staging_id, p_counterparty_staging_id?)`:
  - Se `counterparty` informado: cria `internal_transfers` com ambos os pares, gera 2 `cashflow_entries` (transferencia_interna, ambas com `transfer_id`), liga a 2 `bank_statement_entries`, atualiza ambos staging → `vinculado`, status da transferência → `completa`.
  - Se sem contraparte: cria `internal_transfers` parcial, marca staging atual → `vinculado_parcial`, e a sugestão de pareamento entra no painel quando a outra linha aparecer.
  - Validações: contas pertencem à mesma `organization_id`, valores opostos com tolerância configurável, datas dentro da janela.

### Detecção pró-ativa

- Hook `unresolved` passa a expor flag `provavel_transferencia` quando o algoritmo encontra par óbvio (mesmo módulo, valores espelho).
- Banner sugere "X linhas parecem ser transferências entre contas — revisar".

---

## 4. Estornos / devoluções (sem duplicidade)

Estorno = linha bancária que **anula** um realizado anterior (estorno de pagamento, devolução de cobrança, chargeback). Tratar como **anti-lançamento**, não como nova receita/despesa.

### Modelo

- `cashflow_entries` ganha colunas `is_estorno boolean default false` e `estorno_de_entry_id uuid references cashflow_entries(id)`.
- Constraint: se `is_estorno=true`, `estorno_de_entry_id` obrigatório, e `tipo` deve ser **oposto** ao da entrada original; valor deve igualar o original.
- Original recebe `estornado_em`, `estornado_por_entry_id` para rastreio reverso.
- DRE/KPIs: estorno **subtrai** do realizado original (mostrado como "líquido após estorno"); nunca soma como receita avulsa.

### Fluxo na resolução

Novo botão **"É estorno/devolução"** no painel:

- Abre `MarkAsReversalDialog` mostrando:
  - Cabeçalho da linha (read-only).
  - Lista de candidatos: `cashflow_entries` da mesma org/conta, **status `pago`/`recebido`**, valor igual em sentido oposto, data dentro de janela de 90 dias.
  - Filtro/busca por descrição, fornecedor, documento.
  - Aviso quando o original já foi estornado (impede duplicidade).
- Backend RPC `resolve_mark_as_reversal(p_staging_id, p_original_entry_id)`:
  1. Valida: original existe, está realizado, ainda não estornado, mesma org, sinais opostos, valores casam.
  2. Cria `cashflow_entries` com `is_estorno=true`, `estorno_de_entry_id`, `status='pago'/'recebido'`, `source='extrato_bancario'`, `bank_account_id` da linha.
  3. Liga a `bank_statement_entries` (status `conciliado`).
  4. Atualiza original: `estornado_em = now()`, `estornado_por_entry_id`.
  5. Atualiza staging → `vinculado` com `resolution.via='reversal'`.
  6. `audit_log` com ação `cashflow_reversed`.
- Trigger impede 2º estorno do mesmo `original_entry_id`.

### KPI de fechamento

`get_month_closing_readiness` continua exigindo 100% de extrato resolvido — transferências e estornos contam como "resolvidos".

---

## 5. UI consolidada

`StatementResolutionPanel` passa a ter (por linha):

```
[Complementar] [Vincular a previsto] [Criar lançamento] [É transferência] [É estorno] [Descartar]
```

- Botões agrupados em dropdown "Mais ações" se ficar apertado em 1454px.
- Banner no topo com contadores: `N a resolver · X parecem transferências · Y parecem estornos`.
- Cada ação abre seu próprio diálogo focado.

---

## Arquivos afetados

```text
supabase/migrations/<novo>_statement_resolution_v2.sql
  - tabela internal_transfers + RLS
  - colunas: cashflow_entries.transfer_id, is_estorno, estorno_de_entry_id, estornado_em, estornado_por_entry_id
  - RPCs: resolve_create_cashflow, resolve_mark_as_transfer, resolve_mark_as_reversal
  - ajuste resolve_correct_and_retry (recusa alterar data/valor já válidos)
  - ajuste cashflow_realize_guard (whitelist transferencia_interna + estorno via reconciliação)
  - constraints/triggers anti-duplicidade (estorno único, transferência única por par)

src/hooks/useStatementResolution.ts
  - + createFromStatement, markAsTransfer, markAsReversal
  - + searchTransferCounterparties, searchReversalCandidates

src/components/financeiro/StatementResolutionPanel.tsx
  - read-only data/valor no Complementar
  - 3 novos botões + dropdown agrupador
  - banner de detecção pró-ativa

src/components/financeiro/CreateCashflowFromStatementDialog.tsx     (novo)
src/components/financeiro/MarkAsTransferDialog.tsx                  (novo)
src/components/financeiro/MarkAsReversalDialog.tsx                  (novo)

src/hooks/useFinanceiro.ts
  - excluir entradas com categoria='transferencia_interna' dos totais de Previsto/Realizado de AP/AR
  - exibir realizados estornados como "líquido após estorno"

src/hooks/useDashboardKPIs.ts / RPC get_dashboard_kpis
  - filtrar transferencia_interna; subtrair estornos do realizado
```

## Fora de escopo

- Não mexer em `LinkToPlannedDialog` (já cumpre o vínculo a previsto e correção de conciliação anterior).
- Não alterar lógica de fechamento de período além de tratar os novos status como "resolvidos".
- Não mexer na importação OFX em si — só na camada de resolução.
- Conciliação automática de transferências por algoritmo de matching fica para fase futura; nesta entrega o usuário confirma o par.
