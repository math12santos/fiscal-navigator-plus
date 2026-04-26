# Gestão de Desempenho (DP/RH) — entrega completa

Subpágina **`/dp/desempenho`** acessível via novo botão na aba "Cargos & Rotinas" e via card no DPDashboard. Toda a feature é multi-tenant (RLS por `organization_id`) e respeita o `useUserDataScope` por Centro de Custo.

---

## 1. Schema (1 migration)

### Tabela nova `hr_departments`
- `id uuid pk`, `organization_id uuid not null`, `name text not null`, `manager_user_id uuid` (gestor), `cost_center_id uuid null` (link opcional para CC), `active bool default true`, timestamps.
- **Coluna `department_id uuid` em `employees` e `positions`** (nullable para retrocompatibilidade).
- Trigger de bootstrap: ao criar org, sem semente automática (cadastro manual via UI).

### `hr_pdis` (PDI)
- Cabeçalho: `id`, `organization_id`, `employee_id`, `manager_user_id`, `created_by`, `objetivo`, `competencia`, `justificativa`, `data_inicio date`, `data_conclusao_prevista date`, `data_conclusao_real date`, `status` (enum `pdi_status`: nao_iniciado | em_andamento | em_atraso | concluido | cancelado), `percentual_evolucao numeric default 0`, `obs_rh`, `obs_gestor`, `obs_colaborador`, `source_one_on_one_id uuid`, `source_9box_id uuid`, timestamps.
- **Trigger** `set_pdi_em_atraso` (BEFORE UPDATE/INSERT): se `status != concluido/cancelado` e `data_conclusao_prevista < today`, força `status='em_atraso'`.

### `hr_pdi_actions`
- `id`, `organization_id`, `pdi_id`, `acao`, `tipo` (treinamento|mentoria|pratica|leitura|curso|reuniao|outro), `responsavel_user_id`, `prazo date`, `status` (pendente|em_andamento|concluida|cancelada), `evidencia text`, `comentarios`, `concluida_em`, timestamps.
- Trigger: ao mudar status de ação, recalcula `hr_pdis.percentual_evolucao = ações concluídas / total`.

### `hr_one_on_ones`
- `id`, `organization_id`, `employee_id`, `manager_user_id`, `data_reuniao timestamptz`, `tipo` (mensal|quinzenal|trimestral|extraordinaria), `status` (agendada|realizada|remarcada|cancelada|pendente), `humor` (muito_bom|bom|neutro|ruim|critico), `pauta`, `pontos_discutidos`, `dificuldades`, `entregas_recentes`, `feedback_gestor`, `feedback_colaborador`, `decisoes`, `proximos_passos`, `proxima_reuniao_sugerida date`, `previous_id uuid` (auto-link), timestamps.

### `hr_one_on_one_actions` (encaminhamentos)
- `id`, `organization_id`, `one_on_one_id`, `tarefa`, `responsavel_user_id`, `prazo date`, `status` (pendente|em_andamento|concluida|cancelada), `observacoes`, timestamps.
- **Realtime**: ALTER PUBLICATION para usar no dashboard.

### `hr_9box_evaluations`
- `id`, `organization_id`, `employee_id`, `evaluator_user_id`, `data_avaliacao date`, `nota_desempenho numeric(2,1)` (1–5), `nota_potencial numeric(2,1)` (1–5), `nivel_desempenho text` (baixo|medio|alto, derivado), `nivel_potencial text` (baixo|medio|alto, derivado), `quadrante int` (1–9, derivado), `justificativa`, `pontos_fortes`, `pontos_atencao`, `risco_perda` (baixo|medio|alto), `indicacao_sucessao bool`, `recomendacao` (manter|desenvolver|promover|realocar|acompanhar|desligamento_em_analise), `bsc_score_snapshot numeric` (snapshot do BSC usado como sugestão), timestamps.
- **Trigger** `compute_9box_quadrante`: nota 1–2 → baixo, 3 → medio, 4–5 → alto; `quadrante` derivado de uma matriz 3×3 fixa.

### `hr_bsc_scorecards`
- `id`, `organization_id`, `nome`, `tipo` (individual|departamento|empresa), `employee_id`, `department_id`, `manager_user_id`, `periodo_inicio date`, `periodo_fim date`, `status` (em_elaboracao|ativo|encerrado), `resultado_geral numeric` (cache), `observacoes`, timestamps.
- Constraint: exatamente um de (`employee_id`, `department_id`) preenchido conforme `tipo`; `tipo='empresa'` permite ambos null.

