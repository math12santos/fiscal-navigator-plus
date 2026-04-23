

## Vale Transporte, Vale Alimentação e Dias Úteis Ajustáveis

### Diagnóstico atual

**Vale Transporte:**
- ✅ A folha real (`DPFolha.tsx`) e as projeções (`usePayrollProjections.ts`) já calculam VT como `vt_diario × dias úteis do mês corrente` (via `getBusinessDays`, que conta seg–sex do mês).
- ❌ Os cards do `DPDashboard`, do `RelatorioKpi` (drill-down `dp-vt`), do `useDPCockpit`, do `useGroupTotals` e da listagem `DPColaboradores` ainda usam a constante fixa **22**, gerando divergência entre painel e folha.
- ❌ Não há ajuste para folgas, banco de horas, feriados ou dias não trabalhados — o cálculo assume o mês cheio.

**Vale Alimentação / Refeição:**
- Modelado como benefício livre (`dp_benefits.type` = `fixo` ou `percentual`). Não existe o tipo "por dia × dias úteis". Hoje o cliente precisa multiplicar manualmente e atualizar todo mês.

### O que vai mudar

#### 1. Novo tipo de benefício `por_dia` (ex.: VA, VR, ajuda de custo diária)
- **Migration aditiva:** `dp_benefits.type` aceita um terceiro valor `por_dia`. Existing dados intocados (`fixo` e `percentual` continuam funcionando).
- Cadastro de benefício (`DPBeneficios.tsx`): nova opção **"Valor por dia útil (R$/dia)"** ao lado de Fixo e Percentual.
- Cálculo: `valor_diario × dias_úteis_efetivos_do_mês` por colaborador.

#### 2. Calendário de dias úteis ajustável por mês (controle central)
Tabela nova **`dp_business_days`** (aditiva, escopo por organização):
```
organization_id | reference_month (date, dia 1) | business_days (int) | notes (text)
UNIQUE (organization_id, reference_month)
```
- RLS por `is_org_member` + `has_backoffice_org_access` (mesmo padrão das outras tabelas DP).
- Quando existe override do mês → usa esse valor.
- Quando não existe → cai no `getBusinessDays` automático (seg–sex do mês).

UI nova: **Aba "Calendário" dentro de Configurações DP** (`DPConfig.tsx`), com tabela dos próximos 12 meses mostrando:
- Mês de referência
- Dias úteis automáticos (calculados)
- Campo editável "Dias úteis efetivos" (override) + campo "Observação" (ex.: "ponte de carnaval", "banco de horas concedido em 27/12")
- Botão limpar override → volta ao automático

#### 3. Ajuste individual por colaborador no mês (folgas/banco de horas pontuais)
Coluna nova em `payroll_runs` (já existe a tabela) ou tabela `payroll_business_days_overrides`:
```
payroll_run_id | employee_id | business_days_used (int) | reason (text)
UNIQUE (payroll_run_id, employee_id)
```
- Permite zerar VT/VA dias para alguém em férias parciais, afastado, ou que recebeu banco de horas.
- UI: novo botão **"Ajustar dias úteis"** dentro da tela `DPFolha` (próximo ao botão "Eventos"), abrindo dialog que lista os colaboradores com:
  - Coluna "Dias úteis padrão" (do calendário do mês)
  - Coluna editável "Dias úteis efetivos"
  - Coluna "Motivo"

#### 4. Hook centralizado `useBusinessDaysForMonth(month, employeeId?)`
Retorna o número de dias úteis aplicável seguindo a hierarquia:
1. Override individual no `payroll_run` (se passou `employeeId`)
2. Override mensal da organização (`dp_business_days`)
3. Cálculo automático seg–sex (`getBusinessDays`)

Todos os pontos que hoje usam `22` ou `getBusinessDays` direto passam a usar este hook (ou sua versão sync `getEffectiveBusinessDays(month, overrides, employeeOverride)`):
- `DPDashboard.tsx` (cards VT e VA)
- `DPColaboradores.tsx` (custo VT e custo total)
- `useDPCockpit.ts`
- `useGroupTotals.ts`
- `RelatorioKpi.tsx` (drill-down `dp-vt` e `dp-va`)
- `usePayrollProjections.ts` (VT já usa, mas passará a respeitar overrides)
- `DPFolha.tsx` (já usa `getBusinessDays`, passa a respeitar overrides)

#### 5. Drill-down VA passa a discriminar cálculo
No `RelatorioKpi` (`dp-va`), a tabela ganha colunas **"Tipo / R$ por dia / Dias úteis / Custo mensal"** quando o benefício é `por_dia`. Para `fixo` e `percentual` mantém o layout atual.

### Arquivos afetados

**Migrations (aditivas, sem breaking):**
- Nova tabela `dp_business_days` + RLS
- Nova tabela `payroll_business_days_overrides` + RLS
- Comentário em `dp_benefits.type` documentando o terceiro valor `por_dia`

**Frontend novo:**
- `src/hooks/useBusinessDays.ts` — hook + helper sync
- `src/components/dp/DPBusinessDaysCalendar.tsx` — UI da aba Calendário
- `src/components/dp/PayrollDaysAdjustmentDialog.tsx` — UI do ajuste por colaborador no mês

**Frontend alterado:**
- `src/components/dp/DPConfig.tsx` — adicionar aba "Calendário"
- `src/components/dp/DPBeneficios.tsx` — opção `por_dia` no Select
- `src/components/dp/DPDashboard.tsx` — usar dias úteis efetivos no card VT, e calcular VA por dia quando aplicável
- `src/components/dp/DPColaboradores.tsx` — substituir `DIAS_UTEIS_MES = 22` pelo hook
- `src/components/dp/DPFolha.tsx` — botão "Ajustar dias úteis" + usar override por colaborador
- `src/hooks/useDPCockpit.ts` — usar dias úteis efetivos
- `src/hooks/useGroupTotals.ts` — idem
- `src/hooks/usePayrollProjections.ts` — respeitar overrides; aplicar `por_dia` para benefícios
- `src/pages/RelatorioKpi.tsx` — colunas dinâmicas no drill-down `dp-va`; `dp-vt` mostra dias úteis usados

### Compatibilidade
- Sem perda de dados. Benefícios existentes (`fixo`/`percentual`) continuam idênticos.
- Sem override cadastrado → comportamento atual preservado.
- Cálculo da folha real (`payroll_runs`) já usa `getBusinessDays` — nenhuma re-execução de folhas históricas.

### Auditabilidade (princípio CFO-first)
Toda linha de VT/VA passa a expor no campo `notes` da projeção: `"X dias úteis (auto/override mensal/override individual: motivo) × R$Y = R$Z"`. O reconciliation no `RelatorioKpi` continua válido (a fonte é a mesma).

