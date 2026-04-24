
# Onboarding Guiado por Setor — DP (piloto)

O onboarding setorial é um **termômetro contínuo de maturidade do departamento**. Diferente do onboarding global (10 etapas, único por organização), ele:
- É **escopado por módulo/setor** (DP, Financeiro, CRM, Contratos…).
- Tem **score vivo**: recalcula sempre que dados são preenchidos/atualizados ou rotinas são cumpridas.
- Aparece como **barra progressiva no topo do módulo** para o gestor do setor.
- É consolidado no **Backoffice** com visão multi-organização.

Vamos implementar o piloto no **DP**, com arquitetura preparada para replicar nos demais setores depois.

---

## 1. Modelo de Maturidade (DP)

Score 0–100, composto por 3 dimensões com pesos:

### A. Completude (peso 50)
% de informações estruturais preenchidas. Cada item vale uma fração:
- **Configurações tributárias** (`dp_config` preenchido com `inss_patronal_pct`, `fgts_pct`, `terceiros_pct`, `provisao_ferias_pct`, `provisao_13_pct`, `vt_desconto_pct`) — 10 pts
- **Cargos cadastrados** (≥ 1 em `positions`) — 5 pts
- **Cargos com responsabilidades + faixa salarial** — 5 pts
- **Colaboradores cadastrados** (≥ 1 em `employees` ativo) — 5 pts
- **Colaboradores com `position_id` + `cost_center_id` preenchidos** — 5 pts
- **Benefícios cadastrados** (`dp_benefits`) — 5 pts
- **Vínculos colaborador↔benefício** (≥ 80% dos colaboradores ativos com pelo menos 1 benefício ou opt-out registrado) — 5 pts
- **Documentos obrigatórios em dia** (a partir de `employee_documents`, sem alertas vencidos) — 5 pts
- **Calendário de dias úteis configurado** (`dp_business_days`) — 5 pts

### B. Atualização (peso 25)
Frescor das informações periódicas:
- **Folha do mês anterior fechada** — 8 pts
- **Reajustes salariais nos últimos 12 meses** registrados (para colaboradores há > 12 meses) — 5 pts
- **Férias planejadas** para os colaboradores que ultrapassam 11 meses de aquisição — 6 pts
- **Documentos com vencimento** atualizados (sem `DPDocumentAlerts` vermelhos) — 6 pts

### C. Cumprimento de Rotinas (peso 25)
Integra com `position_routines` + `requests (type='rotina_dp')`:
- **% de rotinas concluídas** no mês corrente vs. geradas → escala linear até 25 pts
- Atrasos ponderam negativo (rotinas com `due_date < hoje` e `status='aberta'` reduzem proporcionalmente)

A faixa de Score gera um selo:
- 0–39: **Crítico** (vermelho)
- 40–69: **Em desenvolvimento** (âmbar)
- 70–89: **Maduro** (azul)
- 90–100: **Excelente** (verde)

Cada dimensão exibe sub-barras detalhadas para o gestor saber exatamente onde mexer.

---

## 2. Modelo de dados

Nova tabela única, multi-setor:

```sql
create table public.sector_onboarding (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sector text not null,                          -- 'dp' | 'financeiro' | 'crm' | ...
  score numeric not null default 0,              -- 0..100
  completeness_score numeric not null default 0, -- 0..50
  freshness_score numeric not null default 0,    -- 0..25
  routines_score numeric not null default 0,     -- 0..25
  maturity_label text,                           -- critico | desenvolvimento | maduro | excelente
  checklist jsonb not null default '[]'::jsonb,  -- itens detalhados {key,label,done,weight,category}
  last_calculated_at timestamptz not null default now(),
  notes text,
  user_id uuid not null,
  unique (organization_id, sector)
);
```

RLS:
- SELECT/UPDATE/INSERT por membros da organização (`is_org_member`).
- SELECT extra para `has_backoffice_org_access`.

> Observação: vamos **derivar** o score sempre dos dados-fonte (não duplicar). Esta tabela serve apenas como **cache materializado** para Backoffice e listas. A barra do gestor é recalculada **on-the-fly** no client (rápido, com os dados que já estão em memória) e o cache é gravado em `debouncedSave`.

---

## 3. Hook `useSectorOnboarding('dp')`

`src/hooks/useSectorOnboarding.ts` — calcula tudo no client:

- Faz queries para `dp_config`, `positions`, `employees`, `dp_benefits`, `employee_benefits`, `employee_documents`, `dp_business_days`, `payroll_runs`, `employee_vacations`, `requests` (tipo `rotina_dp` no mês corrente).
- Em **modo Holding**, agrega por `activeOrgIds` e mostra média ponderada por nº de colaboradores.
- Retorna:
  ```ts
  { score, completeness, freshness, routines, label, checklist, isLoading, refresh, persist }
  ```
- Cada item do `checklist` tem `{ key, label, category, done, weight, hint, ctaRoute }` para que ao clicar no item o gestor seja levado direto à aba que precisa preencher.
- `persist()` grava em `sector_onboarding` (debounce 1s) para manter o Backoffice sincronizado.

---

## 4. UI no módulo DP

### a. `SectorOnboardingBar` (novo componente)
`src/components/dp/SectorOnboardingBar.tsx` — barra colapsável colada abaixo do `PageHeader` em `DepartamentoPessoal.tsx`:

```
┌───────────────────────────────────────────────────────────────┐
│ Maturidade do DP   ███████████░░░░░░░  72%  • Maduro    [v]   │
│ Completude 38/50   Atualização 18/25   Rotinas 16/25          │
└───────────────────────────────────────────────────────────────┘
```

