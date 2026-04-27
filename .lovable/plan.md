## Diagnóstico

### 1. Integração DP ↔ Financeiro (estado atual)
Já existe um pipeline funcional, mas com lacunas de visibilidade:

- **Folha mensal** é projetada virtualmente em `usePayrollProjections` (salário líquido, FGTS, INSS/GPS, IRRF, VT, benefícios, provisões 13º/férias, eventos variáveis) com `source="dp"` e dedup por `source_ref` — aparece em `useCashFlow` e `useFinanceiro`.
- **Rescisões** materializam diretamente em `cashflow_entries` via `syncTerminationCashflow` (upsert por `dedup_hash`).
- **Eventos variáveis** de folha (proventos/descontos) já viram entrada virtual.

**Lacunas hoje:**
1. Não há indicador no DP mostrando **quanto da projeção da folha do mês já foi pago/realizado** no Financeiro (ciclo não fecha visualmente).
2. **Provisões (13º + férias)** projetam mês a mês como saída, mas no Planejamento Financeiro não há separação clara entre "provisão acumulada" vs. "desembolso esperado em novembro/dezembro" → distorce o fluxo de caixa.
3. **Benefícios** projetam um valor único por colaborador, sem segregar por categoria (VR/VA/Saúde) — perde rastreabilidade contábil.
4. **Férias gozadas** (uso real) não viram lançamento financeiro — apenas a provisão mensal aparece.
5. **Sem ponte para Centro de Custo / Plano de Contas**: as projeções DP usam `cost_center_id` mas não recebem `account_id`, então nunca caem em uma conta contábil específica do plano.
6. **Sem alerta cruzado**: documentos vencidos, exames críticos e rescisões previstas não aparecem como risco no Cockpit Financeiro.
7. **Nenhuma drill-down DP → Financeiro**: clicar em "Folha do mês" no DP deveria abrir a visão filtrada em Financeiro.

### 2. Hierarquia visual do módulo DP (estado atual)
- `DepartamentoPessoal.tsx` usa apenas `Tabs` planos. Cada aba (`DPDashboard`, `DPColaboradores`, `DPFolha`…) é uma sopa de Cards e tabelas sem **agrupamento semântico**, sem **divisores** e sem **cabeçalhos de seção**.
- `DPDashboard` mistura 4 KPIs principais + 6 KPIs de benefícios + alertas + 2 gráficos sem separação visual.
- `DPColaboradores` / `DPFolha` / `DPRescisoes` / `DPFerias` / `DPEncargos` colocam toolbar, filtros, tabela e totais lado a lado sem respiração.
- Não existe um componente padrão de "seção" para o DP, apenas `<Card>` cru.

---

## Proposta

### Parte A — Integração DP ↔ Financeiro

1. **Card "Ciclo da Folha do Mês" no `DPDashboard`** (novo)
   - Lê projeções DP do mês corrente + entradas materializadas de `cashflow_entries` com `source='dp'` no mesmo período.
   - Mostra barra: `Previsto R$ X · Pago R$ Y · A pagar R$ Z` + % de execução.
   - Botão "Ver no Financeiro" → navega para `/financeiro?categoria=Pessoal&periodo=<mes>`.

2. **Segregação de benefícios por categoria nas projeções**
   - Em `usePayrollProjections`, em vez de uma linha "Benefícios — <nome>" agregada, gerar uma linha por categoria (`vale_refeicao`, `vale_alimentacao`, `plano_saude`, `outros`) usando `dp_sub_category` específico. Mantém dedup por `source_ref` distinto.

3. **Provisões: separar acumulação vs. desembolso**
   - Hoje a provisão mensal vira saída fictícia todo mês, o que infla o fluxo de caixa real.
   - Mudar `dp_sub_category="provisoes"` para gerar **duas naturezas**:
     - `provisao_acumulada` (informativa, não soma no caixa) — para compor o passivo trabalhista no Planejamento.
     - `desembolso_13` em novembro/dezembro e `desembolso_ferias` no mês de gozo programado — soma no caixa.
   - `useCashFlow` e `useFinanceiro` filtram `provisao_acumulada` da soma de saídas; `Planejamento → Passivos Trabalhistas` consome o acumulado.

4. **Vincular conta contábil padrão**
   - Adicionar em `dp_config` campos opcionais: `default_account_salario`, `default_account_encargos`, `default_account_beneficios`, `default_account_rescisao`.
   - `usePayrollProjections` e `syncTerminationCashflow` preenchem `account_id` quando configurado.
   - Aba **Configurações do DP** ganha seção "Contas contábeis padrão" com selects do plano de contas.

5. **Materialização de férias gozadas**
   - Quando uma `vacations` muda para `status='gozada'` ou `'paga'`, criar entrada `cashflow_entries` (saída, source='dp', source_ref=`vacation:<id>`) com valor = salário + 1/3.
   - Idempotente via `dedup_hash`.

6. **Alertas cruzados no `DPCockpitSection`** (Dashboard global)
   - Adicionar banner "Riscos trabalhistas" mostrando:
     - Rescisões previstas nos próximos 30 dias (de `hr_planning_items`).
     - Férias vencidas (passou prazo concessivo).
     - Exames/ASOs vencidos com colaborador ainda ativo.
   - Cada alerta com link para a aba/colaborador correspondente.

