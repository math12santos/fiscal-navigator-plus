
# Contas Bancárias: Saldo Manual × Saldo OFX + Relatório PDF

## Objetivo

- Manter o **saldo manual** como hoje (campo livre, usado para emissão de relatório).
- Tratar o **saldo do OFX** como **referência** (verdade) e mostrar a **divergência** ao lado do manual, para o gestor ver o que falta conciliar.
- Adicionar botão **"Emitir Relatório PDF"** com o mesmo padrão visual do `cashPositionPdf` (header + resumo + tabelas + carimbo de rastreabilidade).

## Mudanças

### 1. Banco — guardar saldo OFX por conta

Migration adiciona em `bank_accounts`:
- `saldo_ofx numeric` — último saldo `<LEDGERBAL><BALAMT>` lido do OFX.
- `saldo_ofx_data date` — `DTASOF` do mesmo OFX.
- `saldo_ofx_atualizado_em timestamptz`.
- `saldo_ofx_import_id uuid` (referência ao import que carregou o saldo, para auditoria).

Sem nova RLS — herda das policies existentes.

### 2. Parser OFX — extrair LEDGERBAL

`src/lib/parsers/ofxParser.ts`:
- Adicionar bloco `<LEDGERBAL>` → expor `closingBalance: { value: number; asOf: string | null } | null` no `OfxParseResult`.
- Mantém compat (campos atuais inalterados).

### 3. Hook de import — gravar saldo OFX

`src/hooks/useBankStatementImport.ts`:
- Após parse OFX, se `closingBalance` presente e a conta destino for conhecida, atualizar `bank_accounts.saldo_ofx*` na finalização do import (idempotente — sempre sobrescreve com o OFX mais recente comparando `saldo_ofx_data`).

### 4. UI da aba Contas Bancárias

`ContasBancariasTab.tsx`:

a) **KPIs**: novo card "Divergência de Conciliação" mostrando soma absoluta de `saldo_ofx − saldo_atual` entre contas com OFX importado, com tooltip explicando.

b) **Tabela**: a coluna "Saldo Atual" vira **"Saldo (Manual / OFX)"** com:
- Linha 1: saldo manual (mantém botão de inserir).
- Linha 2 (subtítulo, monoespaçada): `OFX: R$ x · dd/MM/aa` ou `OFX: —`.
- Badge à direita:
  - `Conciliado` (sucesso) se `|manual − ofx| < 0.01`.
  - `A conciliar +R$ Δ` (warning) se há diferença.
  - `Sem OFX` (outline) se nunca houve import.
- Ação "Adotar OFX" no menu da linha → seta `saldo_atual = saldo_ofx`, registra timestamp.

c) **Botão de cabeçalho**: `Emitir Relatório PDF` (ao lado de "Nova Conta"), abre o relatório direto (sem dialog extra; já temos contexto org).

### 5. Relatório PDF — `bankBalancesPdf.ts`

Novo módulo `src/lib/bankBalancesPdf.ts`, **exatamente no mesmo padrão visual** de `cashPositionPdf`:

- Header: título "Relatório de Saldos Bancários", contexto (org / Holding), emissor, timestamp.
- Resumo: total saldo manual, total saldo OFX, divergência total, contas conciliadas vs a conciliar.
- Tabela única (ou por organização em modo Holding) com colunas:
  `Conta | Banco | Tipo | Saldo Manual | Saldo OFX | Δ | Última conciliação`
- Linhas com Δ ≠ 0 marcadas em vermelho via `colorNegatives` (usar formato contábil `(xxx)`).
- Rodapé com paginação + carimbo SHA-256 + emissor (idêntico ao cashPosition).
- Salva como `saldos-bancarios-YYYYMMDD-HHMM.pdf`.

Reusa helpers (`fmt`, `colorNegatives`, `sha256Hex`) — copiados ou extraídos para um util compartilhado pequeno (`src/lib/pdfShared.ts`) se virar 3+ usos. Por ora, copiar para evitar refator amplo.

### 6. Integração no botão

`ContasBancariasTab` chama `generateBankBalancesPdf({...})` com:
- `contextName = currentOrg.name` (ou "Consolidado" em Holding).
- `accounts` = `allBankAccounts` mapeadas + nome da org.
- `issuer = { name: user metadata, email, id: user.id }`.

## Arquivos

- `supabase/migrations/<novo>_bank_accounts_saldo_ofx.sql` (migration)
- `src/lib/parsers/ofxParser.ts` (extrair LEDGERBAL)
- `src/hooks/useBankStatementImport.ts` (gravar saldo OFX no fim do import)
- `src/components/financeiro/ContasBancariasTab.tsx` (KPI Divergência, coluna dupla, botão PDF, ação "Adotar OFX")
- `src/lib/bankBalancesPdf.ts` (novo)

## Fora de escopo

- Reescrever conciliação ou matching automático.
- Substituir o saldo manual: continua editável (CFO precisa para fechamento manual sem OFX disponível).
- Versionamento histórico de saldo OFX (mantemos só o último; histórico fica nos `bank_statement_entries`).
