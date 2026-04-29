---
name: Payroll Payment Calendar
description: Resolved disbursement dates shown next to configured day in DPConfig (5º dia útil → date)
type: feature
---
DPConfig sempre mostra a data RESOLVIDA ao lado do dia configurado para reduzir ambiguidade do CFO:
- Hint inline no input "Dia do pagamento do salário": "Próximo pagamento: dd/MM/aaaa (5º dia útil de mês/aaaa)" via `describeSalaryPaymentDay()` + `salaryPaymentDate()`.
- Card "Calendário resolvido — próximas 3 competências" com tabela das datas reais (Adiantamento, Salário, GPS, GRF, DARF, VT/VR/VA, Saúde) usando `nextNPaymentDates(3, schedule)`.
- Recalcula em tempo real conforme o usuário muda inputs (sem salvar).
- Helpers em `src/lib/payrollSchedule.ts`: `describeSalaryPaymentDay`, `formatCompetencyLabel/Long`, `nextNPaymentDates`.
- Limitação atual: dia útil considera só seg-sex; feriados nacionais ainda não. Override manual via `dp_business_days`.
