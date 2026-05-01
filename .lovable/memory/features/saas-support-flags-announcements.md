---
name: SaaS Support Flags Announcements
description: BackOffice — fila de suporte (tickets+notas internas), feature flags com rollout %, e anúncios com banner no app
type: feature
---

# Fase 3 — Suporte, Feature Flags e Anúncios

## Suporte (`/backoffice/suporte`)
- `BackofficeSuporte.tsx` lista tickets de `support_tickets` (RLS já restringe a backoffice ou ao próprio `opened_by`).
- Mudança de status para `resolved`/`closed` preenche `resolved_at` automaticamente no hook `useUpdateTicket`.
- Mensagens via `support_ticket_messages`. Flag `is_internal=true` fica visível só para BackOffice (RLS).
- Cliente pode abrir ticket pelo hook `useCreateTicket` (`channel: 'in_app'`, `opened_by: auth.uid()`).

## Feature Flags (`/backoffice/produto` → Flags)
- Tabela `feature_flags` com `unique(flag_key, scope, organization_id, plan_id)`.
- `flag_key` é imutável após criação na UI (boa prática para evitar quebrar consumers).
- Resolução de flag para o cliente: criar hook `useFeatureFlag(key)` quando necessário — buscar primeiro escopo `org`, depois `plan` (via subscription), depois `global`. Aplicar `rollout_pct` por hash determinístico de user_id.

## Anúncios (`/backoffice/produto` → Anúncios)
- Tabela `platform_announcements`. Filtragem ativa client-side em `useActiveAnnouncements`:
  - `starts_at <= now` e (`ends_at` nulo ou `> now`)
  - `audience='all'` ou (`audience='org'` e `organization_id = current`). Filtro por plano fica para Fase 4 (precisa join com `subscriptions`).
  - Dispensa persistida em `localStorage['lovable.announcements.dismissed']` (array de IDs).
- `AnnouncementBanner` montado em `AppLayout` (entre header e conteúdo).

## Quando estender
- Realtime: registrar `support_tickets` e `support_ticket_messages` em `useRealtimeSync` para refletir respostas instantaneamente.
- Edge function `notify-support-ticket` para enviar email/Slack ao BackOffice em ticket urgente.
- Feature flags com `value: jsonb` permitem variantes A/B (não só on/off).