7. **Drill-down DP → Financeiro**
   - KPIs de "Folha Bruta", "Encargos" e "Total Benefícios" no `DPDashboard` ganham ação alternativa "Ver lançamentos no Financeiro" (filtra `categoria=Pessoal` + `dp_sub_category` específico).

### Parte B — Redesenho visual do módulo DP

1. **Componente `<DpSection>` (novo, em `src/components/dp/DpSection.tsx`)**
   - Renderiza um cabeçalho de seção padronizado: ícone + título + descrição + ações no canto direito + `<Separator>` + slot de conteúdo.
   - Variantes: `default`, `compact`, `highlighted` (fundo `bg-muted/30` para áreas de configuração).

2. **`DPDashboard` reorganizado em 4 seções nomeadas:**
   - **"Visão Geral"** (Headcount, Folha Bruta, Encargos, Custo Médio).
   - **"Benefícios e Vantagens"** (VT, VR, VA, Saúde, Bônus, Outros).
   - **"Conformidade e Riscos"** (DocumentAlerts + futuros alertas cruzados).
   - **"Análise por Colaborador e Centro de Custo"** (os dois gráficos).
   - Cada seção com `<DpSection>` + separador discreto entre elas.

3. **Toolbars unificadas**
   - Criar `<DpToolbar>` com slots `filters`, `actions` para padronizar `DPColaboradores`, `DPFolha`, `DPRescisoes`. Hoje cada um faz a sua barra.

4. **Tabelas com cabeçalho sticky e zebra**
   - Adicionar utilitário CSS `.dp-table` com `[&_thead]:bg-muted/50 [&_tr:nth-child(even)]:bg-muted/20` aplicado nas tabelas grandes (Colaboradores, Folha, Encargos).

5. **Substituir Cards "soltos" por `<DpSection>`** em `DPFolha` (Histórico de Folhas / Detalhe da Folha / Eventos), `DPFerias` (Férias / 13º), `DPRescisoes` (KPIs / Histórico) e `DPEncargos` (KPIs / Tabela detalhada).

6. **Cabeçalho da página DP**
   - Adicionar uma linha de breadcrumb-like: ícone do módulo + nome + um chip mostrando o mês de referência ativo, antes das tabs.

### Estrutura visual proposta (esquemático)
```text
[ Departamento Pessoal · Abril/2026 ]    [Gestão de Desempenho]
Tabs: Dashboard | Colaboradores | Folha | Férias | Rescisões | …
─────────────────────────────────────────────────
  ┌─ § Visão Geral ──────────────────────────┐
  │  KPI · KPI · KPI · KPI                   │
  └──────────────────────────────────────────┘
  ┌─ § Benefícios e Vantagens ───────────────┐
  │  VT · VR · VA · Saúde · Bônus · Outros   │
  └──────────────────────────────────────────┘
  ┌─ § Ciclo da Folha do Mês  [Ver Fin.]────┐
  │  ████████░░  R$ 84k pagos / R$ 120k     │
  └──────────────────────────────────────────┘
  ┌─ § Conformidade e Riscos ────────────────┐
  │  Documentos · Exames · Férias vencidas   │
  └──────────────────────────────────────────┘
  ┌─ § Análise ──────────────────────────────┐
  │  [Salário/Colab.]   [Custo por CC]       │
  └──────────────────────────────────────────┘
```

---

## Detalhes técnicos

- **Arquivos a criar:**
  - `src/components/dp/DpSection.tsx`, `src/components/dp/DpToolbar.tsx`
  - `src/components/dp/DPPayrollCycleCard.tsx` (card "Ciclo da Folha")
  - `src/hooks/useDPPayrollExecution.ts` (cruzamento projeções DP × cashflow materializado)
- **Arquivos a editar:**
  - `usePayrollProjections.ts` — segregar benefícios por categoria; separar provisão acumulada × desembolso.
  - `useCashFlow.ts` / `useFinanceiro.ts` — filtrar `dp_sub_category='provisao_acumulada'` da soma de saídas.
  - `useDP.ts` — `syncTerminationCashflow` ler `default_account_rescisao` de `dp_config`; novo `syncVacationCashflow`.
  - `DPDashboard.tsx`, `DPColaboradores.tsx`, `DPFolha.tsx`, `DPFerias.tsx`, `DPRescisoes.tsx`, `DPEncargos.tsx`, `DPConfig.tsx`, `DepartamentoPessoal.tsx`, `DPCockpitSection.tsx`.
- **Migração SQL:**
  - `ALTER TABLE dp_config ADD COLUMN default_account_salario uuid REFERENCES chart_of_accounts(id) …` (4 colunas opcionais).
  - Sem mudança em `cashflow_entries` (já tem `source`, `source_ref`, `dedup_hash`).
- **Compatibilidade:** projeções existentes mantêm `source_ref` original; novas categorias de benefício usam `projectionKey.payroll(emp.id, 'beneficios_<categoria>', monthKey)` — coexistem sem duplicar dados.

---

## Entregáveis

1. Componentes `DpSection` + `DpToolbar` + 4 seções nomeadas no Dashboard.
2. Card "Ciclo da Folha do Mês" com integração viva ao Financeiro.
3. Projeções de benefícios e provisões refinadas (categoria + acumulado vs. desembolso).
4. Configuração de contas contábeis padrão por tipo de despesa DP.
5. Materialização automática de férias gozadas.
6. Alertas cruzados no Cockpit DP do Dashboard global.
7. Tabelas e toolbars unificadas em todas as abas do DP.
