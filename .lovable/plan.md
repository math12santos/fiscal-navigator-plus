# Plano de Melhorias de Integrações Entre Módulos

## Diagnóstico

Mapa atual de integrações no FinCore (origens em `cashflow_entries` no banco):

```text
importacao : 1.476  (importação CSV/OFX)
contrato   :    32  (Contratos → Cashflow ✅)
manual     :    30  (Lançamento manual)
dp         :     0  (cód. existe, sem dados ainda)
crm        :     0  (cód. registry existe, sem materialização)
juridico   :     0  (RPC existe, sem uso)
ti         :     0  (RPC existe, sem uso)
```

**Conclusão:** o esqueleto MECE está pronto (`source` + `source_ref` + `projectionRegistry`), mas várias rotas de integração estão **definidas no código e não percorridas pelo usuário** ou **não existem ainda**. 12 lacunas detectadas.

---

## Lacunas Identificadas

### 🔴 Crítico — quebra a promessa "fonte única da verdade"

1. **CRM Won → Contratos**: existe `projectionRegistry.crmWon()` mas o `useCRM.updateOpportunityStage` não dispara criação automática de contrato/projeção quando muda para "Ganho".
2. **Jurídico → Fluxo de Caixa**: RPCs `juridico_approve_settlement` e `juridico_post_expense_to_cashflow` existem, mas **nenhuma tela exibe os botões** de aprovar/lançar — usuário não consegue acionar.
3. **TI → Fluxo de Caixa**: depreciação mensal e custos de chamados/incidentes não geram entradas em `cashflow_entries` (a query da migration espera `source='ti'` mas nada grava com esse source).
4. **Tarefas (Requests) órfãs**: DP cria requests para rotinas, mas Jurídico (audiências, prazos), TI (manutenção, garantia vencendo) e Contratos (vencimento, reajuste) **não criam tarefas automáticas**.

### 🟡 Importante — perda de eficiência operacional

5. **Notificações fragmentadas**: `useNotifications` existe mas não é chamado pelos hooks de Jurídico, TI, Contratos e CRM em eventos-chave (acordo aprovado, chamado SLA estourado, contrato vencendo, oportunidade parada >30d).
6. **Centro de Custo ausente em TI/Jurídico**: lançamentos desses módulos vão para o cashflow sem `cost_center_id`, impossibilitando rateio em DRE por unidade.
7. **Planejamento × Realizado sem TI/Jurídico**: comparativo Plan × Real só considera DP e Contratos. CAPEX de TI e provisões jurídicas ficam fora.
8. **Conciliação bancária não cobre TI/Jurídico/CRM**: extrato bancário só é cruzado com `source IN ('contrato','dp','manual')`.

### 🟢 Estratégico — visão executiva incompleta

9. **Dashboard executivo sem riscos jurídicos**: provisão consolidada (probable + possible) não aparece no Dashboard CFO/Board.
10. **Runway/Liquidez sem CAPEX TI**: aquisições programadas de equipamentos e renovações de licenças não entram na projeção de liquidez.
11. **Relatórios para Conselho sem narrativa cross-módulo**: `RelatoriosDistribuicao` não tem template "Pacote Conselho" agregando Financeiro + Contratos + DP + Jurídico (riscos) + TI (CAPEX).
12. **Auditoria fragmentada**: cada módulo tem seu `*_audit_log` (juridico_audit_log, it_audit_log, audit_log financeiro) — não há visão unificada para o Backoffice/Master.

---

## Plano em 4 Fases

### Fase 1 — Fechar o ciclo financeiro (crítico)

1.1 **CRM → Contrato automático ao "Ganho"**
- Em `useCRM.updateOpportunityStage`, quando o estágio destino tem flag `is_won`, criar contrato em rascunho com cliente, valor e parcelas da oportunidade + `crm_opportunity_id` no contrato.
- Toast com link "Abrir contrato gerado".

1.2 **UI Jurídico → Cashflow**
- Botão **"Aprovar e lançar no caixa"** em `JuridicoSettlementsTab` chamando `juridico_approve_settlement` (RPC já existe).
- Botão **"Lançar despesa no caixa"** em `JuridicoExpensesTab` chamando `juridico_post_expense_to_cashflow`.
- Badge "Lançado" / "Pendente" em cada linha.

1.3 **TI → Cashflow** (3 sub-fluxos)
- **Aquisição**: ao registrar `it_equipment` com `valor_aquisicao`, criar `cashflow_entry` com `source='ti'`, `source_ref='equipment:<id>'`, tipo `saida`, categoria `capex_ti`.
- **Depreciação mensal**: cron edge function `it-monthly-depreciation` que materializa parcela mensal por equipamento usando `it_depreciation_schedule`.
- **Chamados/Incidentes pagos**: campo `custo_real` em incidents → cashflow `source='ti'`, `source_ref='incident:<id>'`.
- Adicionar `cost_center_id` opcional em `it_equipment` e `juridico_processes` (propaga ao cashflow).

### Fase 2 — Alertas e tarefas automáticas

