
# Evolução do Módulo TI — Além do MVP

## Diagnóstico do MVP atual

O MVP entrega cadastros sólidos (Equipamentos, Sistemas, Telecom, Chamados, Sinistros, Depreciação) com numeração automática, RLS por org e dashboard de KPIs. Pontos a evoluir:

1. **Sem integração real com Cashflow** — `generates_recurring_cost`, `generates_future_installments`, `generates_replacement_forecast` existem como flags, mas não materializam lançamentos no `cashflow_entries`. Sistemas/Telecom mensais não viram OPEX previsto.
2. **Depreciação estática** — calcula valor contábil mas não gera cronograma mensal nem aparece na DRE/EBITDA.
3. **Ciclo de vida incompleto** — não há histórico de movimentação (entrega, devolução, transferência entre colaboradores), nem termos assinados.
4. **Chamados sem SLA real** — campos existem, mas sem cálculo de breach, escalonamento, métricas MTTR/MTTA.
5. **Sem alertas proativos** — renovações, garantias vencendo, equipamentos obsoletos não notificam.
6. **Sem auditoria** — alterações sensíveis (status, responsável, baixa) não geram log.
7. **KPIs sem drill-down** — cards do dashboard não abrem base de cálculo (princípio do produto exige).
8. **Faltam visões executivas** — TCO por colaborador, custo por departamento, idade média do parque, % obsolescência.

---

## Plano de evolução (5 fases)

### Fase 1 — Integração Financeira Real (núcleo do produto)

**Objetivo:** TI deixa de ser cadastro isolado e passa a alimentar o Financeiro automaticamente, seguindo o princípio MECE.

1. **Sistemas/Telecom recorrentes → Cashflow projetado**
   - Trigger DB `it_materialize_recurring_costs(org_id, ref_month)` que, para cada sistema/link `ativo` com `monthly_value > 0`, gera `cashflow_entries` virtuais (`source='ti'`, `source_ref='it_system:<id>:YYYY-MM'`, `tipo='pagar'`, `status='previsto'`).
   - Idempotente via UNIQUE em `(source, source_ref)`.
   - Recalcula automaticamente quando `monthly_value`, `status`, `renewal_date` ou `cost_center_id` mudam.
   - Conecta a `account_id` (plano de contas) e `cost_center_id` configurados no item.

2. **Equipamentos parcelados → Parcelas futuras**
   - Quando `acquisition_form='compra_parcelada'` + `installments_count` + `installment_value` + `first_installment_date`, gera N entradas em `cashflow_entries` (uma por parcela), referenciando `it_equipment.id`.
   - Suporta antecipação/baixa: ao mudar status para `baixado/vendido`, cancela parcelas futuras (mantém histórico).

3. **Previsão de substituição → CAPEX projetado**
   - Equipamentos com `generates_replacement_forecast=true` + `replacement_forecast_date` + `replacement_estimated_value` geram entrada de CAPEX no mês previsto.
   - Aparece no módulo Planejamento como item editável.

4. **Depreciação mensal → DRE**
   - Nova tabela `it_depreciation_schedule` (equipment_id, competencia, valor_mensal_contabil, valor_mensal_economico, acumulado).
   - RPC `it_generate_depreciation_schedule(equipment_id)` gera o cronograma completo a partir dos parâmetros.
   - Integra com DRE como linha de despesa não-caixa.

### Fase 2 — Ciclo de Vida & Movimentação

5. **Tabela `it_equipment_movements`**
   - Tipos: `entrega`, `devolucao`, `transferencia`, `manutencao_envio`, `manutencao_retorno`, `baixa`, `venda`, `extravio`.
   - Cada movimento: data, de_colaborador, para_colaborador, de_local, para_local, motivo, anexo (termo PDF), assinatura digital.
   - Ao registrar movimento, atualiza `it_equipment.responsible_employee_id` e `status` automaticamente.
   - Linha do tempo visual no detalhe do equipamento.

6. **Geração de termos PDF**
   - Edge Function `it-generate-term` cria PDF de Entrega/Devolução com dados do colaborador (nome, CPF, cargo), equipamento, condições, assinaturas.
   - Salvo em Storage `it-documents/<org_id>/<equipment_id>/<movement_id>.pdf`.

7. **QR Code funcional**
   - QR aponta para rota pública assinada `/ti/equipamento/<token>` (token JWT curto) com ficha read-only do ativo.
   - Útil para auditoria física, conferência de inventário.

### Fase 3 — Chamados como Service Desk real

8. **SLA automático**
   - Tabela `it_sla_policies` (categoria + prioridade → tempo_resposta, tempo_resolucao em horas úteis).
   - Trigger calcula `sla_response_due`, `sla_resolution_due` no insert.
   - Campos derivados: `sla_response_breach`, `sla_resolution_breach`, `mtta`, `mttr`.

9. **Workflow de status**
   - Ações: assumir, transferir, pausar (com motivo), reabrir, resolver com causa raiz.
   - Histórico em `it_ticket_events` (audit trail).

