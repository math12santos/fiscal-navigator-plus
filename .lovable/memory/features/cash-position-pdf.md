---
name: Cash Position PDF Report
description: PDF Posição de Caixa com auditoria saldo×conciliado, pagamentos da semana e carimbo SHA-256
type: feature
---

## UI (`src/components/financeiro/AgingListTab.tsx`)

- Cards (Saldo / Limite / Disponibilidade) abrem Dialog `perOrgPosition` (posição por empresa).
- Botão "Emitir PDF de Posição de Caixa" no header → `handleEmitPdf` (async).

## PDF (`src/lib/cashPositionPdf.ts`)

`generateCashPositionPdf` é **async** (usa `crypto.subtle.digest`). Seções:

1. Header com timestamp + emissor (nome/e-mail).
2. Resumo Financeiro (Saldo, Limite, Disponibilidade, AP vencido/30d, AR 30d).
3. Posição por empresa (uma seção por org com tabela de contas).
4. **Auditoria — Saldo × Conciliado**: para cada conta bancária compara `saldo_atual` com Σ(`valor_realizado`) dos lançamentos pagos/recebidos vinculados (`conta_bancaria_id`). Linhas com divergência ≥ R$0,01 ficam vermelhas + bold. Inclui total e nota explicativa.
5. **Pagamentos da Semana Corrente**: filtra `saidaEntries` com `status='pago'` e `data_realizada` dentro de `[startOfWeek(seg), endOfWeek(dom)]`. Colunas: Data / Empresa / Favorecido (descrição) / Valor.
6. **Carimbo de Rastreabilidade** (caixa em rodapé direito de TODA página): emissor + ID curto (`user.id[:8]`) + SHA-256 truncado (16 chars) do payload JSON. Hash íntegro completo no rodapé da última página.

## Hash

`sha256Hex` digere JSON com: contextName, isConsolidated, generatedAt, issuer, totals, perOrg, audit, weekPayments — exclui o próprio hash. Permite re-cálculo manual para validação.

## Arquivo

`posicao-caixa-YYYYMMDD-HHmm.pdf` — `doc.save` retorna `{ fileName, hash }`.