Quando expandido, mostra checklist agrupado por categoria com ícones de check/alerta + botão **“Ir para preencher”** que muda a aba ativa do `<Tabs>`.

- Sempre visível para todos os usuários com acesso ao DP.
- O gestor (`has_org_role owner|admin` ou responsável por CC do setor) vê também o botão **“Recalcular agora”** e a data do último cálculo.

### b. Aba “Onboarding DP” (opcional, modo focused-wizard)
`src/components/dp/DPOnboardingWizard.tsx` — versão expandida em accordion (padrão `focused-wizard-pattern`) acessível pela barra (“Abrir checklist completo”). Cada seção corresponde a uma dimensão do score com:
- Itens marcáveis automaticamente (verde quando o sistema detecta que o dado existe).
- Itens manuais (ex.: “revisei a tabela de cargos”) com checkbox em `checklist` jsonb.
- Notas livres em `notes`.

### c. Integração com rotinas
- Reaproveita `useRoutineCalendar` para a dimensão **Cumprimento de Rotinas**.
- Mostra mini-card: `12 de 18 rotinas concluídas no mês • 3 atrasadas`.
- Link direto para `/tarefas?filter=rotina_dp&competencia=YYYY-MM`.

### d. Dashboard DP
Adiciona um KPI extra “Maturidade do Setor” no `DPDashboard` (mesmo número da barra) para reforçar visibilidade.

---

## 5. Backoffice

Estende `BackofficeOnboarding.tsx` com **nova aba “Maturidade Setorial”**:

| Empresa | Setor | Score | Completude | Atualização | Rotinas | Última atualização |
|---|---|---|---|---|---|---|
| Acme Holding | DP | 72% (Maduro) | 38/50 | 18/25 | 16/25 | há 2h |

- Filtros por setor (no MVP só DP) e por faixa (Crítico/Desenvolvimento/Maduro/Excelente).
- Stats no topo: nº de orgs em cada faixa para o setor selecionado.
- Click → drill-down com o mesmo checklist do gestor (read-only, só visualiza).
- Reaproveita o padrão visual já existente em `TrackingTab`.

---

## 6. Permissões / Multi-tenancy

- Hook `useSectorOnboarding` só dispara para usuários com `canAccessModule('dp')`.
- Em **Holding mode**, agrega via `activeOrgIds` (mesmo padrão de `useDPBenefits` recém-corrigido).
- O cache `sector_onboarding` é gravado **por organização individual** (não pela holding), e a holding lê N linhas.
- Backoffice usa `has_backoffice_org_access` (já existente) para listar somente orgs autorizadas.

---

## 7. Arquitetura para escalar a outros setores

- Hook recebe `sector` como parâmetro: `useSectorOnboarding('financeiro')` no futuro plugará no mesmo modelo.
- Lista de checks e pesos vive em `src/lib/sectorMaturity/dp.ts` (objeto `MATURITY_DEFINITIONS.dp`). Adicionar Financeiro = criar `financeiro.ts` com a mesma forma + adicionar entrada no registry.
- `SectorOnboardingBar` é genérica (recebe `sector` prop). Criamos o wrapper `<SectorOnboardingBar sector="dp" />` no `DepartamentoPessoal.tsx`.

---

## 8. Entregáveis

### Migração SQL
- Tabela `sector_onboarding` + índices (`organization_id`, `sector`) + RLS (org members + backoffice).

### Novos arquivos
- `src/lib/sectorMaturity/types.ts` — tipos compartilhados.
- `src/lib/sectorMaturity/dp.ts` — definições, pesos e função `evaluateDP(data)` pura (testável).
- `src/hooks/useSectorOnboarding.ts` — orquestra queries + cálculo + persist.
- `src/components/sector-onboarding/SectorOnboardingBar.tsx` — barra colapsável genérica.
- `src/components/sector-onboarding/SectorOnboardingChecklist.tsx` — lista detalhada (usado na barra e no Backoffice).
- `src/components/dp/DPOnboardingWizard.tsx` — wizard focused (accordion).
- `src/pages/BackofficeSectorMaturity.tsx` — nova aba/visão (ou `SectorMaturityTab` dentro de `BackofficeOnboarding.tsx`).

### Edições
- `src/pages/DepartamentoPessoal.tsx` — injeta `SectorOnboardingBar` e nova aba “Onboarding”.
- `src/components/dp/DPDashboard.tsx` — KPI “Maturidade DP”.
- `src/pages/BackofficeOnboarding.tsx` — adiciona aba “Maturidade Setorial”.
- `src/App.tsx` — (se necessário) rota nova; provavelmente fica como aba interna do Backoffice atual.

### Testes
- `src/lib/sectorMaturity/dp.test.ts` — casos: tudo zerado, parcial, completo, com rotinas atrasadas, em modo Holding.

---

## 9. Memória do projeto

Após implementação:
- `mem://features/sector-onboarding-maturity` — descreve modelo (3 dimensões), cache `sector_onboarding`, padrão de extensão por setor.
- Atualizar `mem://index.md` (Memories).

---

## Decisões para confirmar

1. **Lugar do checklist completo**: nova aba “Onboarding” dentro do DP **ou** modal/drawer aberto pela barra? (Sugiro **drawer** — mantém o número atual de abas e segue o padrão `focused-wizard-pattern`.)
2. **Pesos das dimensões** (50/25/25): aceita esses ou prefere ajustar (ex.: 40/30/30 para dar mais peso à atualização contínua)?
3. **Itens manuais** (checkboxes que o gestor marca explicitamente): incluir desde o MVP ou só itens automáticos derivados de dados?

Posso seguir com os defaults sugeridos se você não tiver preferência — basta aprovar o plano.
