
# Módulo TI — Patrimônio Tech, Sistemas, Links, Chamados, Sinistros

Cockpit completo de TI integrado ao motor financeiro existente (cashflow_entries, contratos, planejamento). Tudo conversa com o "single source of truth" do FinCore: equipamentos viram CAPEX/parcelas, sistemas e links viram OPEX recorrente, sinistros geram impacto financeiro e depreciação alimenta visão patrimonial.

## Escopo entregue (MVP completo + governança)

### 1. Banco de dados (migration única)

Tabelas novas (todas com `organization_id`, RLS por org, `created_by`, `updated_at`):

```text
it_equipment              ← patrimônio tech (1 linha por ativo)
it_equipment_attachments  ← NF, termos, fotos, laudos, garantias
it_depreciation_params    ← preenchido pelo Financeiro (espelho TI→Fin)
it_systems                ← SaaS / ERP / CRM / etc.
it_telecom_links          ← internet, MPLS, telefonia, chips
it_tickets                ← chamados com SLA
it_ticket_events          ← timeline/interações
it_incidents              ← sinistros e indisponibilidades
it_config                 ← SLAs por prioridade, vidas úteis padrão, etiquetas
```

Enums: `it_equipment_type`, `it_equipment_status`, `it_acquisition_form`, `it_economic_status`, `it_system_category`, `it_billing_cycle`, `it_telecom_type`, `it_ticket_priority`, `it_ticket_status`, `it_ticket_category`, `it_incident_type`, `it_impact_level`, `it_incident_status`.

Trigger `it_generate_patrimonial_code` gera código sequencial por org (`TI-000001`) — código rígido, demais campos flexíveis. Trigger valida que `it_equipment.id` referenciado em `it_depreciation_params` pertence à mesma org.

### 2. Integração financeira (MECE — sem duplicar)

Padrão já consolidado no FinCore (`source` + `source_ref`):

| Origem TI | Vira em `cashflow_entries` | source / source_ref |
|---|---|---|
| Equipamento à vista | 1 lançamento CAPEX | `ti` / `equip:<id>` |
| Equipamento parcelado / leasing | N parcelas | `ti` / `equip:<id>:p<n>` |
| Substituição futura prevista | projeção CAPEX (`is_projected=true`) | `ti` / `equip:<id>:replace` |
| Sistema contratado recorrente | OPEX mensal recorrente | `ti` / `system:<id>:<yyyy-mm>` |
| Link/telecom recorrente | OPEX mensal recorrente | `ti` / `telecom:<id>:<yyyy-mm>` |
| Sinistro c/ impacto | despesa pontual + receita de seguro | `ti` / `incident:<id>` |

RPCs:
- `materialize_it_equipment(equipment_id)` — gera parcelas/CAPEX (idempotente, upsert por source_ref)
- `materialize_it_system(system_id, months_ahead)` — gera recorrências
- `materialize_it_telecom(link_id, months_ahead)` — gera recorrências
- `it_depreciation_monthly(equipment_id)` — calcula linha-reta (contábil + econômica)

### 3. Páginas e rota

Nova rota `/ti` registrada em `App.tsx`, no `MODULE_DEFINITIONS` (`key: "ti"`) e na sidebar (`AppLayout.tsx`) entre Cadastros e Tarefas. Skeleton dedicado.

`src/pages/TI.tsx` com tabs (Tabs URL-persistidas via `useUrlState`):

```text
Dashboard · Equipamentos · Sistemas · Links/Telecom · Chamados · Sinistros · Depreciação · Orçamento de TI · Configurações
```

### 4. Componentes

```text
src/components/ti/
  TIDashboard.tsx              KPIs + alertas + próximas renovações
  EquipmentTab.tsx             tabela + filtros + drawer
  EquipmentFormDialog.tsx      cadastro completo (campos do prompt)
  EquipmentQRDialog.tsx        gera QR code da etiqueta (qrcode lib)
  EquipmentAttachments.tsx     upload Storage (bucket isolado por org)
  DepreciationTab.tsx          espelho — só Financeiro edita
  DepreciationParamsDialog.tsx
  SystemsTab.tsx + SystemFormDialog.tsx + SystemBudgetLinkDialog.tsx
  TelecomTab.tsx + TelecomFormDialog.tsx + TelecomBudgetLinkDialog.tsx
  TicketsTab.tsx + TicketFormDialog.tsx + TicketDetailDrawer.tsx
  IncidentsTab.tsx + IncidentFormDialog.tsx + IncidentDetailDrawer.tsx
  TIBudgetTab.tsx              consolidado: CAPEX + recorrentes + projeções
  TIConfigTab.tsx              SLAs, vida útil padrão, categorias
```

