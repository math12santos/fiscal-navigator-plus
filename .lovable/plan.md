
# Modulo CRM -- Comercial Integrado ao Cockpit Financeiro

## Resumo

Criar o modulo CRM conforme especificado no documento, com 3 frentes: Gestao de Carteira, Pipeline Comercial (Kanban) e Inteligencia Comercial. O modulo sera integrado ao ecossistema existente (Contratos, Fluxo de Caixa, Planejamento) e seguira o padrao de permissoes multi-tenant da plataforma.

Devido ao tamanho do modulo, a implementacao sera dividida em etapas dentro desta mesma entrega.

---

## Etapa 1 -- Banco de Dados (Migration)

### Novas tabelas

**1. `crm_clients`** -- Carteira de clientes CRM
- `id` UUID PK
- `organization_id` UUID (FK organizations, multi-tenant)
- `user_id` UUID (criador)
- `entity_id` UUID nullable (FK entities -- vinculo com cadastro existente)
- `name` TEXT NOT NULL
- `document_number` TEXT nullable (CNPJ/CPF)
- `segment` TEXT nullable
- `responsible` TEXT nullable
- `status` TEXT DEFAULT 'prospect' (prospect, ativo, inativo, churn, em_risco)
- `origin` TEXT nullable (indicacao, inbound, outbound, parceiro, etc.)
- `score` INTEGER DEFAULT 0 (0-100)
- `health_score` INTEGER DEFAULT 50 (0-100)
- `engagement` TEXT DEFAULT 'medio' (baixo, medio, alto)
- `churn_risk` TEXT DEFAULT 'baixo' (baixo, medio, alto)
- `mrr` NUMERIC DEFAULT 0 (receita recorrente mensal)
- `estimated_margin` NUMERIC DEFAULT 0
- `last_contact_at` TIMESTAMPTZ nullable
- `next_action_at` TIMESTAMPTZ nullable
- `next_action_type` TEXT nullable
- `next_action_description` TEXT nullable
- `contract_start_date` DATE nullable
- `contract_renewal_date` DATE nullable
- `notes` TEXT nullable
- `tags` TEXT[] nullable
- `active` BOOLEAN DEFAULT true
- `created_at`, `updated_at` TIMESTAMPTZ

**2. `crm_activities`** -- Historico de atividades/contatos
- `id` UUID PK
- `organization_id` UUID
- `user_id` UUID
- `client_id` UUID FK crm_clients
- `type` TEXT (ligacao, reuniao, email, nota, tarefa, playbook)
- `description` TEXT
- `scheduled_at` TIMESTAMPTZ nullable
- `completed_at` TIMESTAMPTZ nullable
- `status` TEXT DEFAULT 'pendente' (pendente, concluida, cancelada)
- `created_at` TIMESTAMPTZ

**3. `crm_pipeline_stages`** -- Etapas do funil (configuravel por org)
- `id` UUID PK
- `organization_id` UUID
- `user_id` UUID
- `name` TEXT
- `order_index` INTEGER
- `probability` NUMERIC DEFAULT 0 (% probabilidade)
- `avg_days` INTEGER DEFAULT 0
- `color` TEXT DEFAULT '#6366f1'
- `is_won` BOOLEAN DEFAULT false
- `is_lost` BOOLEAN DEFAULT false
- `created_at` TIMESTAMPTZ

**4. `crm_opportunities`** -- Oportunidades no pipeline
- `id` UUID PK
- `organization_id` UUID
- `user_id` UUID
- `client_id` UUID FK crm_clients
- `stage_id` UUID FK crm_pipeline_stages
- `title` TEXT
- `estimated_value` NUMERIC DEFAULT 0
- `estimated_close_date` DATE nullable
- `contract_type` TEXT nullable (compra, venda, patrimonio)
- `recurrence` TEXT DEFAULT 'mensal' (unico, mensal, etc.)
- `responsible` TEXT nullable
- `notes` TEXT nullable
- `won_at` TIMESTAMPTZ nullable
- `lost_at` TIMESTAMPTZ nullable
- `lost_reason` TEXT nullable
- `contract_id` UUID nullable (FK contracts -- vinculo apos fechamento)
- `created_at`, `updated_at` TIMESTAMPTZ

### Seed de etapas padrao

Ao criar a tabela, inserir etapas padrao para cada org existente via trigger `seed_default_pipeline_stages` (ao criar nova org):
1. Lead Qualificado (10%)
2. Diagnostico (25%)
3. Proposta Enviada (50%)
4. Negociacao (75%)
5. Fechamento (100%, is_won=true)
6. Perdido (0%, is_lost=true)

### RLS Policies

Todas as tabelas seguirao o padrao existente:
- SELECT: `is_org_member(auth.uid(), organization_id)`
- INSERT: `auth.uid() = user_id AND is_org_member(auth.uid(), organization_id)`
- UPDATE: `is_org_member(auth.uid(), organization_id)`
- DELETE: `has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])`

### system_modules

Inserir registro `crm` na tabela `system_modules` para controle global.

---

## Etapa 2 -- Hooks de Dados

### `src/hooks/useCRM.ts`
Hook principal com:
- `useCRMClients()` -- CRUD de clientes CRM
- `useCRMActivities(clientId?)` -- CRUD de atividades
- `usePipelineStages()` -- CRUD de etapas do funil
- `useCRMOpportunities(stageId?, clientId?)` -- CRUD de oportunidades
- `useMoveOpportunity()` -- Mutation para mover oportunidade entre etapas (drag-and-drop)
- `useCloseOpportunity()` -- Mutation para fechar oportunidade (gera contrato automaticamente)

