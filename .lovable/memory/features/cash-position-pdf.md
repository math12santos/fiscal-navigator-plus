---
name: Cash Position PDF Report
description: Aging List tem cards clicáveis (Dialog com posição por empresa) e botão "Emitir PDF de Posição de Caixa" com timestamp+emissor
type: feature
---

## Posição de Caixa no Aging List

`src/components/financeiro/AgingListTab.tsx`:

- **Cards clicáveis** (Saldo em Contas / Limite / Disponibilidade Total): abrem `Dialog` mostrando posição agrupada por empresa (`perOrgPosition`). Cada linha = 1 organização com saldo, limite e disponível.
- **Aviso explícito** dentro do dialog: saldos refletem a última atualização manual em "Contas Bancárias"; podem divergir de lançamentos pagos não conciliados → orienta usar a aba Conciliação.
- **Botão "Emitir PDF de Posição de Caixa"** no header da aba.

## Geração do PDF

`src/lib/cashPositionPdf.ts` usa `jspdf` + `jspdf-autotable`:

- Header com timestamp (`dd/MM/yyyy 'às' HH:mm:ss`) e emissor (`user.user_metadata.full_name` ou e-mail).
- Bloco "Resumo Financeiro": Saldo, Limite, Disponibilidade, AP Vencido, AP Próx. 30d, AR Próx. 30d.
- Uma seção por empresa com tabela de contas (Conta / Banco / Tipo / Saldo / Limite / Disponível) + linha de total.
- Footer paginado com nota de origem dos saldos.
- Nome do arquivo: `posicao-caixa-YYYYMMDD-HHmm.pdf`.

## Próximos passos planejados

- Incluir lista de pagamentos realizados na semana corrente (a fazer em iteração futura).
