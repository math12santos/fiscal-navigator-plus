
# Evolução do BackOffice — Análise + Plano

## 1. Diagnóstico do que existe hoje

O BackOffice atual cobre o básico, mas está **operacional, não estratégico**:

| Área | Situação |
|---|---|
| Empresas | Lista, cria, exclui, "Acessar como" (impersonation) — funcional, mas sem indicadores de saúde, MRR, uso |
| Usuários | CRUD + multi-org membership + permissions BO — bom |
| Sistema (módulos) | Liga/desliga módulos globalmente com mensagem de manutenção — bom |
| Auditoria | Audit log + eventos de segurança — bom |
| Onboarding | Acompanhamento + maturidade setorial + config — bom |
| **Configurações** | **Vazio (3 cards "em breve")** |
| **Billing / Cobrança** | **Inexistente**. `organizations.plano` é texto livre, sem preço, ciclo, fatura, limite, trial, churn |
| **Gestão do SaaS** | Inexistente: sem health score, sem feature flags, sem comunicações, sem suporte, sem métricas de produto |

`organizations` tem só: `id, name, doc, logo, status, plano (text), onboarding_completed`. Sem `trial_ends_at`, `mrr`, `seats`, `last_active_at`, `health_score`.

---

## 2. Visão proposta — BackOffice como Cockpit do SaaS

Reorganizar a navegação em 4 grandes áreas, mantendo o que existe e adicionando 3 áreas novas:

```text
BackOffice
├── Visão Geral (NOVO)        → KPIs do SaaS: MRR, ARR, churn, ativos, trials, NRR
├── Empresas (existe)         + colunas de saúde, MRR, último acesso, plano real
├── Usuários (existe)
├── Faturamento (NOVO)        → Planos, assinaturas, faturas, cobrança, inadimplência
├── Produto (NOVO)            → Módulos + Feature Flags + Releases/Anúncios
├── Operação (renomear Sistema)
│   ├── Módulos globais (existe)
│   ├── Banner / Status Page
│   └── Jobs / Filas (Edge Functions, ETL)
├── Suporte (NOVO)            → Tickets, impersonation log, "ajuda solicitada"
├── Auditoria (existe)
├── Onboarding (existe)
└── Configurações (preencher) → Políticas globais, integrações master, branding
```

---

## 3. Plano de execução em 4 fases

### Fase 1 — Fundação de Billing (núcleo do que falta)

**Modelo de dados (migrations):**

- `billing_plans` — catálogo de planos do SaaS
  - `code, name, description, price_monthly, price_yearly, currency, trial_days, is_public, is_active, sort_order`
  - `limits jsonb` → `{ max_users, max_orgs_holding, max_employees, max_contracts, ai_credits_month, modules: ["dp","financeiro",...] }`
- `subscriptions` — assinatura por organização
  - `organization_id, plan_id, status (trialing|active|past_due|canceled|paused), billing_cycle (monthly|yearly), current_period_start/end, trial_ends_at, canceled_at, cancel_reason, seats, custom_price, discount_pct, payment_method (manual|pix|boleto|card|stripe), external_ref`
- `invoices` — faturas
  - `organization_id, subscription_id, number, period_start/end, issued_at, due_at, paid_at, amount, status (draft|open|paid|overdue|void), pdf_url, payment_link, notes`
- `invoice_items` — linhas (assinatura, add-ons, créditos AI, descontos)
- `usage_metrics` — snapshot diário por org (`users_count, employees_count, ai_credits_used, contracts_count, storage_mb`) → base para overage e health
- `feature_flags` — flags globais e por org (`key, scope: global|org, org_id?, enabled, rollout_pct, value jsonb`)
- `support_tickets` — tickets de suporte (`org_id, opened_by, subject, body, status, priority, assigned_to, channel`)
- `support_ticket_messages` — thread
- `platform_announcements` — banners/changelog (`title, body, severity, audience: all|plan|org, starts_at, ends_at, dismissible`)
- `impersonation_log` — quem-mestre acessou-qual-org-quando-por-quanto-tempo (já existe parcialmente em audit_log; criar view dedicada)

**Em `organizations` (ALTER):**
- `last_active_at timestamp` (atualizado por trigger leve no login)
- `health_score smallint` (calculado: ver Fase 4)

RLS: tudo restrito a master (BO) via `is_backoffice_master()`. `subscriptions` e `invoices` legíveis pelos `owner/admin` da própria org (para o cliente ver suas faturas dentro do app, futuramente).

**UI Fase 1:**
- Página **`/backoffice/faturamento`** com 4 abas:
  1. **Planos** — CRUD do catálogo (nome, preço, ciclo, limites, módulos inclusos, trial)
  2. **Assinaturas** — tabela por empresa: plano, status, MRR, próximo vencimento, dias de trial restantes, ações (alterar plano, pausar, cancelar, aplicar desconto, prorrogar trial)
  3. **Faturas** — emitir manualmente, marcar como paga, gerar PDF (jspdf), enviar link (e-mail futuro), lista por status (em aberto, vencidas, pagas)
  4. **Inadimplência** — empresas com fatura vencida, dias em atraso, ação rápida "suspender acesso"

