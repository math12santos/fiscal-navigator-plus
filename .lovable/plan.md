## Diagnóstico atual

### Cálculo de salário líquido — onde está

- **Folha fechada (`DPFolha.handleCalcPayroll`)** e **projeção virtual (`usePayrollProjections`)**:
  ```
  Líquido = Salário Base − INSS Empregado − IRRF − VT Desconto (6%, capado)
  ```
- INSS/IRRF usam tabelas 2024 (`calcINSSEmpregado`, `calcIRRF`).

### Problemas identificados

1. **Eventos variáveis não entram no líquido oficial** — `DPFolha` mostra "Líquido + eventos" na tabela, mas `payroll_runs.total_liquido` e o holerite ignoram. IRRF é calculado sobre o salário base, não sobre `(salário + proventos tributáveis − INSS)`.
2. **Sem suporte a adiantamento/vale** — empresas que pagam 40% no dia 20 + saldo no 5º dia útil ficam fora do escopo. Quem paga em parcela única também precisa continuar funcionando.
3. **Datas de desembolso desalinhadas com a realidade** — tudo é projetado no dia 1º do mês de competência:
  - Salário líquido sai no **5º dia útil do mês seguinte**.
  - INSS/GPS, FGTS e IRRF vencem dia **20 do mês seguinte**.
  - VT/VR/VA são creditados **no último dia útil do mês anterior**.
  - Plano de saúde conforme fatura (5–15).
4. **INSS/GPS e FGTS aparecem rateados por colaborador no fluxo de caixa** — na vida real são **uma única guia consolidada** (GPS para INSS+RAT+terceiros, GRF para FGTS). O CFO vê 50 linhas de "INSS — Fulano" em vez de uma linha "GPS 11/2026" que de fato sai do banco.
5. **Provisões 13º/Férias** — já corretamente marcadas como `provisao_acumulada` e excluídas do caixa. Mas é preciso criar um acompanhamento para saber se o saldo em banco cobre as provisões necessárias. 
6. **Eventos variáveis (`payroll_events`) sempre projetados como saída no dia 1**, ignorando competência de pagamento.

---

## Plano de ajustes

### 1. Cálculo de líquido — fonte única de verdade

Criar `src/lib/payrollCalc.ts` com função pura:

```text
proventosTributaveis = eventos tributáveis (HE, adic. noturno, comissão, bônus)
proventosNaoTributaveis = isentos (ajuda de custo, diárias)
descontosVariaveis = faltas, atrasos, vale, adiantamento já pago

baseINSS  = salario_base + proventosTributaveis
inssEmp   = calcINSSEmpregado(baseINSS)
baseIRRF  = baseINSS − inssEmp
irrf      = calcIRRF(baseIRRF)
vtDesc    = min(salario_base*0,06, vtBruto)
liquido   = bruto − inssEmp − irrf − vtDesc − descontosVariaveis − adiantamentoPago
```

Marcar `tributavel: boolean` em `PAYROLL_EVENT_TYPES`. Reusar em `DPFolha.handleCalcPayroll`, `usePayrollProjections`, `generatePaystubPdf`, `DPPayrollComparison`.

### 2. Adiantamento opcional por organização

Migration adicionando ao `dp_config`:

```sql
ALTER TABLE dp_config
  ADD COLUMN advance_enabled         boolean  DEFAULT false,  -- OFF por padrão (pagamento único)
  ADD COLUMN advance_pct             numeric  DEFAULT 40,
  ADD COLUMN advance_payment_day     smallint DEFAULT 20,     -- dia calendário do MESMO mês
  ADD COLUMN salary_payment_day      smallint DEFAULT 5,
  ADD COLUMN salary_payment_basis    text     DEFAULT 'business_day',
  ADD COLUMN inss_due_day            smallint DEFAULT 20,
  ADD COLUMN fgts_due_day            smallint DEFAULT 20,
  ADD COLUMN irrf_due_day            smallint DEFAULT 20,
  ADD COLUMN benefits_payment_day    smallint DEFAULT -1,     -- -1 = último dia útil mês anterior
  ADD COLUMN health_payment_day      smallint DEFAULT 10;
```

Em `DPConfig.tsx`, nova seção **"Calendário de Desembolsos"** com:

- **Switch** "Pagar adiantamento (vale)" → quando OFF, oculta os campos `advance_pct` e `advance_payment_day`. Default OFF para não quebrar empresas com pagamento único.
- Quando ON: campos % do adiantamento e dia do mês.
- Demais campos sempre visíveis: dia do salário, dias de vencimento INSS/FGTS/IRRF, benefícios, saúde.

Comportamento na projeção:

- `advance_enabled = false` → uma única projeção `salario_liquido` no 5º dia útil do mês N+1 com 100% do líquido. **Comportamento atual preservado.**
- `advance_enabled = true` → duas projeções:
  - `salario_adiantamento` = `liquido × advance_pct%` no dia 20 do mês N (competência).
  - `salario_liquido` = `liquido − adiantamento` no 5º dia útil do mês N+1.

### 3. Consolidar GPS e GRF em guia única no fluxo de caixa

Mudança crítica: **INSS, RAT, terceiros e FGTS deixam de ser projeções por colaborador no caixa.**

Em `usePayrollProjections.ts`:

- Continuar **calculando** os valores por colaborador (necessário para holerite, rateio por cost center, exportações).
- **Agregar** antes de devolver as projeções de caixa:
  - 1 entrada `gps-<orgId>-<monthKey>` com a soma de `inssEmp + inssPatronal + rat + terceiros` de todos os colaboradores ativos do mês.
  - 1 entrada `grf-<orgId>-<monthKey>` com a soma de `fgts` de todos os colaboradores.
  - 1 entrada `darf-irrf-<orgId>-<monthKey>` com a soma do IRRF (também é guia única — DARF código 0561).
