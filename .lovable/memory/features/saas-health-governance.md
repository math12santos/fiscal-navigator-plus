---
name: SaaS Health Score & Governance
description: Fase 4 BackOffice — health_score por org (5 fatores), platform_settings, email_templates editáveis, purga de audit_log, checklist LGPD
type: feature
---

# Fase 4 — Health Score, Governança e LGPD

## Health Score
- `compute_health_score(org_id)` (SECURITY DEFINER, GRANT authenticated) — 0-100 com 5 fatores ponderados:
  - **Pagamento (30)**: sem faturas vencidas → 30; até 2 → 15; >2 → 0
  - **Uso (25)**: `last_active_at` ≤7d → 25; ≤30d → 15; ≤90d → 5; null/antigo → 0
  - **Onboarding (20)**: `onboarding_completed=true` → 20
  - **Módulos (15)**: `15 × (active / total)` em `organization_modules`
  - **Suporte (10)**: 0 urgentes → 10; 1 → 5; >1 → 0
- `recompute_all_health_scores()` (batch BackOffice-only, persiste em `organizations.health_score`)
- `HealthScoreBadge` em `src/components/backoffice/HealthScoreBadge.tsx` — semáforo verde ≥80 / amarelo 50-79 / vermelho <50, exibido em cards e tabela do BackofficeDashboard

## platform_settings (key/value)
- Tabela genérica `(key text PK, value jsonb, description, updated_*)`. RLS BackOffice-only.
- Categorias por prefixo: `security.`, `retention.`, `webhooks.`, `lgpd.`
- Acessar via `usePlatformSettings()` / `useUpsertPlatformSetting()`. Para uma chave específica em outro lugar do código, fazer `find` no array — não criar hook por chave.

## email_templates
- 5 seeds (welcome, invoice_issued, invoice_overdue, trial_expiring, suspension). Variáveis em `variables: jsonb` (array de strings).
- Quando enviar e-mail real (Edge Function), usar `template_key` para buscar e fazer `{{var}}` replace.

## Manutenção
- `purge_old_audit_logs(_days)` — DELETE em `audit_log` mais antigo que N dias. BackOffice-only.

## LGPD pendente
- Edge Function `lgpd-export` para gerar ZIP/JSON de dados pessoais por user_id — ainda não implementada (listada na UI com badge ⏳).