2.1 **Tarefas automáticas cross-módulo** (uma helper `createAutoRequest({module, source_id, due_date, ...})`):
- **Jurídico**: 7 dias antes de audiência (`data_audiencia`), 3 dias antes de prazo processual.
- **Contratos**: 30/15/7 dias antes de vencimento, 60 dias antes de reajuste anual.
- **TI**: 30 dias antes de fim de garantia, 30 dias antes de vencimento de licença, chamado SLA com >80% do tempo decorrido.
- **CRM**: oportunidade sem atividade há >30 dias (auto-cria task "Reaquecer lead").

2.2 **NotificationCenter unificado**
- Estender `useNotifications` para receber eventos de todos os módulos via tabela `notifications` com `category` (`juridico|ti|contratos|crm|dp|financeiro`).
- Triggers SQL: novo acordo, novo chamado crítico, contrato vencendo, oportunidade ganha, rescisão calculada.
- Filtro por categoria no sino.

### Fase 3 — Consolidação financeira completa

3.1 **Conciliação cobre todos os sources**
- `useConciliacao` matcher passa a aceitar `source IN ('contrato','dp','manual','importacao','crm','juridico','ti')`.
- Filtros visuais por módulo na tela de conciliação.

3.2 **Plan × Real inclui TI e Jurídico**
- Em `useFinanceiro` agregar realizado por `source` para cruzar com linhas de orçamento `categoria IN ('capex_ti', 'provisoes_juridicas')`.
- Adicionar abas "TI" e "Jurídico" em `Planejamento → Plan × Real`.

3.3 **Liquidez/Runway com CAPEX TI**
- `useFinancialDashboardKPIs.runway` passa a subtrair CAPEX TI projetado (entradas futuras `source='ti'` tipo saída).

### Fase 4 — Visão executiva (Board / Investor)

4.1 **Card "Riscos Jurídicos" no Dashboard**
- Soma de `valor_provisionado` por probabilidade (provável/possível/remota) com semáforo.
- Drill-down para `/juridico?tab=processos&prob=provavel`.

4.2 **Pacote Conselho** em `RelatoriosDistribuicao`
- Novo template multi-seção: Resumo Financeiro + Contratos ativos + Folha + Provisões Jurídicas + CAPEX TI + Comparativo Plan×Real + Cenários.
- Saída PDF + envio Slack/Email/Telegram.

4.3 **Auditoria unificada (Backoffice)**
- Nova aba `BackofficeAudit` "Trilha consolidada" que faz `UNION ALL` de `audit_log`, `juridico_audit_log`, `it_audit_log` com filtro por usuário/módulo/data.

---

## Detalhes Técnicos

**Padrão MECE preservado:** todo lançamento que materializa em `cashflow_entries` usa `source` + `source_ref` único e `ON CONFLICT DO UPDATE` (idempotente), seguindo o padrão já adotado em DP/Contratos.

**Helper de auto-tarefas:**
```ts
// src/lib/autoRequests.ts
export async function createAutoRequest(opts: {
  module: 'juridico'|'ti'|'contratos'|'crm';
  source_table: string;
  source_id: string;
  title: string;
  due_date: string;
  assigned_to?: string;
  priority?: 'low'|'medium'|'high';
})
```
- Idempotente via `unique(source_table, source_id, title)`.
- Chamado em hooks de upsert de cada módulo + cron edge function diária para olhar janelas (vencimentos).

**Migrations envolvidas:** ~6 migrations adicionando colunas (`cost_center_id` em it/juridico, `crm_opportunity_id` em contracts), índices e triggers de notificação.

**Edge functions novas:** `it-monthly-depreciation`, `auto-tasks-scanner` (cron diário que varre vencimentos).

---

## Entrega Sugerida

Posso executar **Fase 1 inteira em uma rodada** (fecha o ciclo financeiro: CRM→Contrato, Jurídico→Caixa, TI→Caixa). Fases 2/3/4 em rodadas seguintes.

Diga **"executar fase 1"** para começar, ou **"executar tudo em sequência"** se preferir o pacote completo.

---

## ✅ Fase 1 IMPLEMENTADA (2026-04-30)

**Migration:** índice único `cashflow_entries(organization_id, source, source_ref)` + 5 funções/triggers.

1. **CRM Won → Contrato automático**: RPC `crm_generate_contract_from_opportunity` chamada em `useCRM.moveToStage`. Cria contrato em rascunho idempotente, vincula `crm_opportunities.contract_id`. Toast com link.
2. **TI → Cashflow (CAPEX)**: trigger `trg_it_equipment_cashflow` materializa aquisições com `source='ti'`, `source_ref='equipment:<id>'`, propaga `cost_center_id`.
3. **TI → Cashflow (Sinistros)**: trigger `trg_it_incident_cashflow` materializa perda líquida (`estimated_loss_value - recovered_value`).
4. **Jurídico**: botões "Aprovar e lançar no caixa" (acordos) e "Lançar" (despesas) já existiam — mantida UI com badge "Lançado/Pendente".
5. **Invalidação de cache**: `useITEquipment` e `useITIncidents` agora invalidam `cashflow`/`financeiro`.

**Próximo:** Fase 2 (auto-tarefas + notificações cross-módulo).