### `hr_bsc_indicators`
- `id`, `organization_id`, `bsc_id`, `perspectiva` (financeira|clientes|processos|aprendizado), `nome`, `descricao`, `meta numeric`, `realizado numeric`, `unidade` (rs|pct|qtd|dias|horas|indice), `peso numeric default 1`, `frequencia` (mensal|trimestral|semestral|anual), `fonte_dado`, `responsavel_user_id`, `quanto_menor_melhor bool default false`, `percentual_atingimento numeric` (cache), `nota_ponderada numeric` (cache), `status` (abaixo|parcial|atingido|superado, cache), timestamps.
- **Trigger** `compute_bsc_indicator`: ao salvar, calcula `percentual_atingimento` (invertido se quanto_menor_melhor), `nota_ponderada`, `status` por faixas (<70 abaixo, 70–90 parcial, 90–100 atingido, >100 superado), e dispara `recompute_bsc_total(bsc_id)` para atualizar `hr_bsc_scorecards.resultado_geral`.

### `hr_bsc_history` (evolução mensal)
- `id`, `organization_id`, `bsc_id`, `indicator_id`, `periodo_mes date`, `realizado numeric`, `percentual numeric`, `snapshot_at`. Unique `(indicator_id, periodo_mes)`.
- Populada por trigger ao atualizar `hr_bsc_indicators.realizado`.

### RLS (padrão do projeto)
- Todas as tabelas: SELECT/UPDATE para membros da org; INSERT exige `organization_id` da org do user; gestores (definidos por `cost_centers.responsible_user_id` ou `hr_departments.manager_user_id` ou `employees.manager_user_id`) podem editar registros do seu escopo; colaborador (`employees.user_id`) lê seus próprios registros (PDI, 1:1, 9 Box, BSC individual). Política dedicada `has_module_access(uid, org, 'dp', 'desempenho')` para a aba.
- Backoffice: leitura via `has_backoffice_org_access`.

---

## 2. Hooks (`src/hooks/`)

- `useDepartments` — CRUD `hr_departments`.
- `usePDIs(filters)` + `useMutatePDI`, `usePDIActions(pdiId)` + `useMutatePDIAction`.
- `useOneOnOnes(filters)` + `useMutateOneOnOne`, `useOneOnOneActions(id)` + `useMutateOneOnOneAction`.
- `use9BoxEvaluations(filters)` + `useMutate9Box` — também expõe `useLatest9BoxByEmployee(employeeId)`.
- `useBSCScorecards(filters)`, `useBSCIndicators(bscId)`, `useBSCHistory(bscId)` + mutates.
- `usePerformanceDashboard()` — agrega métricas (counts, médias, ranking) com React Query, escopado por `activeOrgIds` (Holding mode).
- `usePerformancePermissions()` — derivado de `useUserPermissions`/`useUserDataScope`: papéis `diretoria | rh | gestor | colaborador | analista` definindo o que cada um vê/edita (RH = full; gestor = colaboradores do seu CC/depto; colaborador = só os seus quando `liberado_para_colaborador=true`).

Todos os hooks aplicam `activeOrgIds` (suporte a Holding) e respeitam `useUserDataScope`.

---

## 3. UI (`src/components/dp/desempenho/` + `src/pages/DepartamentoPessoalDesempenho.tsx`)

### Página principal
- `PageHeader` + cards-resumo (6): Colaboradores acompanhados · PDIs ativos · 1:1 pendentes · Alto desempenho · Em risco · Média geral.
- Faixa de filtros globais (`PerformanceFilters`): empresa (org/holding), departamento, gestor, colaborador, cargo, status, período, nível desempenho, nível potencial. Estado em URL para deep-link.
- `Tabs`: **Dashboard | PDI | One-on-One | Matriz 9 Box | BSC**.

### Aba PDI
- `PDIList` (tabela filtrável + alertas visuais: vencido, próximo vencimento, sem update >30d).
- `PDIFormDialog` (cabeçalho + lista de ações editável inline).
- `PDIDetailDrawer` (objetivo, ações, timeline de updates, comentários, botões "Adicionar atualização", "Concluir PDI").
- Cards: ativos, atrasados, concluídos, média evolução, top 5 competências.

