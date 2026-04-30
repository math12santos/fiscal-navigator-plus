# FinCore — Arquitetura Modular em Camadas

> Status: **Fase 1 (Fundação) implementada.** Migração incremental.
> Detalhes do plano completo: `.lovable/plan.md`.

## Por que essa arquitetura?

O FinCore é um cockpit financeiro. Cada módulo (DP, Contratos, CRM, Jurídico, TI, Financeiro)
gera fatos financeiros que precisam fluir para o caixa, planejamento e relatórios sem
duplicação (princípio MECE) e com auditoria.

A estrutura inicial achatava UI ↔ Supabase em hooks gigantes, dificultando
testes, integrações cross-módulo e manutenção. A nova arquitetura separa
responsabilidades em **4 camadas + 2 áreas compartilhadas**.

## As 4 camadas

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer        src/components/<modulo>/, src/pages/   │  React puro
├─────────────────────────────────────────────────────────┤
│  Orchestration   src/modules/<modulo>/hooks/            │  React Query, toast, invalidation
├─────────────────────────────────────────────────────────┤
│  Domain          src/modules/<modulo>/domain/           │  Regras puras, tipos, cálculos
├─────────────────────────────────────────────────────────┤
│  Persistence     src/modules/<modulo>/services/         │  Único ponto que toca Supabase
└─────────────────────────────────────────────────────────┘
                            ↕
        src/modules/_contracts/      ← Contratos internos entre módulos
        src/modules/_integrations/   ← Orquestradores cross-módulo
```

### Regras de cada camada

| Camada | Pode importar de | NÃO pode importar de |
|---|---|---|
| **services/** | `@/integrations/supabase/*`, `_contracts/`, próprio `domain/` | React, hooks, toast, outros módulos |
| **domain/** | apenas tipos puros e `_contracts/` | Supabase, React, fetch, I/O |
| **hooks/** | próprio `services/`, próprio `domain/`, React Query, toast | Supabase direto, outros módulos |
| **components/** | próprios `hooks/`, `_contracts/`, UI lib | Supabase direto, services de outros módulos |
| **_integrations/** | `services/` de quaisquer módulos, `_contracts/` | UI, hooks |
| **_contracts/** | nada do app (só tipos puros) | tudo |

## Contratos internos (`src/modules/_contracts/`)

Tipos versionados que módulos usam para conversar **sem importar uns aos outros**:

- `cashflow.ts` — `CashflowEntryInput`, `ProjectionSource`, chaves canônicas
- `tasks.ts` — `AutoTaskRequest` para criação automática de tarefas
- `notifications.ts` — `NotificationPayload`
- `audit.ts` — `AuditEvent`
- `projections.ts` — re-export de `projectionRegistry` (chaves MECE de projeções virtuais)

> **Regra de ouro:** um módulo nunca importa de outro módulo. Sempre via `_contracts/`
> ou via um orquestrador em `_integrations/`.

## Orquestradores cross-módulo (`src/modules/_integrations/`)

Onde vivem as integrações entre módulos. Cada orquestrador consome `services/` dos
dois lados e respeita os `_contracts/`:

- `dpToCashflow.ts` — folha → cashflow_entries
- `contractToCashflow.ts` — parcelas → caixa
- `crmToContract.ts` — oportunidade ganha → contrato
- `juridicoToCashflow.ts` — acordos/sinistros → caixa
- `tiToCashflow.ts` — compras/incidentes → caixa
- `autoTaskDispatcher.ts` — criação de tarefas automáticas

## Estrutura-alvo de um módulo

```
modules/juridico/
├── index.ts                  ← API pública (re-exporta hooks + tipos)
├── domain/
│   ├── types.ts
│   ├── riskMatrix.ts         ← cálculo puro de exposição
│   └── settlementRules.ts
├── services/
│   ├── processesService.ts   ← Supabase
│   ├── settlementsService.ts
│   └── expensesService.ts
├── hooks/
│   ├── useProcesses.ts       ← React Query
│   └── useSettlements.ts
└── components/               ← (opcional) componentes próprios
```

## Status da migração

- [x] **Fase 1** — Fundação: pastas, contratos, ESLint warning, doc.
- [x] **Fase 2 piloto** — Jurídico e TI migrados.
- [ ] **Fase 3** — Quebrar god-hooks (DP, Financeiro, CRM, Contratos).
- [ ] **Fase 4** — Consolidar integrações cross-módulo.
- [ ] **Fase 5** — Endurecer fronteiras (ESLint warn → error, remover `supabase.from()` das pages).

## Convenções obrigatórias

- **Services**: funções, não classes. Sem React, sem toast.
- **Domain**: 100% puro. Testável com Vitest.
- **Hooks**: só React Query + side-effects de UI.
- **Logs/auditoria**: orquestradores em `_integrations/` gravam `audit_log` via contrato.
