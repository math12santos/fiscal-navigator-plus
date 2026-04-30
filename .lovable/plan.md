
## Objetivo

Trazer os módulos **TI & Patrimônio Tech** e **Jurídico** para o mesmo padrão dos demais módulos do FinCore:

1. **Modo Holding**: respeitar `useHolding()` (consolidado / por empresa) em todas as listagens.
2. **Trilha de Maturidade**: criar avaliadores próprios e plugar a `SectorOnboardingBar` em ambos os módulos, alimentando também o card de maturidade consolidada do Dashboard.

---

## Parte 1 — Modo Holding em TI e Jurídico

### Estado atual

- Os módulos hoje usam apenas `useOrganization()` e filtram por `currentOrg.id`.
- Páginas `Juridico.tsx` e `TI.tsx` usam um `<header>` próprio (não o `PageHeader`), então não exibem `HoldingToggle` nem `HoldingCompanyTabs`.

### Mudanças

**1.1 Trocar `<header>` por `<PageHeader>`**
- `src/pages/Juridico.tsx` e `src/pages/TI.tsx`: usar `<PageHeader title="..." description="..." />` para herdar automaticamente o toggle Holding e as abas por empresa.

**1.2 Hooks Jurídico — aplicar padrão `activeOrgIds`**

Padrão já consolidado em `useContracts`/`useCRM`/`useCashFlow`:

```ts
const { holdingMode, activeOrgIds } = useHolding();
const orgIds = holdingMode && activeOrgIds.length > 0
  ? activeOrgIds
  : currentOrg?.id ? [currentOrg.id] : [];
// queryKey inclui orgIds; .in("organization_id", orgIds)
```

Aplicar em:
- `src/modules/juridico/hooks/useJuridicoProcesses.ts`
- `src/modules/juridico/hooks/useJuridicoSettlements.ts`
- `src/modules/juridico/hooks/useJuridicoExpenses.ts`
- `src/modules/juridico/hooks/useJuridicoConfig.ts` (config permanece por org da seleção; em modo consolidado usa `currentOrg`)

Os respectivos services (`processesService`, `settlementsService`, `expensesService`) ganham uma sobrecarga `listX(orgIds: string[], filters?)` usando `.in("organization_id", orgIds)`. Mutations continuam escrevendo em `currentOrg.id` (escrita sempre na empresa selecionada — em modo consolidado bloqueia/usa holding).

**1.3 Hooks TI — mesmo padrão**

Aplicar em:
- `src/modules/ti/hooks/useITEquipment.ts` + `equipmentService.listEquipment`
- `src/hooks/useITSystems.ts`
- `src/hooks/useITTelecom.ts`
- `src/hooks/useITTickets.ts`
- `src/hooks/useITIncidents.ts`
- `src/hooks/useITDepreciation.ts`
- `src/hooks/useITMovements.ts`
- `src/hooks/useITAuditLog.ts`
- `src/hooks/useITSLA.ts`
- `src/hooks/useITSchedule.ts`
- `src/hooks/useITTCO.ts`
- `src/hooks/useITConfig.ts` (config: usa `currentOrg`)

Cada query passa a:
- incluir `holdingMode ? activeOrgIds : currentOrg?.id` no `queryKey`
- usar `.in("organization_id", orgIds)` quando `holdingMode && activeOrgIds.length > 0`, senão `.eq("organization_id", currentOrg.id)`

**1.4 Dashboards consolidados**
- `TIDashboard.tsx` e `JuridicoDashboard.tsx` continuam funcionando — apenas passam a receber arrays já consolidados quando o usuário ativa Holding/Consolidado, ou filtrados quando escolhe uma empresa nas abas.
- Adicionar um pequeno indicador (badge) no topo do dashboard quando `holdingMode` está ativo, replicando o padrão visto em outros módulos (opcional — se o `PageHeader` já mostra, dispensável).

---

## Parte 2 — Trilha de Maturidade do Jurídico

### Critérios (100 pts: 50 completude / 25 atualização / 25 rotinas)

**Completude (50)**
- Configuração jurídica preenchida (responsável, escritório padrão, política de provisão) — 8
- Pelo menos 1 processo cadastrado — 4
- % de processos com `numero_cnj` válido + `parte_contraria` + `valor_causa` — 8
- % de processos com `probabilidade` definida (provável/possível/remota) — 8
- % de processos com `valor_provisionado` coerente com a probabilidade — 6
- % de processos com advogado/escritório responsável — 6
- Documentos anexados em ≥ 80% dos processos ativos — 6
- Cadastro de tipos de despesa jurídica (`juridico_expenses` por categoria) — 4

**Atualização (25)**
- % de processos ativos com movimento (`juridico_movements`) nos últimos 90 dias — 10
- Nenhuma audiência vencida sem atualização — 5
- Acordos ativos com `juridico_settlement_installments` em dia — 5
- Provisão recalculada nos últimos 30 dias (compara `updated_at`) — 5

**Rotinas (25)**
- Rotinas jurídicas registradas em `requests` (`type in ('rotina_juridico','juridico')`) para a competência — geradas/concluídas/atrasadas — 15
- Reconciliação financeira: despesas jurídicas do mês têm contrapartida em `cashflow_entries` (via `source='juridico'`) — 10

### Arquivos
- `src/lib/sectorMaturity/juridico.ts` — `evaluateJuridico(input)` retornando `SectorMaturityResult`.
- Estender `SectorKey` em `types.ts` com `"juridico"` e adicionar entrada em `SECTOR_META` (`label: "Jurídico"`, `route: "/juridico"`).
- Estender `targets.ts` com campos específicos (ex.: `movement_freshness_days`, `provision_required_for_provavel`) e ajustar `fieldsForSector("juridico")`.
- Plugar avaliador em `useSectorOnboarding.ts`: novo bloco `isJur` com queries para `juridico_processes`, `juridico_movements`, `juridico_settlements`, `juridico_settlement_installments`, `juridico_documents`, `juridico_expenses`, `juridico_config`, `requests` (tipo jurídico).
- Renderizar `<SectorOnboardingBar sector="juridico" />` no topo de `Juridico.tsx` (logo após o `PageHeader`).

