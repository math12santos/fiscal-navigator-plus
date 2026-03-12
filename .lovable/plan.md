

# Correção VT no Cálculo de Salário Líquido e Dias Úteis Dinâmicos

## Problemas Identificados

### 1. VT desconto NÃO está sendo subtraído do salário líquido nas projeções
- **DPFolha.tsx** (folha real): `descontos = inssEmp + irrf + vtDesconto` — **correto**
- **usePayrollProjections.ts** (projeções): `netSalary = salary - inssEmp - irrf` — **VT desconto ignorado**
- Resultado: projeções mostram salário líquido maior que a folha real

### 2. VT bruto usa 22 dias fixos em vez de dias úteis reais do mês
- Linha 122: `vtBruto = vt_diario * 22` — fixo
- Deveria calcular dias úteis do mês (excluindo sábados e domingos)

## Solução

### Arquivo: `src/hooks/usePayrollProjections.ts`

**A) Criar função `getBusinessDays(month: Date)`**
- Percorre todos os dias do mês, conta apenas seg-sex (day 1-5)
- Usada para calcular `vtBruto = vt_diario * diasUteis`

**B) Incluir VT desconto no cálculo do salário líquido**
- Calcular `vtDesconto` para todos os empregados com `vt_ativo`
- `netSalary = salary - inssEmp - irrf - vtDesconto` (quando VT ativo)
- Atualizar o campo `notes` para incluir o desconto VT no detalhamento

**C) Aplicar dias úteis dinâmicos no VT bruto**
- Substituir `vt_diario * 22` por `vt_diario * getBusinessDays(cursor)`
- Atualizar `notes` do VT para mostrar a quantidade de dias úteis

### Arquivo: `src/components/dp/DPFolha.tsx`

**Mesma correção de dias úteis** no cálculo da folha real:
- Importar/usar `getBusinessDays` para calcular VT bruto com dias úteis reais
- Atualmente o VT desconto já é subtraído do líquido — está correto

### Impacto
- As projeções de salário líquido diminuem (passam a refletir o desconto VT real)
- O VT bruto varia por mês conforme dias úteis reais
- Folha real e projeções ficam alinhadas
- Aglutinação no Contas a Pagar e Aging List já funciona — só os valores mudam