10. **Comentários & anexos no chamado**
    - Tabela `it_ticket_comments` com menções, visibilidade interna/cliente.
    - Notificações em tempo real via Realtime + integração com módulo Notifications existente.

11. **Métricas Service Desk**
    - MTTA, MTTR, % SLA atingido, top categorias, top solicitantes, backlog por idade.

### Fase 4 — Inteligência & Alertas

12. **Maturidade TI (sector_onboarding)**
    - Adicionar setor `ti` ao avaliador de maturidade existente (50% completeness, 25% freshness, 25% qualidade).
    - Indicadores: % equipamentos com responsável, % com depreciação preenchida, % sistemas com renovação cadastrada, MTTR médio.

13. **Alertas proativos** (cron diário via edge function)
    - Renovações em 30/60/90 dias.
    - Garantias vencendo.
    - Equipamentos com idade > vida útil econômica.
    - Chamados em risco de SLA breach.
    - Sinistros não tratados há > 7 dias.
    - Notificações via tabela `notifications` + e-mail opcional.

14. **Sugestões via Lovable AI** (`google/gemini-2.5-flash`)
    - "Plano de substituição sugerido para próximos 12 meses" baseado em idade + criticidade + budget.
    - "Sistemas redundantes detectados" (mesma categoria, baixa utilização).
    - "Anomalia de custo": sistemas/links com aumento > 20% mês a mês.

### Fase 5 — Governança, KPIs e Drill-down

15. **KPIs clicáveis com base de cálculo** (alinhado ao padrão financeiro do produto)
    - Cada card do `TIDashboard` abre Dialog com:
      - Fórmula aplicada
      - Lista de itens que compuseram o número (auditável)
      - Filtros temporais
      - Export CSV
    - Reusa o componente `KpiBreakdownDialog` (a criar/aproveitar do Financeiro).

16. **Visões executivas**
    - **TCO por colaborador**: equipamentos + sistemas atribuídos + rateio de telecom.
    - **Custo TI por Centro de Custo**: visão para DRE gerencial.
    - **Idade média do parque** por tipo de equipamento.
    - **% obsolescência** (equipamentos em `substituicao_recomendada` ou `obsoleto` / total).
    - **Heatmap de criticidade** (sistemas críticos sem redundância, links sem backup).

17. **Auditoria (`it_audit_log`)**
    - Trigger genérico para log de mudanças em equipment, system, telecom, ticket, incident.
    - Captura before/after, user, timestamp.
    - Visível em Configurações para owner/admin.

18. **Permissões granulares por aba**
    - Reusa `useUserPermissions` + `MODULE_DEFINITIONS` (padrão do projeto).
    - Permite "TI Operacional" (vê tudo exceto Depreciação) vs "TI + Financeiro" (vê tudo).

---

## Mudanças técnicas resumidas

```text
Banco (migration):
  + it_depreciation_schedule
  + it_equipment_movements
  + it_ticket_comments
  + it_ticket_events
  + it_sla_policies
  + it_audit_log
  + RPCs: it_materialize_recurring_costs, it_generate_depreciation_schedule,
          it_register_movement, it_compute_sla
  + Trigger genérico de auditoria
  + Trigger pós-update em it_systems/it_telecom para regerar projeções

Edge Functions:
  + it-generate-term (PDF termos)
  + it-daily-alerts (cron diário)
  + it-ai-insights (sugestões IA)

Front-end:
  + src/hooks/useITMovements.ts
  + src/hooks/useITSchedule.ts
  + src/hooks/useITSLA.ts
  + src/hooks/useITInsights.ts
  + src/components/ti/EquipmentTimeline.tsx
  + src/components/ti/MovementDialog.tsx
  + src/components/ti/TicketDetailDrawer.tsx (workflow + comentários + SLA)
  + src/components/ti/KpiBreakdownDialog.tsx
  + src/components/ti/TCOReport.tsx
  + src/components/ti/ITMaturityCard.tsx
  + Atualiza TIDashboard (cards clicáveis) e TIConfigTab (SLA, alertas)
  + Sidebar de notificações TI
```

## Princípios respeitados

- **MECE financeiro**: cada lançamento gerado pelo TI tem `source` + `source_ref` únicos; nunca duplica com Contratos/RH.
- **Auditável**: tudo que afeta caixa pode ser rastreado até o item de origem.
- **Reproducível**: KPIs com drill-down mostram a base de cálculo.
- **CFO-first**: visões executivas (TCO, % obsolescência, CAPEX projetado) priorizadas sobre operacional.
- **Sem mágica**: cálculos visíveis, projeções com `proj-`-style virtual entries materializáveis.

## Fora de escopo (V2 futura)

- Integração com MDM (Intune/JAMF) para inventário automático.
- Discovery de rede (descobrir ativos automaticamente).
- Integração com Service Desk externos (Jira, Zendesk).
- Compliance LGPD/ISO27001 detalhado (apenas estrutura básica nesta fase).

---

Posso iniciar pela **Fase 1 (integração financeira real)**, que entrega o maior valor imediato e conecta o módulo ao restante do produto. Aprovas seguir nesta ordem ou queres priorizar outra fase primeiro?
