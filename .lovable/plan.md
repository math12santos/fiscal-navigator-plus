
# Evolução do Termômetro de Maturidade do DP

Quatro entregas conectadas, sobre a base já existente (`sector_onboarding`, `useSectorOnboarding`, `evaluateDP`, `SectorOnboardingBar`).

---

## 1. Trilha de melhoria sugerida (clicável)

**Objetivo:** transformar o checklist em uma "trilha guiada" priorizada — o gestor sabe **o que atacar primeiro** para ganhar mais score com menos esforço.

**Lógica (cliente):**
- Novo módulo `src/lib/sectorMaturity/improvementTrack.ts`:
  - Recebe `SectorMaturityResult`, retorna `ImprovementStep[]` com itens incompletos (`earned < weight`), ordenados por **(pts faltantes ÷ esforço estimado)**.
  - Esforço estimado por chave (mapa `EFFORT_HINTS` — ex.: `dp-config-tributaria` = baixo, `dp-employees-link` = médio, `dp-routines` = alto).
  - Agrupa em 3 marcos: **Configurar (Completude) → Atualizar (Frescor) → Operar (Rotinas)**, mostrando ganho potencial por marco.

**UI:** `src/components/sector-onboarding/ImprovementTrack.tsx`
- Cards numerados com: título do item, ganho potencial (`+X pts`), badge de esforço, botão "Resolver agora" → usa o `ctaTab` já existente (mesma navegação do checklist) emitindo `onTabChange`.
- Banner de topo: "Faltam **X pts** para a próxima faixa (Maduro/Excelente)".
- Integração: nova aba **"Trilha"** no `Sheet` do `SectorOnboardingBar` (Tabs: Trilha / Checklist), padrão `focused-wizard-pattern`.

---

## 2. Notificações de checklist atrasado e meta de rotinas

**Objetivo:** alertar gestores e colaboradores quando há item crítico ou rotinas abaixo da meta.

**Backend:**
- Migration: nova coluna em `dp_config` → `meta_rotinas_pct numeric default 0.85` (meta de cumprimento mensal).
- Edge function agendada **`sector-maturity-alerts`** (`supabase/functions/sector-maturity-alerts/index.ts`):
  - Roda diariamente via `pg_cron` + `pg_net`.
  - Para cada org com módulo DP ativo:
    1. Lê `sector_onboarding` (cache mais recente).
    2. **Gestores DP** (membros com permissão `dp.config` ou `owner/admin`): cria notificação se houver `ChecklistItem` com `category='atualizacao'` cujo `detail` contém "vencido" OU se `routines_score / 25 < meta_rotinas_pct`.
    3. **Colaboradores**: cria notificação para o owner de cada `requests` (`type='rotina_dp'`) com `due_date < hoje` e status diferente de concluída/cancelada.
  - Insere em `notifications` com `type='dp_maturity'`, `priority` derivada da gravidade, `reference_type='sector_onboarding'`. Idempotência por chave `(user_id, reference_id, date_trunc('day', created_at))`.
- Cron via **insert tool** (não migration) com `net.http_post` para a função (padrão do projeto).

**UI:**
- Nada novo: o `NotificationCenter` já consome `notifications` em realtime.
- Acrescentar deep-link: notificações com `reference_type='sector_onboarding'` levam a `/dp` com query `?openMaturity=1` que abre o drawer já na aba Trilha.

---

## 3. Exportar termômetro do DP em PDF

**Objetivo:** PDF compartilhável com a alta gestão (score, sub-barras, checklist, faixa, data).

**Implementação cliente (sem edge function — `jspdf` + `jspdf-autotable` já instalados):**
- Novo `src/lib/sectorMaturity/exportMaturityPdf.ts`:
  - Cabeçalho: nome da org, setor, data, score grande + faixa.
  - Sub-barras (Completude / Atualização / Rotinas) desenhadas vetorialmente.
  - Tabela `autoTable` por categoria com colunas: Item · Pontos · Detalhe · Status (✔/⚠/○).
  - Rodapé com legenda de faixas e link da plataforma.
- Botão **"Exportar PDF"** no header do `SectorOnboardingBar` (e também no drawer do Backoffice em `SectorMaturityTab`, usando o `result` do registro selecionado).
- Nome do arquivo: `maturidade-dp-{org}-{YYYY-MM-DD}.pdf`.

---

## 4. Histórico de evolução (snapshots mensais)

**Objetivo:** acompanhar tendência por org/setor.

**Schema (migration):**
- Nova tabela `sector_onboarding_history`:
  - `id uuid pk`, `organization_id uuid not null`, `sector text not null`,
  - `period_month date not null` (sempre 1º dia do mês),
  - `score, completeness_score, freshness_score, routines_score numeric`,
  - `maturity_label text`, `checklist jsonb`, `snapshot_at timestamptz default now()`,
  - **Unique** `(organization_id, sector, period_month)`.
- RLS: leitura para membros da org + backoffice; insert apenas via service role (edge function).

**Snapshot (escolhido: server-side, 1×/mês — mais confiável):**
- Edge function **`sector-maturity-snapshot`** (cron no dia 1 às 03:00):
  - Itera `sector_onboarding`, faz `upsert` em `sector_onboarding_history` com `period_month = date_trunc('month', now() - interval '1 day')`.
  - Idempotente pelo unique key.
- Backfill opcional: ao primeiro acesso do mês, o hook `useSectorOnboarding` faz `upsert` defensivo para o mês corrente (assim a tendência aparece desde já, sem esperar o cron).

**UI — gráfico de tendência:**
- Componente `src/components/sector-onboarding/MaturityTrendChart.tsx` (recharts já no projeto):
  - LineChart com 4 séries: Score / Completude / Atualização / Rotinas.
  - Filtro de período (3m, 6m, 12m).
- **Onde aparece:**
  - **Drawer** do `SectorOnboardingBar` → 3ª aba "Tendência".
  - **Backoffice** (`SectorMaturityTab`) → ao abrir o drawer da org selecionada, nova aba "Tendência" lado a lado com o checklist (cross-org tracking).

---

## Arquivos a criar/editar

**Criar:**
- `src/lib/sectorMaturity/improvementTrack.ts`
- `src/lib/sectorMaturity/exportMaturityPdf.ts`
- `src/components/sector-onboarding/ImprovementTrack.tsx`
- `src/components/sector-onboarding/MaturityTrendChart.tsx`
- `src/hooks/useMaturityHistory.ts`
- `supabase/functions/sector-maturity-alerts/index.ts`
- `supabase/functions/sector-maturity-snapshot/index.ts`
- Migration: `sector_onboarding_history` + coluna `dp_config.meta_rotinas_pct`.

**Editar:**
- `src/components/sector-onboarding/SectorOnboardingBar.tsx` — Tabs (Trilha/Checklist/Tendência), botão exportar, deep-link `?openMaturity=1`.
- `src/components/sector-onboarding/SectorMaturityTab.tsx` — Tabs no drawer + exportar.
- `src/hooks/useSectorOnboarding.ts` — backfill defensivo do snapshot do mês.
- `mem://features/sector-onboarding-maturity.md` — documentar trilha, alertas, histórico.

---

## Princípios respeitados
- **Multi-tenant + RLS** em todas as novas tabelas.
- **MECE**: histórico vive em tabela própria (`sector_onboarding_history`); cache atual continua em `sector_onboarding`.
- **CFO-first**: PDF compartilhável e gráfico de tendência elevam o termômetro de operacional → narrativa para Conselho.
- **Reuso**: `ctaTab` do checklist alimenta a Trilha; `notifications` + realtime já existem; libs PDF já instaladas.