### Fase 2 — Visão Geral / Dashboard do SaaS

Página **`/backoffice`** (renomear o atual "Empresas" para `/backoffice/empresas`) com cockpit executivo:

- **KPIs**: MRR, ARR, # clientes ativos, # em trial, # inadimplentes, churn 30d, NRR, ticket médio
- **Gráficos** (recharts):
  - MRR mensal últimos 12 meses (área)
  - Novos vs cancelados por mês (barra)
  - Distribuição por plano (pizza)
  - Cohort de retenção por mês de signup (heatmap simples)
- **Listas rápidas**: Top 5 maiores clientes (MRR), 5 mais inativos (sem acesso há X dias), 5 mais próximos do limite do plano, 5 trials expirando em ≤7 dias
- **Health alerts**: empresas com queda de uso, sem login há 14d, ou onboarding travado há 30d

Hook `useSaasMetrics` calculando tudo via RPC SQL `get_saas_kpis(period_start, period_end)` — agregação server-side (alinhada com a memória `server-side-aggregations`).

### Fase 3 — Produto, Operação e Suporte

**Produto:**
- **Feature Flags UI** (`/backoffice/produto/flags`): liga/desliga features experimentais por org ou rollout %, com histórico de mudanças
- **Releases / Anúncios** (`/backoffice/produto/anuncios`): cria banners no app dos clientes (alvo: todos, plano X, org Y), changelog público

**Operação (renomeia "Sistema"):**
- Mantém Módulos Globais
- **Status Page interna**: latência média das edge functions, % erro, fila ETL (`etl_jobs`), saúde do realtime — usar `supabase--analytics_query` / logs
- **Jobs**: lista de cron jobs / edge functions com último run, status, botão "rodar agora"

**Suporte:**
- **Tickets** (`/backoffice/suporte`): inbox de tickets vindos do cliente (botão "Pedir ajuda" no perfil do cliente envia tudo), responde inline, marca resolvido
- **Impersonation Log**: quem entrou em qual empresa, quando, por quanto tempo (compliance LGPD: "auditoria do master")
- **Notas internas** por empresa (CRM-like): "esta empresa está negociando upgrade", "implantação concluída em X" — tabela `org_notes`

### Fase 4 — Governança, Health Score e Configurações

**Health Score por empresa** (job diário):
- 100 pts = (uso ativo 30d) + (% módulos ativos usados) + (onboarding %) + (pagamento em dia) + (sem tickets críticos abertos)
- Cores: verde ≥80, amarelo 50-79, vermelho <50 — usado na lista de empresas e em alertas

**Configurações reais** (preenche a página vazia):
- **Segurança global**: política de senha mínima, 2FA obrigatório por plano, expiração de sessão, IP allowlist por org
- **E-mails transacionais**: templates editáveis (boas-vindas, fatura emitida, fatura vencida, trial expirando, suspensão)
- **Branding white-label**: logo padrão, cor primária default, e por org se plano permitir
- **Integrações master**: chaves globais (Lovable AI já automático), endpoints de webhook do SaaS (ex: notificar Slack interno em novo signup/cancelamento)
- **Política de retenção**: dias para soft-delete de orgs canceladas, dias para purgar audit_log antigo
- **LGPD**: gerador de relatório de dados pessoais por usuário/org, fluxo de "esquecer-me"

**Cobrança automatizada (futuro próximo, opcional):**
- Integração com **Stripe** (ou Pagar.me/Asaas para PIX/boleto BR) via Lovable Payments — sugerir após Fase 1 estar madura. Por enquanto: cobrança manual com PDF + link.

---

## 4. Detalhes técnicos relevantes

- **Stack**: segue padrão atual (React + TS, shadcn, React Query com `cachePresets`, Edge Functions para emissão de fatura/PDF, jspdf+autotable já em uso para Cash Position PDF — reaproveitar)
- **RLS**: novas tabelas restritas a master via `is_backoffice_master()`; `subscriptions/invoices` também legíveis pelos owners/admins da própria org
- **Realtime**: `subscriptions`, `invoices`, `support_tickets` entram no `useRealtimeSync` (memória `realtime-sync`)
- **Dependências**: nenhuma nova lib obrigatória na Fase 1 (jspdf já existe). Pagamento real depende de habilitar Stripe/Paddle depois
- **Memórias** a criar/atualizar: `features/saas-billing`, `features/saas-health-score`, `features/feature-flags-system`, `features/support-tickets`, atualizar `index.md`

---

## 5. O que entregar primeiro (recomendação)

Sugiro executar **Fase 1 inteira** (fundação de billing) na próxima rodada — é o maior buraco hoje e destrava tudo o mais (health score, dashboard SaaS, suspensão por inadimplência). Fases 2-4 podem vir em sequência, uma por vez.

Posso começar pela **Fase 1** assim que aprovar — ou, se preferir, executar primeiro só o **Dashboard do SaaS (Fase 2)** com dados mockados de plano/MRR para você validar a visão antes do esforço de billing.