### Aba One-on-One
- Toggle **Calendário | Lista cronológica** (`TarefasCalendario` reutilizado em wrapper).
- `OneOnOneFormDialog`.
- `OneOnOneDetailDrawer` com:
  - Histórico anterior do colaborador.
  - Pendências abertas dos 1:1 anteriores.
  - Botão **"Criar PDI a partir desta reunião"** (pré-preenche `source_one_on_one_id`).
  - Botão **"Gerar próxima 1:1"** (cria reunião com `previous_id` + `proxima_reuniao_sugerida`).
- Cards: agendados, realizados no mês, atrasados, pendências abertas, sem reunião >30d.

### Aba Matriz 9 Box
- `NineBoxGrid` (grade 3×3 visual, cores por intensidade, contagem por quadrante; clique em quadrante abre lista, clique em colaborador abre dossiê).
- `NineBoxFormDialog`:
  - Sugere `nota_desempenho` automaticamente a partir do **último BSC ativo do colaborador no período** (campo `bsc_score_snapshot` armazena a sugestão; gestor pode ajustar com justificativa).
  - Botão **"Criar PDI a partir desta avaliação"** (passa `source_9box_id` + recomendação).
- `NineBoxEvolutionChart` (linha temporal da posição por colaborador, recharts).
- Cards: total avaliados, talentos estratégicos (Q9), risco crítico (Q1), alto desempenho, precisam dev., possíveis sucessores.

### Aba BSC
- `BSCList` (tabela + filtro por tipo).
- `BSCFormDialog` cabeçalho.
- `BSCDetailPage` (subrota interna no estado): cabeçalho + tabela de indicadores agrupada por perspectiva (com inline edit de `realizado`), cards-resumo (resultado geral, atingidos, abaixo, melhor/pior perspectiva, evolução), gráficos (barras por perspectiva, linha mensal via `hr_bsc_history`, ranking, meta×realizado).

### Aba Dashboard consolidado
- Cards (8): listados no doc.
- Gráficos: distribuição 9 Box (heatmap), evolução média PDIs, BSC médio por depto, 1:1/mês, ranking deptos.
- Tabelas: top performers, em risco, PDIs em atraso, 1:1 pendentes, indicadores críticos.

### Integrações no Dossiê do colaborador (`EmployeeDossierDrawer`)
- Nova seção **"Desempenho"** consolidando: última 9 Box, PDIs ativos, últimas 1:1, BSC vigente, pendências, mini-gráfico evolução.

### Botões / UX
- "Novo PDI", "Nova 1:1", "Nova Avaliação 9 Box", "Novo BSC", "Adicionar atualização", "Criar PDI", "Concluir", "Exportar", "Filtrar", "Limpar filtros".
- Estados vazios amigáveis em cada aba (componente `EmptyState`).
- Confirmações fortes em excluir/concluir (AlertDialog).

### Exportação
- **Excel/CSV**: `xlsx` (já no projeto) — `src/lib/performanceExports.ts` gera planilhas multi-aba (PDI, 1:1, 9 Box, BSC).
- **PDF**: `jspdf + autotable` (já instalados) — `exportPerformancePdf.ts` gera relatório por colaborador (perfil, 9 Box, PDIs, 1:1, BSC) e relatório consolidado da empresa.

---

## 4. Permissões e Notificações

### Permissões
- Adicionar item `desempenho` em `MODULE_DEFINITIONS` do DP com tabs: `pdi`, `one_on_one`, `9box`, `bsc`, `dashboard`.
- Mapeamento sugerido (configurável no Backoffice):
  - **Diretoria**: leitura total de todas as abas + dashboard.
  - **RH** (perm `dp.config`): full CRUD em todas.
  - **Gestor** (CC responsible / `hr_departments.manager_user_id`): CRUD restrito ao seu escopo via RLS + filtro `useUserDataScope`.
  - **Colaborador** (`employees.user_id`): leitura dos próprios PDIs/1:1/9 Box/BSC quando `liberado_para_colaborador=true` (campo nas tabelas).
  - **Analista**: bloqueado no dashboard estratégico.

### Notificações (reuso de `notifications` + realtime existente)
- 1:1 atrasada, PDI próximo do vencimento (7d), PDI vencido, ação de PDI vencida, encaminhamento 1:1 vencido.
- Disparo: trigger pg ao mudar status para `em_atraso`/`vencida` insere em `notifications` (idempotência por `(user_id, reference_id, date_trunc('day', created_at))`).
- Sem nova edge function: usa o `NotificationCenter` atual.

---

## 5. Roteamento e navegação

