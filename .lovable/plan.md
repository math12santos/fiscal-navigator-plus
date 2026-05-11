## Princípio (MECE)

Toda linha de um extrato (OFX/XLSX/CSV/PDF) **precisa** terminar em exatamente um destes destinos. Nenhuma linha pode ser descartada silenciosamente.

```
linha do arquivo
   ├─ Importada e conciliada (auto-match alto)            ← já existe
   ├─ Importada e sugerida (match parcial, 1 clique)      ← já existe
   ├─ Importada e classificada como realizado              ← já existe (ClassifyAndReconcile)
   ├─ Vinculada a um previsto ainda não conciliado          ← NOVO
   ├─ Vinculada a um previsto JÁ conciliado (corrigindo histórico)  ← NOVO
   └─ Descartada com motivo (audit log)                    ← NOVO
```

Hoje, 49/49 falhas viram um botão "Baixar CSV das falhas" — isso quebra o princípio.

---

## Diagnóstico do caso 49/49 (OFX)

Antes de implementar, instrumentar o parser para reportar **por linha** o que falhou. Hipóteses prováveis:
- OFX do banco usa tags fora do padrão (ex.: `<TRNAMT>` com vírgula decimal, `<DTPOSTED>` em formato local) — `ofxParser.ts` hoje só aceita yyyymmdd e ponto decimal.
- `parseBRDate` é aplicada por engano em ISO se o `detectedFormat` foi alterado pelo usuário.
- RLS/unique-constraint rejeitando o batch inteiro em `bank_statement_entries`.

Robustez no `parseOfx`:
- Aceitar `TRNAMT` com vírgula (`1.234,56`) e sinal posfixado.
- Aceitar `DTPOSTED` curto/longo e com timezone.
- Se `STMTTRN` não for encontrado, tentar `BANKTRANLIST` solto.
- Sempre devolver as linhas brutas mesmo quando algum campo falhar (validação fica no staging).

---

## Backend

**Nova tabela `bank_statement_staging`** (toda linha do arquivo é persistida, inclusive inválidas):

| coluna | tipo |
|---|---|
| id | uuid |
| organization_id | uuid |
| bank_account_id | uuid |
| import_id | uuid (FK `data_imports`) |
| row_index | int |
| raw | jsonb |
| parsed | jsonb |
| errors | text[] |
| status | enum: `pendente`, `importado`, `vinculado`, `descartado`, `erro_validacao` |
| resolution | jsonb (cashflow_entry_id, motivo, flag `previa_conciliacao_substituida`) |
| bank_statement_entry_id | uuid |
| resolved_by / resolved_at | uuid / timestamptz |

RLS por `organization_id`. Trigger `bump_org_data_version`.

**RPCs novas (SECURITY DEFINER):**
- `resolve_link_to_cashflow(p_staging_id, p_cashflow_entry_id, p_force_relink boolean default false)` — vincula a um previsto. Comportamento:
  - Se o cashflow estiver `previsto`/`atrasado`: marca como `realizado`, copia data/valor reais, vincula `bank_statement_entry_id`, staging → `vinculado`.
  - Se o cashflow já estiver `realizado` e tiver outro `bank_statement_entry_id` conciliado: exige `p_force_relink=true`. Aí desvincula o anterior (volta `bank_statement_entries.status` da linha antiga para `pendente` e marca `resolution.previa_conciliacao_substituida=true` no staging anterior, se houver), vincula a nova, ajusta valor/data se diferente, registra em `audit_log` (categoria `reconciliation_override`).
- `resolve_discard(p_staging_id, p_category, p_reason)` — exige texto não vazio, status `descartado`, audit.
- `resolve_correct_and_retry(p_staging_id, p_data, p_valor, p_descricao, p_documento)` — revalida e faz upsert em `bank_statement_entries`.
- `list_unresolved_statement_lines(p_org)` — alimenta o banner.
- `search_cashflow_for_link(p_org, p_bank_account, p_data, p_valor, p_include_already_reconciled boolean)` — retorna candidatos com `match_score`, `status_atual`, `ja_conciliado_com` (descricao + id da linha bancária anterior, se houver).