### 5. Hooks

```text
src/hooks/useITEquipment.ts
src/hooks/useITSystems.ts
src/hooks/useITTelecom.ts
src/hooks/useITTickets.ts
src/hooks/useITIncidents.ts
src/hooks/useITDepreciation.ts
src/hooks/useITBudget.ts          agrega tudo p/ aba Orçamento de TI
src/hooks/useITDashboardKPIs.ts
```

### 6. Permissões e fluxos

- Reusa `useUserPermissions` + `MODULE_DEFINITIONS` (adicionar tabs do módulo TI).
- Perfis lógicos via tabs/abas: Gestor TI = full; Financeiro = só Depreciação + Orçamento; Gestor de Departamento = Equipamentos (read seu CC) + Chamados; Colaborador = Chamados + seus equipamentos; Diretoria = Dashboard + Relatórios.
- Fluxo TI→Financeiro: ao salvar equipamento, cria registro pendente em `it_depreciation_params` com flag `requires_finance_input=true` e dispara notificação (tabela `notifications` existente) para usuários com permissão financeiro.

### 7. Storage

Reusa o bucket org-isolado existente. Pasta `ti/<equipment_id>/` para anexos do patrimônio. Signed URLs respeitando padrão já validado (memória `storage-isolation`).

### 8. Alertas automáticos

Edge Function agendada `ti-daily-alerts` (cron diário) que cria notifications para:
- Renovações de sistemas/links em 30/60/90 dias
- Equipamentos próximos do fim da vida útil econômica
- Chamados vencidos / críticos abertos
- Incidentes críticos sem tratativa
- Sistemas/links sem responsável / sem vínculo orçamentário

### 9. Relatórios

Hook `useITReports` + diálogo `TIExportDialog`: CSV (Excel-PT, BOM + `;`) e PDF (jspdf/autotable, padrão já usado em Cash Position) — inventário, depreciação, custos por CC/depto, chamados, incidentes.

### 10. Memória do projeto

Adicionar `mem://features/ti-patrimonio-tech` com regras:
- Código patrimonial sequencial por org (`TI-XXXXXX`), imutável
- Depreciação editada apenas por Financeiro (espelho)
- Padrão `source='ti'` + `source_ref` para idempotência MECE
- Materialização preserva edições manuais (`manually_edited=true` skip)

E atualizar `mem://index.md` referenciando.

## Detalhes técnicos relevantes

- **Linear depreciation MVP**: `mensal = (valor_aquisicao - residual) / vida_util_meses`. Status econômico calculado por % de vida consumida (>100% obsoleto, >85% substituição recomendada, >70% próximo, senão saudável).
- **Etiqueta QR**: lib `qrcode` (~30KB), gera SVG do código patrimonial; botão "Imprimir etiqueta" abre print-friendly com 1 ou 12 etiquetas por A4.
- **Idempotência**: todo `materialize_*` faz `upsert ... on conflict (organization_id, source, source_ref)` — re-rodar não duplica.
- **Filtros do dashboard**: empresa, depto, CC, responsável, tipo, status, período — via `useUrlState` para shareable URLs.
- **Sem CHECK constraints temporais** — usa triggers de validação (regra do projeto).
- **CORS edge**: whitelist via `ALLOWED_ORIGINS` (padrão do projeto).

## Diagrama de integração

```text
[Equipamento]──cria──▶[it_depreciation_params (pendente)]──notifica──▶[Financeiro]
      │                                                                     │
      │ materialize                                                         │ preenche
      ▼                                                                     ▼
[cashflow_entries source='ti']  ◀── depreciação mensal ── [it_depreciation_params]

[Sistema/Link]──vincular ao orçamento──▶[cashflow_entries recorrente]
[Sinistro]──impacto──▶[cashflow_entries source='ti' + recuperação seguro]
[Chamado c/ compra]──gera──▶[expense_request existente]
```

## Fora do escopo deste MVP (roadmap futuro)

- Métodos de depreciação não-lineares (Saldo Decrescente, Soma dos Dígitos)
- Integração com leitor de QR para conferência física em massa
- Workflow de aprovação multi-nível para CAPEX
- Sincronização automática com inventário de rede (SNMP/agentes)

Esses ficam documentados na memória `ti-patrimonio-tech` como evolução planejada.