---

## Parte 3 — Trilha de Maturidade do TI

### Critérios (100 pts: 50 / 25 / 25)

**Completude (50)**
- Configuração TI preenchida (`it_config`: política de garantia, dias úteis, alertas) — 6
- Pelo menos 1 equipamento cadastrado — 4
- % de equipamentos com `patrimonial_code` + `acquisition_value` + `acquisition_date` — 8
- % de equipamentos ativos com `responsible_employee_id` — 8
- % de equipamentos com parâmetros de depreciação (`it_depreciation_params`) — 6
- Cadastro de sistemas (≥ 1 ativo) e links de telecom (≥ 1 ativo) — 6
- Políticas de SLA cadastradas (`it_sla_policies` ≥ 1 por prioridade) — 6
- Documentos/contratos anexados em ≥ 80% dos sistemas/links ativos — 6

**Atualização (25)**
- Nenhum equipamento com garantia vencida não tratada — 5
- Nenhum sistema/link com `renewal_date` vencido — 6
- Depreciação calculada (`it_depreciation_schedule` para o mês corrente) — 5
- Saldo contábil consolidado calculado nos últimos 30 dias — 4
- Inventário sem movimentos pendentes (`it_equipment_movements` em `pendente`) — 5

**Rotinas (25)**
- % de chamados (`it_tickets`) abertos dentro do SLA — 10
- Chamados resolvidos no mês ÷ chamados abertos no mês — 8
- Incidentes (`it_incidents`) com tratativa registrada — 7

### Arquivos
- `src/lib/sectorMaturity/ti.ts` — `evaluateTI(input)`.
- `SectorKey` += `"ti"`; `SECTOR_META.ti = { label: "TI & Patrimônio", route: "/ti" }`.
- `targets.ts`: campos específicos (`sla_target_pct`, `renewal_alert_days`, `warranty_alert_days`).
- Plugar em `useSectorOnboarding.ts` com queries para todas as tabelas `it_*` e `requests` (`rotina_ti`).
- Renderizar `<SectorOnboardingBar sector="ti" />` em `TI.tsx`.

---

## Parte 4 — Integração com o Dashboard Geral

- `src/components/dashboard/MaturityOverviewSection.tsx`: `SUPPORTED_SECTORS` passa de `["dp", "financeiro"]` para `["dp", "financeiro", "juridico", "ti"]`.
- O grid sobe para 2 colunas em md / mantendo layout responsivo (já é `md:grid-cols-2`).
- O `useMaturityMonthlyBackfill` já é genérico — vai gravar histórico mensal automaticamente para os novos setores em `sector_onboarding_history`.

---

## Parte 5 — Backoffice e alertas

- `sector-maturity-snapshot` e `sector-maturity-alerts` (edge functions) já são genéricas por `sector` na tabela `sector_onboarding`. Nenhuma migração obrigatória — basta os novos snapshots começarem a ser gravados.
- Backoffice de metas (`SectorMaturityTargetsDialog`) passa a oferecer `juridico` e `ti` a partir do `fieldsForSector(sector)`.

---

## Detalhes técnicos

### Padrão de query Holding-aware (referência)
```ts
const { currentOrg } = useOrganization();
const { holdingMode, activeOrgIds } = useHolding();
const orgIds = holdingMode && activeOrgIds.length > 0
  ? activeOrgIds
  : currentOrg?.id ? [currentOrg.id] : [];

const list = useQuery({
  queryKey: ["it_equipment", orgIds],
  enabled: orgIds.length > 0,
  queryFn: () => listEquipment(orgIds),
});
```

### Migrações de banco
Nenhuma migração de schema é necessária:
- `sector_onboarding`, `sector_onboarding_history` e `sector_maturity_targets` já aceitam qualquer string em `sector`.
- Tabelas `it_*` e `juridico_*` já têm `organization_id` + RLS por organização.

### RLS
RLS atual já permite `SELECT` em qualquer `organization_id` que o usuário pertença — ou seja, modo Holding "consolidado" funciona sem alteração de policies (mesma estratégia já usada por Contratos/CRM/Cashflow).

### Memória de projeto (a registrar após implementação)
- `mem://features/maturity-juridico` — critérios e pesos da trilha jurídica
- `mem://features/maturity-ti` — critérios e pesos da trilha de TI
- Atualizar Core para registrar que TI e Jurídico agora seguem o padrão Holding.

---

## Resumo de arquivos

**Criar**
- `src/lib/sectorMaturity/juridico.ts`
- `src/lib/sectorMaturity/ti.ts`

**Editar**
- `src/lib/sectorMaturity/types.ts` (SectorKey + SECTOR_META)
- `src/lib/sectorMaturity/targets.ts` (campos + fieldsForSector)
- `src/hooks/useSectorOnboarding.ts` (blocos `isJur` e `isTi` + cálculo)
- `src/components/dashboard/MaturityOverviewSection.tsx` (SUPPORTED_SECTORS)
- `src/pages/Juridico.tsx` e `src/pages/TI.tsx` (PageHeader + SectorOnboardingBar)
- Hooks Jurídico (4 arquivos) e Services (3 arquivos)
- Hooks TI (12 arquivos) + `equipmentService` (services dos demais já estão inline nos hooks)

**Sem migração de banco.**
