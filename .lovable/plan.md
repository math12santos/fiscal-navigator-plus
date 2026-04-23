

## Módulo de Distribuição de Relatórios — Telegram + Slack (Outbound only)

Vou criar o **Outbound Reports Hub**: um módulo de envio agendado/sob-evento de relatórios financeiros para Telegram e Slack, com auditoria completa, escalonamento e permissões por cargo. Seguindo sua decisão, o bot **só envia** — não responde a comandos, eliminando o vetor de cross-tenant leakage.

### Decisão arquitetural: Backoffice ou App?

**Recomendo: híbrido com peso no app do tenant**, e não no Backoffice puro:

| Camada | Onde mora | Por quê |
|---|---|---|
| Cadastro de canais (chat IDs Telegram, channels Slack) | **App do tenant** | Cada empresa tem sua bot/canais; consultoria não deve operar isso |
| Mapeamento destinatários × cargo × relatório | **App do tenant** | Quem é "diretor" da Empresa X só o tenant define |
| Templates de relatório, agendamento global, monitoramento de falhas, kill-switch | **Backoffice** | Consultoria mantém os templates padrão e socorre tenants |
| Auditoria e métricas de engajamento | **Ambos** (tenant vê só a sua; Backoffice vê tudo) | Privacidade |

Isso evita a armadilha de a consultoria "esquecer" um destinatário ativo de um cliente que saiu, e mantém a responsabilidade de "para quem vai" dentro da fronteira do tenant — coerente com a hierarquia de permissões já estabelecida.

---

### Camada 1 — Gerador de Relatórios (`report-generator` edge function)

Serviço interno reutilizável, recebe `{ report_type, organization_id, period }` e retorna `{ json, pdf_url, signed_link }`.

**6 tipos priorizados:**

| Código | Disparo | Conteúdo |
|---|---|---|
| `daily_cash_summary` | Manual após validação de saldo | Saldo inicial, entradas D-1, contas pagas D-1, vencidas, a vencer 7d, alerta se saldo < mínimo |
| `weekly_executive` | Cron seg 7h | Caixa consolidado (holding), empresas sob pressão (saldo/burn < 30d), top 5 desvios orçado×real, contratos críticos (vencendo 60d) |
| `exception_alerts` | Trigger event-driven | Saldo < mínimo, despesas sem classificação > 5, conciliação pendente > 7d, contratos vencendo 30d |
| `monthly_closing` | Cron 1º dia útil | DRE gerencial, fluxo previsto 90d, aging list, posição bancária consolidada |
| `weekly_aging` | Cron sex 16h | Aging list AP/AR com top 10 críticos por bucket |
| `daily_treasury` | Cron 8h | Posição bancária por conta + uso de cheque especial |

PDFs gerados via `pdfmake` (já no projeto via `usePlanningPdfReport`) e armazenados no bucket **`reports`** (novo, privado, RLS por org). Signed URLs com **TTL 48h**.

### Camada 2 — Motor de Notificações (`report-dispatcher` edge function)

Agendado via `pg_cron` (2-min poll). Lê `report_schedules`, identifica relatórios pendentes, chama Camada 1, depois consulta `report_recipients` para resolver destinatários por **regra**:

- **Por cargo**: `roles[]` ∈ {diretoria, financeiro, gestor, sócio, controller}
- **Por usuário direto**: `user_ids[]`
- **Por canal Slack/Telegram chat_id** explícito

Suporta **mascaramento parcial** (`mask_values: true`) — substitui valores absolutos por bandas (R$ 100k–500k) para destinatários sem permissão `view_absolute_values`.

### Camada 3 — Adaptadores

**Telegram** (`telegram-sender` edge function via gateway, conforme padrão Lovable):
- `sendMessage` (texto + Markdown), `sendDocument` (PDF), `sendPhoto` (charts opcionais)
- Botões inline para feedback: 👍 Útil / 👎 Não útil / 💬 Comentar
- Webhook `telegram-feedback` recebe **somente callbacks dos botões inline** (não comandos), validados por `update.callback_query.message.message_id` ∈ tabela `report_deliveries` — bloqueio total a interações fora do escopo do relatório enviado

**Slack** (estende `slack-proxy`):
- `chat.postMessage` com Block Kit + `files.uploadV2` para PDF
- Botões interativos com mesmo modelo de feedback

### Camada 4 — Auditoria

Tabela `report_deliveries`: `id`, `report_id`, `recipient_user_id`, `channel` (telegram/slack), `chat_id` (mascarado nos logs), `organization_id`, `sent_at`, `status` (pending/sent/failed/read), `delivery_attempt`, `error`, `signed_link_token`, `link_opened_at`, `feedback_score`, `feedback_comment`.

Página **`/relatorios/distribuicao`** (módulo `relatorios-out`) com:
- KPIs: enviados 7d, taxa de entrega, taxa de abertura, NPS médio dos relatórios
- Timeline por destinatário, filtro por relatório/canal
- Re-envio manual de falhas

### Escalonamento

