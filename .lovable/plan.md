## Fase 4-5 — Módulo de TI: Alertas Proativos, TCO e Auditoria

Encerra a evolução do módulo transformando-o em uma central de governança de TI: o sistema avisa antes do problema, mostra o custo total real de cada ativo/sistema e mantém trilha auditável de tudo que muda.

---

### Fase 4 — Alertas Proativos (cron diário)

**Edge Function `it-daily-alerts`** (executada 1x/dia via `pg_cron` + `pg_net`):

1. **Renovações de sistemas/SaaS** — varre `it_systems` com `renewal_date` em até 30/15/7 dias e cria notificação para o `responsible_employee_id` (e CFO/Head de TI). Severidade escala conforme proximidade.
2. **SLA em risco** — busca `it_tickets` não resolvidos com `sla_resolution_due_at` nas próximas 4h ou já vencido (sem `sla_resolution_breach`) e notifica o `assignee_id` + gestor da fila.
3. **Garantias e ciclo de vida** — `it_equipment` com garantia/vida útil expirando em 60 dias (warning) ou expirada (critical) → notifica o responsável e abre item em "Ações Recomendadas".
4. **Telecom/links** — `it_telecom_links` com vencimento contratual ou SLA de uplink em risco.
5. **Custo fora da curva** — sistemas cujo `monthly_value` cresceu >20% vs. último mês materializado em `cashflow_entries` → alerta financeiro para CFO.

Idempotência: dedupe por `(user_id, reference_type, reference_id, dia)` no padrão já usado em `sector-maturity-alerts`. Retorna JSON com contadores por categoria.

**Agendamento:** cron diário às 07:00 (BRT) chamando a função via `net.http_post` (registrado via tool `insert`, não migration, pois usa anon key + URL).

---

### Fase 5 — TCO e Auditoria

**1. TCO (Total Cost of Ownership) consolidado**

Nova RPC `it_compute_tco(p_org, p_from, p_to)` que para cada `it_systems` e `it_equipment` retorna:
- Custo direto (mensalidades materializadas em `cashflow_entries` com `source='ti'`)
- Depreciação acumulada do período (de `it_depreciation_schedule`)
- Custo de incidentes/tickets ligados ao ativo (horas técnico × custo/hora configurável em `it_config`)
- Custo de movimentações (logística) registrado em `it_equipment_movements.cost`
- TCO total + TCO/usuário (usa `users_count` para sistemas; nº de responsáveis distintos para equipamentos)

Nova aba **"TCO"** no `TIDashboard.tsx`:
- Tabela ranqueada por TCO descendente (top 20 com filtros por categoria/cost center)
- Card com TCO consolidado do período + breakdown (sistemas vs equipamentos vs incidentes)
- Cada linha clicável abre `KpiBreakdownDialog` mostrando os componentes do TCO daquele ativo
- Botão "Exportar PDF" gera relatório executivo (jspdf + autotable, padrão já usado no projeto)

**2. Trilha de Auditoria completa**

Triggers `AFTER INSERT/UPDATE/DELETE` gravando em `it_audit_log` (já existe a tabela) para:
- `it_systems`, `it_equipment`, `it_telecom_links`, `it_tickets`, `it_sla_policies`, `it_equipment_movements`

Cada registro guarda: `actor_id` (auth.uid()), `action`, `entity`, `entity_id`, `before` (jsonb), `after` (jsonb), `diff` (jsonb com chaves alteradas), `created_at`.

Nova aba **"Auditoria"** em `TIConfigTab.tsx` (visível apenas para roles admin/master):
- Filtros: entidade, ator, intervalo de datas, ação
- Linha expansível mostra o diff em formato chave/antes/depois
- Paginação 50/pg, ordem desc
- Hook novo: `useITAuditLog(filters)`

**3. Centro de Notificações de TI no Dashboard**

Painel lateral em `TIDashboard.tsx` listando os alertas gerados pelo cron das últimas 30 dias, agrupados por severidade (critical/warning/info), com link para a entidade origem e botão "marcar como resolvido".

---

### Detalhes técnicos

**Migração SQL** (`..._it_phase45.sql`):
- Trigger `it_log_changes()` genérico parametrizado (uma função, vários triggers)
- RPC `it_compute_tco(p_org uuid, p_from date, p_to date)` retornando `setof` com colunas: `entity_type`, `entity_id`, `name`, `direct_cost`, `depreciation`, `incident_cost`, `movement_cost`, `tco_total`, `tco_per_user`
- Coluna `cost` em `it_equipment_movements` (se ainda não existir) e `hours_spent` em `it_tickets`
- Índices em `it_audit_log(organization_id, entity, created_at desc)`

**Edge Function**:
- `supabase/functions/it-daily-alerts/index.ts` — segue padrão CORS + service role de `sector-maturity-alerts`
- Insere em `notifications` com `category='ti'` e `reference_type` apropriado (sistema/equipamento/ticket)

**Cron** (registrado via insert tool, não migration):
```sql
select cron.schedule(
  'it-daily-alerts',
  '0 10 * * *', -- 07:00 BRT
  $$ select net.http_post(
       url:='https://<ref>.supabase.co/functions/v1/it-daily-alerts',
       headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body:='{}'::jsonb
     ); $$
);
```

**Frontend**:
- `src/hooks/useITTCO.ts` — chama RPC e devolve `data` para tabela e cards
- `src/hooks/useITAuditLog.ts` — query paginada
- `src/components/ti/TCOTab.tsx` — nova aba
- `src/components/ti/AuditLogSection.tsx` — seção dentro de `TIConfigTab`
- `src/lib/itTCOReportPDF.ts` — exportação PDF executivo
- Atualiza `TIDashboard.tsx` com painel de alertas + nova aba TCO

---

### Arquivos previstos

Criados:
- `supabase/migrations/..._it_phase45.sql`
- `supabase/functions/it-daily-alerts/index.ts`
- `src/hooks/useITTCO.ts`, `useITAuditLog.ts`
- `src/components/ti/TCOTab.tsx`, `AuditLogSection.tsx`, `ITAlertsPanel.tsx`
- `src/lib/itTCOReportPDF.ts`

Editados:
- `src/components/ti/TIDashboard.tsx` (aba TCO + painel alertas)
- `src/components/ti/TIConfigTab.tsx` (seção auditoria)
- `src/integrations/supabase/types.ts` (auto)
- `.lovable/plan.md`

---

### Resultado esperado

Após esta fase, o módulo de TI entrega ao CFO/CIO:
- Visibilidade antecipada de renovações, SLAs em risco e custos crescentes
- Custo real (TCO) por sistema/equipamento, exportável para o board
- Trilha auditável de toda mudança estrutural ou operacional — pronto para due diligence/auditoria externa
