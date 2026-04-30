---
name: SaaS Billing Foundation
description: Tabelas e UI de planos, assinaturas, faturas e inadimplência no Backoffice (Fase 1)
type: feature
---
**Tabelas (RLS: backoffice + admins da própria org leem o que é deles):**
- `billing_plans` (catálogo: code/name/price_monthly/yearly/trial_days/limits jsonb/modules jsonb). Seed: starter/growth/enterprise.
- `subscriptions` (1 por org, status trialing|active|past_due|canceled|paused, billing_cycle, custom_price, discount_pct, payment_method).
- `invoices` + `invoice_items` (status draft|open|paid|overdue|void; number único; PDF via `src/lib/invoicePdf.ts` com jspdf+autotable).
- `usage_metrics` (snapshot diário por org, base para health score futuro).
- `feature_flags` (scope global/org/plan, rollout_pct).
- `support_tickets` + `support_ticket_messages` (inbox).
- `platform_announcements` (banners com janela starts/ends + audience all/plan/org).
- `org_notes` (CRM-like, só backoffice).
- `organizations` ganhou `last_active_at` e `health_score`.

**UI:** `/backoffice/faturamento` → 4 abas (Assinaturas/Faturas/Inadimplência/Planos). Hook único `src/hooks/useBilling.ts` com `computeMRR()`, `generateInvoiceNumber()`. PDF reaproveita padrão do Cash Position (jspdf + jspdf-autotable, header teal #24D6C4).

**MRR formula:** soma `(custom_price ?? plan.price_monthly | yearly/12) * (1 - discount_pct/100)` para subs em `active|trialing`.

**Próximas fases (planejado em .lovable/plan.md):**
- Fase 2: Dashboard SaaS (KPIs MRR/ARR/churn, gráficos 12m, listas top/inativos/trials expirando) via RPC `get_saas_kpis`.
- Fase 3: Feature flags UI, anúncios, status page, suporte (tickets), impersonation log dedicado.
- Fase 4: Health score job diário, configurações reais (segurança, e-mails, branding, LGPD), Stripe/Paddle opcional.
