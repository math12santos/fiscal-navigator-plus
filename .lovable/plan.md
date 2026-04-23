

## Verificar cálculos do DP Dashboard + Drill-down clicável nos cards

### Verificação dos cálculos atuais
Após auditoria, os cálculos do `DPDashboard` estão corretos e fiéis às fontes:

| KPI | Fonte | Status |
|---|---|---|
| Headcount Ativo | `employees` filtrado por `status === "ativo"` | ✅ correto |
| Folha Bruta | soma de `salary_base` dos ativos | ✅ correto |
| Encargos Totais | `calcEncargosPatronais` por colaborador (PJ excluído) | ✅ correto |
| Custo Médio/Colab. | `(folha + encargos) / headcount` | ✅ correto |
| Vale Transporte | `vt_diario × 22 − 6% salário`, mínimo 0, só `vt_ativo` | ✅ correto |
| VA / Plano de Saúde / Outros | benefícios ativos, valor fixo ou % do salário | ✅ correto |
| Custo por CC | soma de `salary_base` agrupada por `cost_center_id` (com "Sem CC") | ✅ correto |

**Pequenos ajustes de consistência a aplicar junto:**
1. **Custo por CC inclui apenas salário base** — adicionar opção de visão "com encargos" para refletir o custo real de pessoal por CC (mantém a coluna `salário base` como padrão e exibe o total com encargos como subtítulo).
2. **Card "Total Benefícios" no fallback** soma VT + VA + Saúde, ignorando outros benefícios — corrigir para somar **todos** os `benefitStats` + VT.
3. **Custo Médio** atualmente exclui benefícios — manter o card como está (foco em salário+encargos), mas adicionar `subtitle` esclarecendo a composição.

### Drill-down nos cards (mesma lógica do Dashboard global)
Replicar o padrão `KPICard` clicável → rota `/relatorios/kpi/:metric` que existe no Dashboard, mas dedicado a métricas DP. Cada card vira clicável e abre uma página de composição com lista detalhada, busca, paginação, exportação CSV e card de "Reconciliação" (drill-down ↔ valor do KPI), seguindo o padrão de auditabilidade já em uso.

**Arquitetura:**

1. **Adotar o componente `KPICard`** (de `src/components/KPICard.tsx`) no `DPDashboard`, substituindo o `KPICard` local — assim ganhamos `onClick`, chevron, hover, acessibilidade já testados.

2. **Novas métricas em `RelatorioKpi.tsx`** — estender o tipo `KpiMetric` e o mapa `METRIC_META` com:
   - `dp-headcount` — lista de colaboradores ativos (nome, cargo, regime, admissão, CC, salário).
   - `dp-folha-bruta` — colaboradores ativos com salário base + total.
   - `dp-encargos` — por colaborador: INSS patronal, RAT, FGTS, Terceiros, Total. Reconciliação com soma do KPI.
   - `dp-custo-medio` — informativa, mostra `(folha+encargos)/headcount` com explicação.
   - `dp-vt` — colaboradores com VT ativo: `vt_diario × 22`, desconto 6%, custo líquido empresa.
   - `dp-va` — colaboradores recebendo qualquer benefício "alimentação/refeição": valor por colaborador.
   - `dp-saude` — colaboradores com benefício "saúde": valor por colaborador.
   - `dp-outros-beneficios` — matriz benefício × colaborador para todos os demais.
   - `dp-custo-cc` — agrupado por centro de custo com colaboradores listados.

3. **Cards do DPDashboard que ficarão clicáveis** (todos):
   - Headcount Ativo → `/relatorios/kpi/dp-headcount`
   - Folha Bruta Total → `/relatorios/kpi/dp-folha-bruta`
   - Encargos Totais → `/relatorios/kpi/dp-encargos`
   - Custo Médio/Colab. → `/relatorios/kpi/dp-custo-medio`
   - Vale Transporte → `/relatorios/kpi/dp-vt`
   - Vale Alimentação → `/relatorios/kpi/dp-va`
   - Plano de Saúde → `/relatorios/kpi/dp-saude`
   - Outros Benefícios / Total Benefícios → `/relatorios/kpi/dp-outros-beneficios`

4. **Reconciliação** — para cada nova métrica, comparar `rows.total` com o valor recalculado a partir das mesmas fontes (`useEmployees`, `useDPConfig`, `useDPBenefits`, `useEmployeeBenefits`), seguindo o padrão `match` / `mismatch` / `info` já implementado.

5. **Exportação CSV** já vem nativa do `RelatorioKpi` (botão "Download" no header da página) — sem trabalho adicional. Mantém os botões PDF/Excel atuais do DPDashboard intactos.

### Detalhes técnicos
- O `RelatorioKpi.tsx` ganhará nova lógica no `switch (metric)` e novo bloco `reconciliation`, importando hooks `useEmployees`, `useDPConfig`, `useDPBenefits`, `useEmployeeBenefits`, `useCostCenters`.
- O período do drill-down DP será **o mês corrente** (alinhado ao Dashboard DP que mostra o snapshot atual). O `KpiRangePicker` continua disponível para o usuário ajustar (ex.: ver folha de meses passados via `payroll_runs` futuramente).
- O `ModuleMaintenanceGuard moduleKey="dashboard"` já protege a rota; nada muda no roteamento.
- Sem migrations. Sem novas tabelas. Sem novas dependências.

### O que fica como está
- Os gráficos (Salário por colaborador, Pizza de CC) permanecem não-clicáveis — drill-down via cards é suficiente.
- Cards de seção "Documentos/Exames" e "Top Centros de Custo" no `DPCockpitSection` (Dashboard global) continuam abrindo direto o módulo DP — comportamento atual já adequado.

### Arquivos afetados
- `src/components/dp/DPDashboard.tsx` — usar `KPICard` global, adicionar `onClick`, corrigir fallback "Total Benefícios", adicionar opção visão com encargos no Custo por CC.
- `src/pages/RelatorioKpi.tsx` — adicionar 8 novas métricas DP (`switch rows`, `reconciliation`, `METRIC_META`).