### `src/hooks/useCRMIntelligence.ts`
Hook de indicadores calculados:
- Receita em pipeline (soma de estimated_value)
- Receita ponderada (valor x probabilidade da etapa)
- Conversao por etapa
- Ciclo medio de vendas (dias entre criacao e won_at)
- Forecast mensal (baseado em estimated_close_date e probabilidade)

---

## Etapa 3 -- Interface do Modulo

### Pagina principal: `src/pages/CRM.tsx`
Organizada em 3 abas (Tabs):

**Aba 1: Carteira**
- Tabela com todas as colunas estrategicas do documento
- Busca global, filtros por status/responsavel/segmento/origem/score/churn_risk
- Filtros de ativacao (sem contato ha X dias, proxima acao vencida, etc.)
- Acoes em massa (alterar responsavel, status)
- Destaque visual para "Carteira para Ativar" (proxima acao vazia/vencida, ultimo contato antigo, health score baixo)
- Sub-visualizacoes: Clientes em Risco, Renovacoes Proximas, Oportunidades de Expansao
- Dialog de detalhes do cliente com historico de atividades

**Aba 2: Pipeline**
- Kanban com drag-and-drop entre etapas
- Cards mostrando: cliente, valor, data estimada, responsavel
- Totalizador por coluna (quantidade e valor)
- Ao mover para etapa "Fechamento" (is_won), abre dialog para gerar contrato automatico
- Ao mover para "Perdido" (is_lost), solicita motivo

**Aba 3: Indicadores**
- KPI cards: Receita Pipeline, Receita Ponderada, Conversao Geral, Ciclo Medio
- Grafico de funil (conversao por etapa)
- CAC por origem (se houver dados)
- LTV estimado (MRR medio x duracao media)
- LTV/CAC

### Componentes auxiliares
- `src/components/crm/CRMClientTable.tsx` -- Tabela da carteira
- `src/components/crm/CRMClientDialog.tsx` -- Formulario de cliente
- `src/components/crm/CRMPipeline.tsx` -- Kanban visual
- `src/components/crm/CRMOpportunityDialog.tsx` -- Formulario de oportunidade
- `src/components/crm/CRMActivityTimeline.tsx` -- Timeline de atividades
- `src/components/crm/CRMIndicators.tsx` -- Dashboard de indicadores
- `src/components/crm/CRMClientDetail.tsx` -- Painel lateral de detalhes

---

## Etapa 4 -- Integracoes com Modulos Existentes

### CRM para Contratos
- Quando oportunidade eh marcada como "Fechada" (is_won), o sistema oferece criar um contrato automaticamente usando o hook `useContracts.create`
- O contrato herda: entity_id (do cliente CRM), valor, tipo de recorrencia
- O `contract_id` gerado eh salvo na oportunidade para rastreabilidade

### CRM para Fluxo de Caixa
- Oportunidades com probabilidade alta alimentam projecoes virtuais no fluxo de caixa (similar ao padrao de `source: "dp"`)
- Nova source `"crm"` com ID prefixado `proj-crm-` no `useCashFlow.ts`

### CRM para Dashboard
- Adicionar card "Pipeline CRM" no Dashboard com receita ponderada
- Adicionar alerta "Oportunidades sem acao" nos alertas inteligentes

### CRM para Entidades
- Ao criar um cliente CRM, opcao de vincular a uma entidade existente (`entity_id`) ou criar nova
- Se vinculado, dados de contato sao herdados

---

## Etapa 5 -- Roteamento e Permissoes

### Rotas
- Adicionar rota `/crm` no `App.tsx` com `ModuleMaintenanceGuard moduleKey="crm"`
- Adicionar item de navegacao no `AppLayout.tsx` com icone `Handshake` do lucide

### Permissoes
- O modulo segue o padrao de `canAccessModule("crm")` e `canAccessTab("crm", "carteira|pipeline|indicadores")`
- A visibilidade do item no menu lateral sera filtrada pelo sistema de permissoes existente

---

## Detalhes Tecnicos

### Arquivos a criar
- `src/pages/CRM.tsx`
- `src/hooks/useCRM.ts`
- `src/hooks/useCRMIntelligence.ts`
- `src/components/crm/CRMClientTable.tsx`
- `src/components/crm/CRMClientDialog.tsx`
- `src/components/crm/CRMPipeline.tsx`
- `src/components/crm/CRMOpportunityDialog.tsx`
- `src/components/crm/CRMActivityTimeline.tsx`
- `src/components/crm/CRMIndicators.tsx`
- `src/components/crm/CRMClientDetail.tsx`
- Migration SQL

### Arquivos a modificar
- `src/App.tsx` -- nova rota /crm
- `src/components/AppLayout.tsx` -- item de nav "CRM"
- `src/hooks/useCashFlow.ts` -- projecoes de oportunidades CRM
- `src/hooks/useFinancialSummary.ts` -- incluir dados de pipeline
- `src/pages/Dashboard.tsx` -- card de pipeline CRM

### Sem dependencias externas novas
O Kanban sera implementado com drag-and-drop nativo (HTML5 Drag API) para evitar adicionar bibliotecas. Alternativa: usar o padrao de clique para mover entre colunas se drag nao for pratico.