- `cost_center_id = null` nessas guias (são despesas corporativas).
- `dp_sub_category` mantida (`encargos_inss`, `encargos_fgts`, `encargos_irrf`) — só muda a granularidade.
- O drill-down do colaborador continua disponível na **folha fechada** (`DPFolha`), não no fluxo de caixa.

Salário líquido, VT, VR, VA e plano de saúde **continuam por colaborador** (cada um cai numa conta diferente, são pagamentos individuais).

Adicionar nas notas da guia consolidada: `"GPS consolidada — N colaboradores | Patronal: X | Empregado: Y | RAT: Z | Terceiros: W"` para auditabilidade.

### 4. Recalcular `data_prevista` por sub-categoria


| Sub-categoria                              | Granularidade          | Data prevista                               |
| ------------------------------------------ | ---------------------- | ------------------------------------------- |
| `salario_adiantamento` (novo, condicional) | por colaborador        | dia 20 do mês de competência                |
| `salario_liquido` (saldo)                  | por colaborador        | 5º dia útil do **mês seguinte**             |
| `encargos_inss` (GPS)                      | **1 guia consolidada** | dia 20 do mês seguinte                      |
| `encargos_fgts` (GRF)                      | **1 guia consolidada** | dia 20 do mês seguinte                      |
| `encargos_irrf` (DARF)                     | **1 guia consolidada** | dia 20 do mês seguinte                      |
| `vt`, `beneficios_vr`, `beneficios_va`     | por colaborador        | último dia útil do mês anterior             |
| `beneficios_saude`                         | por colaborador        | dia 10 do mês de competência (configurável) |
| `beneficios_outros`                        | por colaborador        | dia 5 do mês de competência                 |
| `provisao_acumulada`                       | por colaborador        | dia 1 (informativo, não soma caixa)         |
| Eventos variáveis                          | por colaborador        | herdam data do salário/adiantamento         |


Helper novo `src/lib/payrollSchedule.ts`: `nthBusinessDay(month, n)`, `lastBusinessDayOf(month)`, `addCalendarDay(month, day)`, reutilizando `useBusinessDays` e overrides existentes.

### 5. Materialização DP → cashflow_entries

Botão **"Materializar folha no Financeiro"** em `DPFolha` (após `handleLock`), upsert idempotente em `cashflow_entries`:

- `source = 'dp'`, `source_ref = projectionKey.payroll(...)` (mesma chave usada na projeção).
- Para guias consolidadas: `source_ref = 'gps:<orgId>:<monthKey>'`, `'grf:<orgId>:<monthKey>'`, `'darf-irrf:<orgId>:<monthKey>'`.
- Reaproveita padrão de `termination-cashflow-sync`.

### 6. Atualizar `DPPayrollCycleCard` e `useDPPayrollExecution`

- Filtrar materializadas por **mês de desembolso** (não competência).
- Mostrar duas linhas: "Folha competência X" / "Desembolsos no mês Y (caixa)".
- Card de adiantamento separado quando `advance_enabled`.

### 7. Testes

- `src/lib/payrollCalc.test.ts`: líquido sem eventos, com proventos tributáveis, com adiantamento, VT capado, PJ, estágio.
- `src/lib/payrollSchedule.test.ts`: 5º dia útil, último dia útil, dia 20.
- `src/hooks/usePayrollProjections.test.ts`: 1 colaborador → 1 guia GPS; 5 colaboradores → ainda 1 guia GPS; soma bate com soma individual; toggle adiantamento ON/OFF altera contagem de projeções.

---

## Arquivos afetados

**Criados**

- `src/lib/payrollCalc.ts` + `.test.ts`
- `src/lib/payrollSchedule.ts` + `.test.ts`
- `src/hooks/usePayrollProjections.test.ts`
- Migration `dp_config` (calendário + adiantamento)

**Editados**

- `src/hooks/usePayrollProjections.ts` (consolidação GPS/GRF/DARF, datas, adiantamento, uso de `calcEmployeeNet`)
- `src/hooks/useDP.ts` (`calcINSSEmpregado` aceita base com proventos)
- `src/components/dp/DPFolha.tsx` (líquido oficial inclui eventos; coluna adiantamento; botão materializar)
- `src/components/dp/DPConfig.tsx` (seção "Calendário de Desembolsos" + Switch adiantamento)
- `src/lib/dpExports.ts` (holerite mostra adiantamento, proventos/descontos variáveis)
- `src/hooks/useDPPayrollExecution.ts` (mês desembolso vs competência)
- `src/hooks/usePayrollEvents.ts` (flag `tributavel` por tipo)

## Impacto para o usuário (CFO)

- **Fluxo de Caixa fica realista**: salário líquido no 5º dia útil do mês seguinte, encargos no dia 20.
- **GPS/GRF/DARF aparecem como uma linha única** (como o banco vê), não 50 linhas por colaborador. Drill-down por pessoa continua na folha fechada.
- **Adiantamento opcional por empresa** — quem paga uma vez só não vê nada mudar; quem paga vale ativa o switch e o caixa do dia 20 já reflete.
- **Holerite e folha fechada batem** com o que sai do banco (eventos entram no líquido).
- **DRE x Caixa** deixam de divergir: provisões acruam no mês de competência (já era), encargos viram caixa no mês seguinte.