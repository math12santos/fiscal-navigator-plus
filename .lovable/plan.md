
## Diagnóstico da estrutura atual

O FinCore cresceu como uma aplicação React+Supabase **achatada em 2 camadas** (UI ↔ hooks que falam direto com o Supabase). Hoje:

- **124 arquivos** importam o cliente Supabase diretamente — incluindo páginas e componentes.
- **Hooks "deus"**: `useDP.ts` (846 linhas), `useFinanceiroImport.ts` (782), `useDPCockpit`, `usePayrollProjections` (517), `useCommercialPlanning` (466), `useBackoffice` (437) misturam fetch, regras de negócio, mutations e formatação.
- **Páginas Backoffice** chamam `supabase.from()` em **44 / 22 lugares** — não há fronteira de serviço.
- **Não existem pastas `domain/`, `services/`, `api/`, `modules/`** — só `lib/` (utilitários puros) e `hooks/` (acesso a dados).
- **Integrações cross-módulo** estão dispersas: `projectionRegistry.ts` é o único ponto canônico (MECE de projeções), mas a materialização DP→Caixa, Contratos→Caixa, CRM→Contratos, Jurídico→Caixa, TI→Caixa vivem espalhadas em hooks/triggers SQL sem um contrato comum.
- **Sem contratos de API internos**: cada módulo expõe o que quer; quem consome importa hook alheio e acopla a sua estrutura interna.

A "regra-mãe" do FinCore (separar UI / cadastros / regras / integrações internas / persistência / logs / impacto financeiro) **não está refletida na árvore de pastas**.

## Objetivo

Implantar uma arquitetura modular em **4 camadas** com contratos internos explícitos, sem reescrever tudo: migração incremental, módulo a módulo, mantendo o app funcionando.

```text
┌─────────────────────────────────────────────────────────┐
│  UI Layer        src/components/<modulo>/, src/pages/   │  React puro, sem supabase.from()
├─────────────────────────────────────────────────────────┤
│  Orchestration   src/modules/<modulo>/hooks/            │  React Query, cache, toast, invalidation
├─────────────────────────────────────────────────────────┤
│  Domain          src/modules/<modulo>/domain/           │  Regras puras, tipos, cálculos, validações
├─────────────────────────────────────────────────────────┤
│  Persistence     src/modules/<modulo>/services/         │  Único ponto que toca Supabase / Edge Functions
└─────────────────────────────────────────────────────────┘
                            ↕
        src/modules/_contracts/   ← Contratos internos entre módulos
        src/modules/_integrations/ ← Orquestradores cross-módulo (DP→Caixa, CRM→Contrato, etc.)
```

## Estrutura-alvo por módulo

Exemplo `src/modules/juridico/`:

```text
juridico/
├── index.ts                  ← API pública do módulo (re-exporta hooks + contratos)
├── domain/
│   ├── types.ts              ← JuridicoProcess, RiskLevel, etc.
│   ├── riskMatrix.ts         ← cálculo puro de exposição
│   └── settlementRules.ts    ← regras de acordo (puras, testáveis)
├── services/
│   ├── processesService.ts   ← list/get/create/update/delete (Supabase)
│   ├── settlementsService.ts
│   └── expensesService.ts
├── hooks/
│   ├── useProcesses.ts       ← React Query wrappers (orquestração)
│   └── useSettlements.ts
└── components/               ← (opcional) componentes específicos do domínio
```

## Contratos internos (`src/modules/_contracts/`)

Tipos versionados que módulos usam para conversar **sem importar uns aos outros**:

```text
_contracts/
├── cashflow.ts        ← CashflowEntryInput, postToCashflow(payload)
├── tasks.ts           ← AutoTaskRequest (já planejado na Fase 2)
├── notifications.ts   ← NotificationPayload
├── projections.ts     ← (move projectionRegistry.ts pra cá)
└── audit.ts           ← AuditEvent
```

Regra: **um módulo só pode importar de `_contracts/` ou da própria pasta**. Nunca de outro módulo.

## Orquestradores cross-módulo (`src/modules/_integrations/`)

Onde vivem as integrações entre módulos hoje espalhadas:

```text
_integrations/
├── dpToCashflow.ts        ← materializa folha → cashflow_entries
├── contractToCashflow.ts  ← parcelas → caixa
├── crmToContract.ts       ← oportunidade ganha → contrato
├── juridicoToCashflow.ts  ← acordos/sinistros → caixa
├── tiToCashflow.ts        ← compras/incidentes → caixa
└── autoTaskDispatcher.ts  ← criação de tarefas automáticas
```

Cada orquestrador consome `services/` dos dois lados e respeita `_contracts/`.

## Plano de migração (incremental, 5 fases)

### Fase 1 — Fundação (sem refatorar nada ainda)
- Criar pastas `src/modules/`, `src/modules/_contracts/`, `src/modules/_integrations/`.
- Mover `src/lib/projectionRegistry.ts` → `src/modules/_contracts/projections.ts` (re-export para não quebrar imports).
- Definir contratos: `cashflow.ts`, `tasks.ts`, `audit.ts`, `notifications.ts`.
- Adicionar **ESLint rule** (`no-restricted-imports`) que bloqueia: 
  - componentes/páginas importando `@/integrations/supabase/client` diretamente (warning, não error, durante a migração);
  - módulos importando uns aos outros fora de `_contracts/`.
- Criar `docs/architecture.md` com o diagrama e as regras.