Tabela `escalation_policies` por tipo de relatório com `severity_threshold` (ex: saldo < 0). Quando exceção crítica e destinatário primário não confirma leitura em N minutos, escalona automaticamente: coordenador → gerente → diretoria. Cada escalonamento gera nova linha em `report_deliveries` com `escalated_from`.

### Pontos críticos tratados

| Risco | Mitigação |
|---|---|
| Dado de empresa A para chat de empresa B | Tabela `org_chat_bindings` com FK `(organization_id, chat_id)` UNIQUE; dispatcher valida `org_id == binding.org_id` antes de qualquer envio |
| Link autenticado vazando | Token único + assinado HMAC com `org_id`, TTL 48h, revogável; auditoria de cada `link_opened` |
| Mascaramento de valores | Flag por `recipient_role`; renderização diferente no PDF e na mensagem |
| Falha de envio | Retry exponencial 3x; após falha total, notificação interna ao admin do tenant + status `failed` na UI |
| Permissão por cargo | Reuso do `MODULE_DEFINITIONS` — adiciona módulo `relatorios-out` com tabs `canais`, `destinatarios`, `agendamento`, `historico`, `templates` |
| Bot recebendo comandos não solicitados | **Webhook descarta tudo que não for `callback_query` de um `message_id` registrado em `report_deliveries`** |

### Estrutura técnica

**Migrations (schema-only):**
- `report_templates` (id, code, name, description, default_schedule_cron, default_payload_schema, default_pdf_template, active) — global, gerida no Backoffice
- `report_schedules` (id, organization_id, template_code, cron, enabled, next_run_at, last_run_at, mask_values, severity_threshold)
- `report_recipients` (id, schedule_id, user_id?, role?, chat_binding_id?, mask_values_override)
- `org_chat_bindings` (id, organization_id, channel telegram|slack, chat_id, label, active, created_by)
- `report_runs` (id, schedule_id, organization_id, generated_at, payload jsonb, pdf_path, signed_token, expires_at, status)
- `report_deliveries` (campos da Camada 4)
- `escalation_policies` (id, template_code, organization_id, levels jsonb)
- Bucket `reports` (privado, RLS por `organization_id` no path prefix — padrão já documentado)

**Edge Functions novas:**
- `report-generator` — Camada 1 (gera JSON+PDF, salva em storage, retorna signed URL)
- `report-dispatcher` — Camada 2 (cron-driven; resolve destinatários e dispara adaptadores)
- `telegram-sender` — Camada 3 Telegram (via connector gateway)
- `telegram-feedback` — webhook restrito a callback_query de mensagens conhecidas
- `slack-report-sender` — Camada 3 Slack (estende padrão do `slack-proxy`)
- `report-link` — serve PDF a partir de signed token, registra `link_opened_at`

**Conector Telegram:** será conectado via `standard_connectors--connect` com `connector_id="telegram"` (gateway-enabled).

**Frontend (módulo novo `relatorios-out`):**
- `/relatorios/distribuicao` (Dashboard + Histórico)
- `/relatorios/distribuicao/canais` (cadastro de chat IDs Telegram + canais Slack, com teste de envio)
- `/relatorios/distribuicao/destinatarios` (matriz: relatório × cargo × pessoa)
- `/relatorios/distribuicao/agendamento` (cron por template, ativar/desativar, testar agora)
- Backoffice: nova rota `/backoffice/relatorios` (templates globais, kill-switch, monitor de falhas cross-tenant)

**Permissões:** módulo `relatorios-out` com tabs acima registrado em `MODULE_DEFINITIONS` e propagado via migration. Apenas `owner`/`admin` veem `canais` e `agendamento`; `controller`/`gestor` veem `destinatarios` e `historico`.

### Fora de escopo nesta fase
- Bot respondendo a comandos sob demanda (você pediu para não fazer agora — concordo)
- Geração de planilhas Excel via Telegram (envio só PDF + texto formatado; Excel fica como link no signed URL)
- Slack interactivity webhook (ficará para fase 2; nesta fase, Slack só recebe; feedback inicial vem do Telegram via callback_query)

### Arquivos afetados (resumo)

- Migrations novas: tabelas listadas acima + bucket `reports` + módulo em `system_modules` + propagação de permissões
- `src/data/moduleDefinitions.ts` — entrada `relatorios-out` com 4 abas
- `src/App.tsx` + `src/components/AppLayout.tsx` — nova rota e item de sidebar (ícone `Send`)
- `src/components/BackofficeLayout.tsx` — item "Relatórios" no Backoffice
- `src/pages/RelatoriosDistribuicao.tsx` (novo) + 3 sub-páginas
- `src/pages/BackofficeReports.tsx` (novo)
- `src/hooks/useReportSchedules.ts`, `useReportRecipients.ts`, `useChatBindings.ts`, `useReportDeliveries.ts` (novos)
- 6 edge functions novas listadas acima
- `supabase/config.toml` — bloco para `telegram-feedback` (verify_jwt = false, é webhook)

### Pré-requisito
Antes de implementar, será necessário **conectar o connector Telegram** (você será solicitado quando entrarmos no modo default). Slack já está conectado.

