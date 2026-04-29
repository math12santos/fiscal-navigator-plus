---
name: VR/VA Anticipated Credit
description: VT/VR/VA credited in month N-1 of competency; descriptions and notes carry explicit competency
type: feature
---
Regra CLT/PAT: VT, VR e VA são creditados no mês ANTERIOR à competência (último dia útil por padrão, ou dia calendário configurado em `dp_config.benefits_payment_day`).
- competência 05/2026 → pagamento em 30/04/2026
- competência 04/2026 → pagamento em 31/03/2026

Para evitar confusão no caixa, em `usePayrollProjections.ts`:
- Toda projeção VT/VR/VA/Saúde tem descrição "{Tipo} — {Nome} (competência MM/AAAA)".
- `notes` para benefícios antecipados: "Crédito antecipado em dd/MM/yyyy para uso ao longo de mês/aaaa (CLT/PAT — pago no mês anterior à competência)."
- Plano de Saúde (não antecipado): "Fatura referente à competência mês/aaaa, com vencimento em dd/MM/yyyy."
- Todas as entradas (incluindo guias GPS/GRF/DARF e PJ) propagam `reference_month: dtCompetencia` para que o DRE/Fluxo possa agrupar por competência independentemente da data de desembolso.

Tooltip explicativo no `DPConfig.tsx` (campo "Crédito de VT/VR/VA") reforça a regra para o usuário.
Travado por testes em `src/lib/payrollSchedule.test.ts` (casos 05/2026, 04/2026, 11/2026 e variação dia 25).
