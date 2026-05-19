## Objetivo

Estender o card **Maturidade dos Departamentos** do Dashboard para mostrar também **TI & Ativos**, **Jurídico** e **Compras**, hoje só DP e Financeiro são exibidos. O score consolidado passa a considerar os 5 setores.

## Diagnóstico

- `MaturityOverviewSection` já lista `dp / financeiro / juridico / ti` como suportados, **mas** o hook `useSectorOnboarding` só calcula resultado quando `sector === "dp"` ou `"financeiro"`. Para Jurídico e TI ele retorna `null` → o card fica em estado de skeleton para sempre e não aparece com dados.
- Os avaliadores `evaluateJuridico` e `evaluateTI` já existem em `src/lib/sectorMaturity/` — falta apenas alimentá-los.
- Não existe avaliador de **Compras**. Precisa ser criado seguindo a mesma rubrica (50 completude / 25 atualização / 25 rotinas).
- A constraint `sector_maturity_targets_sector_check` só permite `dp / financeiro`. Precisa aceitar `juridico / ti / compras` para o módulo de metas funcionar.

## Mudanças

### 1. Compras: novo setor de maturidade
- `src/lib/sectorMaturity/types.ts` — adicionar `"compras"` em `SectorKey` e em `SECTOR_META` (rota `/compras`).
- `src/lib/sectorMaturity/compras.ts` (novo) — `evaluateCompras` com checklist baseada nas tabelas já consumidas por `useCompras.ts`:
  - **Completude (50):** configurações de compras preenchidas, regras de aprovação ativas, fornecedores ativos com CNPJ/razão social, cobertura de tipo de compra, recorrências cadastradas, % de SCs com itens e centro de custo.
  - **Atualização (25):** SCs com cotação em andamento dentro do prazo, pedidos pendentes sem atraso, recebimentos sem divergência aberta, fornecedores revisados nos últimos 12 meses.
  - **Rotinas (25):** % de aprovações dentro do SLA, fechamento de SCs do mês, recebimentos conciliados com pedidos.
- `src/lib/sectorMaturity/targets.ts` — adicionar entrada `compras` em `fieldsForSector` (reusa `routines_target_pct` e `routines_overdue_tolerance_pct`).

### 2. Hook `useSectorOnboarding` — ativar Jurídico, TI e Compras
- Adicionar `isJur / isTi / isCompras` e os datasets necessários atrás de `enabled: !!orgId && isXxx` para não pagar custo nos outros casos.
- **Jurídico:** `juridico_config`, `juridico_processes`, `juridico_movements`, `juridico_settlements`, `juridico_settlement_installments`, `juridico_documents`, `juridico_expenses`, e `count` de `cashflow_entries` com `source = 'juridico'` no mês.
- **TI:** `it_config`, `it_equipment`, `it_systems`, `it_telecom`, `it_tickets`, `it_incidents`, `it_depreciation_params`, `it_depreciation_schedule`, `it_equipment_movements`, `it_sla_policies`, `it_equipment_attachments`.
- **Compras:** `purchase_settings`, `approval_rules`, `suppliers`, `purchase_requests (+items)`, `purchase_approvals`, `purchase_orders`, `purchase_quotations`, `purchase_receipts`, `purchase_divergences`, `purchase_recurrences`.
- Em todos: ler `requests` com `type IN ('rotina_juridico'|'rotina_ti'|'rotina_compras')` e `competencia = mês atual` para alimentar `routinesGenerated / Completed / Overdue`.
- Estender o `useMemo` de `result` com os ramos `isJur → evaluateJuridico(...)`, `isTi → evaluateTI(...)`, `isCompras → evaluateCompras(...)`.
- Estender `isLoading` e o `refresh()` (invalida as novas query keys).

### 3. Dashboard
- `src/components/dashboard/MaturityOverviewSection.tsx` — adicionar `"compras"` em `SUPPORTED_SECTORS`. O grid já é responsivo (`md:grid-cols-2`), continua bom em 5 cards.

### 4. Banco
- Migration única: `ALTER TABLE public.sector_maturity_targets DROP CONSTRAINT sector_maturity_targets_sector_check; ADD CONSTRAINT ... CHECK (sector = ANY (ARRAY['dp','financeiro','juridico','ti','compras']));`
- Nenhuma outra alteração — `sector_onboarding`, `sector_onboarding_history` e RLS já são genéricos por organização.

## Fora do escopo

- Não mexer no Backoffice de maturidade nem nos snapshots mensais (a edge function `sector-maturity-snapshot` já é genérica por setor).
- Não criar trilha de melhoria automática para Compras agora — só o termômetro + checklist.
- Sem mudanças visuais na barra dentro de cada módulo (`SectorOnboardingBar`).

## Como o usuário vai perceber

No Dashboard, o bloco "Maturidade dos Departamentos" passa a mostrar 5 cards (DP, Financeiro, Jurídico, TI & Ativos, Compras), cada um com score 0-100, badge de nível, mini-barras de Completude/Atualização/Rotinas e botão "Abrir setor". O score consolidado no header passa a refletir a média dos 5.