- `src/App.tsx`: nova rota `/dp/desempenho` (lazy + Suspense + skeleton).
- Item de menu na sidebar do DP: "Gestão de Desempenho" (sob o módulo DP, não na top-nav).
- Card "Gestão de Desempenho" no `DPDashboard` com KPIs rápidos (PDIs ativos, 1:1 pendentes) → link.
- `DepartamentoPessoal.tsx`: tab "Desempenho" como atalho que navega para `/dp/desempenho` (mantém URL única).

---

## 6. Integrações lógicas (resumo)
1. **1:1 → PDI**: botão no detalhe da reunião, popula `source_one_on_one_id`.
2. **9 Box → PDI**: botão no dialog 9 Box, popula `source_9box_id` + recomendação.
3. **BSC → 9 Box**: pré-preenche `nota_desempenho` (sugestão editável + snapshot).
4. **PDI / 1:1 / 9 Box / BSC → Dossiê do colaborador**: nova seção "Desempenho".
5. **Encaminhamentos 1:1 / Ações PDI**: aparecem no Calendário de Tarefas (criando entradas em `requests` com `type='desempenho'`).

---

## 7. Arquivos

**Criar (DB):** 1 migration com todas as tabelas, enums, índices, RLS, triggers e ALTER PUBLICATION para realtime.

**Criar (código):**
- Hooks: `useDepartments.ts`, `usePDIs.ts`, `useOneOnOnes.ts`, `use9Box.ts`, `useBSC.ts`, `usePerformanceDashboard.ts`, `usePerformancePermissions.ts`.
- Página: `src/pages/DepartamentoPessoalDesempenho.tsx`.
- Componentes em `src/components/dp/desempenho/`: `PerformanceDashboard.tsx`, `PerformanceFilters.tsx`, `PDIList.tsx`, `PDIFormDialog.tsx`, `PDIDetailDrawer.tsx`, `PDIActionsTable.tsx`, `OneOnOneList.tsx`, `OneOnOneCalendarView.tsx`, `OneOnOneFormDialog.tsx`, `OneOnOneDetailDrawer.tsx`, `OneOnOneActionsTable.tsx`, `NineBoxGrid.tsx`, `NineBoxFormDialog.tsx`, `NineBoxEvolutionChart.tsx`, `BSCList.tsx`, `BSCFormDialog.tsx`, `BSCDetailPage.tsx`, `BSCIndicatorsTable.tsx`, `BSCCharts.tsx`, `DepartmentManagerDialog.tsx`, `EmptyState.tsx`.
- Libs: `src/lib/performance/exports.ts`, `src/lib/performance/exportPerformancePdf.ts`, `src/lib/performance/quadrante.ts` (regras 9 Box puras + testes), `src/lib/performance/bscMath.ts` (cálculos BSC puros + testes).
- Skeleton: `src/components/skeletons/DesempenhoSkeleton.tsx`.

**Editar:**
- `src/App.tsx` — rota nova + lazy.
- `src/data/moduleDefinitions.ts` — registrar tab `desempenho`.
- `src/pages/DepartamentoPessoal.tsx` — tab atalho.
- `src/components/dp/DPDashboard.tsx` — card de entrada.
- `src/components/dp/EmployeeDossierDrawer.tsx` — seção "Desempenho".
- `src/components/dp/DPColaboradores.tsx` e `src/hooks/useDP.ts` — selecionar `department_id`.
- `mem://features/performance-management.md` — nova memória.
- `mem://index.md` — entry para a nova memória.
- `.lovable/plan.md` — atualizar.

---

## 8. Princípios respeitados
- **Multi-tenant + RLS** em todas as tabelas; `organization_id` obrigatório.
- **MECE**: cada conceito em sua tabela; cálculos cacheados em coluna + recomputados via trigger (sem duplicação de fonte da verdade).
- **CFO/Board-first**: dashboard consolidado, exportações PDF/Excel para conselho, métricas comparáveis ao longo do tempo (`hr_bsc_history`, evolução 9 Box).
- **Reuso**: `notifications`, `requests`, `EmployeeDossierDrawer`, `useUserDataScope`, padrão `focused-wizard-pattern` nos forms longos (PDI, 1:1).
- **Performance**: lazy + Suspense + skeleton dedicado; React Query para cache.
- **Auditabilidade**: `created_by`, timestamps e snapshots (BSC histórico, 9 Box snapshot do BSC) garantem reprodutibilidade dos relatórios.