---

## Frontend

### 1. Persistência total no `executeImport`
- Inserir **todas** as linhas (válidas e inválidas) em `bank_statement_staging`.
- Apenas as válidas seguem para `bank_statement_entries`; falha de batch marca staging como `erro_validacao`.

### 2. Tela `Resolver Extrato` (substitui o "done" simples)
Acessada ao final da importação **e** via banner permanente em `/financeiro?tab=conciliacao`.

Tabs (toda linha do arquivo aparece em alguma):
- **A resolver** (`pendente` + `erro_validacao` + `nao_previsto`)
- **Importados OK**
- **Resolvidos** (vinculados normais + vinculados por substituição + descartados, com chip distintivo)

Ações inline por linha "A resolver":
1. **Corrigir** — popover com 4 inputs → `resolve_correct_and_retry`.
2. **Vincular a previsto** — abre `LinkToPlannedDialog`.
3. **Criar realizado** — reusa `ClassifyAndReconcileDialog`.
4. **Descartar** — popover com categoria obrigatória + motivo → `resolve_discard`.

### 3. `LinkToPlannedDialog` (novo) — com toggle "incluir já conciliados"
- Topo: switch "**Mostrar também previstos já conciliados**" (default off).
- Lista candidatos via `search_cashflow_for_link`. Cada item mostra:
  - data prevista, descrição, valor, conta contábil, centro de custo;
  - chip de status: `Previsto` | `Atrasado` | **`Já conciliado`** (amber).
  - Se "Já conciliado": linha extra "Conciliado anteriormente com: <descricao da linha bancária antiga> em <data>".
- Confirmar em "Já conciliado":
  - Modal de confirmação **dupla**: "Isso vai substituir a conciliação anterior. A linha bancária anterior voltará para o status 'pendente' e precisará ser resolvida. Confirma?"
  - Chama `resolve_link_to_cashflow(..., p_force_relink=true)`.
  - Após sucesso, exibe toast com link "Ver linha que voltou a pendente".

### 4. Banner global em Conciliação
`UnresolvedStatementBanner` no topo de `ConciliacaoTab`:
> "23 linhas de extrato aguardam resolução — [Abrir tela de resolução]"

### 5. Pré-validação do OFX
Se >40% das linhas vierem sem `data` ou `valor` no parse, mostrar bloco amarelo no mapeamento e oferecer "Tratar como tabela manual".

---

## Critério de aceitação

- Importar um OFX problemático cria N linhas em `bank_statement_staging` (nenhuma some).
- Tela "A resolver" lista todas com chip de erro.
- Para cada linha é possível: corrigir, vincular a previsto **não conciliado**, vincular a previsto **já conciliado** (com confirmação dupla), criar realizado, ou descartar com motivo.
- Substituir conciliação devolve a linha bancária anterior ao estado `pendente` e a coloca de volta na tela de resolução.
- Audit log registra cada ação (`reconciliation_override` quando aplicável).
- Banner some quando staging fica zerado.

---

## Arquivos afetados

- `supabase/migrations/<new>.sql` — tabela `bank_statement_staging`, 5 RPCs, RLS, trigger.
- `src/lib/parsers/ofxParser.ts` — robustez de tags/formatos.
- `src/hooks/useBankStatementImport.ts` — gravar staging antes do insert.
- `src/components/financeiro/BankStatementImportDialog.tsx` — passo "done" abre a tela de resolução.
- `src/components/financeiro/StatementResolutionPanel.tsx` (novo) — 3 tabs + 4 ações.
- `src/components/financeiro/LinkToPlannedDialog.tsx` (novo) — toggle "incluir já conciliados" + confirmação dupla.
- `src/components/financeiro/UnresolvedStatementBanner.tsx` (novo).
- `src/components/financeiro/ConciliacaoTab.tsx` — banner.
- `src/hooks/useStatementResolution.ts` (novo) — wrappers das RPCs.