### Fase 2 — Migrar módulos pequenos (piloto)
Converter primeiro **Jurídico** e **TI** (são novos e pequenos):
- Mover `src/hooks/useJuridico.ts` → quebrar em `src/modules/juridico/services/*` + `hooks/*` + `domain/*`.
- Mesmo para `useITEquipment`, `useITIncidents`, `useITTickets`, etc.
- Componentes em `src/components/juridico/` e `src/components/ti/` passam a importar via `@/modules/juridico` e `@/modules/ti`.
- Validar: testes manuais + `tsc` limpo.

### Fase 3 — Quebrar god-hooks
Refatorar os hooks gigantes em ordem de dor:
1. `useDP.ts` (846) → `modules/dp/{services,domain,hooks}` separando employees, benefits, payroll, vacations, terminations.
2. `useFinanceiroImport.ts` (782) → `modules/financeiro/import/`.
3. `useCRM.ts` + `useCRMIntelligence.ts` → `modules/crm/`.
4. `useContracts.ts` + `useContractInstallments.ts` + `useContractAdjustments.ts` → `modules/contratos/`.
5. `useFinanceiro.ts` + `useCashFlow.ts` + `useFinancialDashboardKPIs.ts` → `modules/financeiro/`.

### Fase 4 — Consolidar integrações cross-módulo
- Mover toda a Fase 1 do plano anterior (DP→Caixa, Contratos→Caixa, CRM→Contrato, Jurídico→Caixa, TI→Caixa) para `src/modules/_integrations/`.
- Cada orquestrador exporta uma função única: `postPayrollToCashflow(runId)`, `postSettlementToCashflow(settlementId)`, etc.
- Botões na UI chamam o orquestrador, não o service direto.

### Fase 5 — Endurecer fronteiras
- Remover **todos** os `supabase.from()` de `src/components/` e `src/pages/` (44 em BackofficeDashboard, 22 em BackofficeCompany são os principais).
- Promover a ESLint rule de `warn` para `error`.
- Adicionar documentação de cada módulo (`README.md` em cada pasta).
- Sessão de testes: cobrir `domain/` (lógica pura) com Vitest — alvo 70% nos cálculos críticos.

## Convenções obrigatórias

- **Services**: funções, não classes. Recebem cliente já tipado, retornam dados já tipados. Sem React, sem toast.
- **Domain**: 100% puro (sem I/O, sem React, sem Supabase). Testável com Vitest.
- **Hooks**: só React Query + invalidation + side-effects de UI (toast).
- **Contratos**: tipos versionados; mudança quebra-fronteira exige bump de versão e busca no consumidor.
- **Logs/auditoria**: orquestradores em `_integrations/` são responsáveis por gravar `audit_log` via contrato `audit.ts`.

## Detalhes técnicos relevantes

- Aliases já configurados (`@/`) — basta adicionar `@/modules/*` ao `tsconfig.json` e `vite.config.ts`.
- Mantemos React Query como camada de cache; nada muda no consumo do React.
- Migração não exige migração SQL; é puramente reorganização de TS + ESLint.
- Re-exports temporários em `src/hooks/use*.ts` apontando para `@/modules/*` para não quebrar imports antigos durante as fases 2–4.

## Entregáveis desta fase de aprovação

Se aprovado, executo **apenas a Fase 1** (fundação) primeiro:
1. Criar estrutura de pastas + `_contracts/` + `_integrations/` (vazio).
2. Mover `projectionRegistry` com re-export compatível.
3. Adicionar ESLint rule em modo `warn`.
4. Criar `docs/architecture.md`.
5. Migrar **Jurídico** e **TI** como piloto (Fase 2 mini).

Depois pausamos para você validar o piloto antes de atacar os god-hooks (Fase 3+). Isso evita um big-bang que arrisca a estabilidade.

Diga **"executar fase 1 da arquitetura"** para começar, ou peça ajustes no plano.

---

## Atualização (Fase 1 da Arquitetura Modular — concluída)

Estrutura criada em `src/modules/`:

- `_contracts/` — `cashflow.ts`, `projections.ts`, `tasks.ts`, `notifications.ts`, `audit.ts` + barrel `index.ts`.
- `_integrations/` — pasta criada (vazia, com README); orquestradores virão na Fase 4.
- `juridico/` — piloto migrado: `domain/{types,riskMatrix}` + `services/{processes,settlements,expenses,config,sanitize}` + `hooks/use*` + `index.ts`.
- `ti/` — piloto inicial: `domain/types` + `services/equipmentService` + `hooks/useITEquipment` + `index.ts`. (Demais hooks de TI — incidents, tickets, depreciation, SLA, etc. — migrarão na Fase 3.)

Compatibilidade:
- `src/hooks/useJuridico.ts` e `src/hooks/useITEquipment.ts` viraram re-exports finos apontando para `@/modules/*`. Nenhum componente precisa ser tocado nesta fase.

ESLint (warnings, não errors — promoveremos a `error` na Fase 5):
- `src/components/**` e `src/pages/**` proibidos de importar `@/integrations/supabase/client` direto.
- `modules/*/domain/**` proibido de importar Supabase, React, React Query e toast.
- `modules/*/services/**` proibido de importar React, React Query e toast.

Documentação: `docs/architecture.md` + `src/modules/README.md` + `src/modules/_integrations/README.md`.

Próximo passo sugerido: validar o piloto (Jurídico e TI) e então iniciar Fase 3 quebrando `useDP.ts` (846 linhas) em `modules/dp/`.
