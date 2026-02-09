# FinCore — Base de Conhecimento do Projeto

---

## 1. Padrões Arquiteturais

### Multi-tenancy
- Toda tabela de dados usa `organization_id` (FK para `organizations`)
- Queries sempre filtram por `orgId` do contexto
- Unique constraints usam `(organization_id, campo)`, nunca `user_id`
- Insert sempre inclui `user_id: user!.id, organization_id: orgId`

### Template de Hook (`src/hooks/use[Entidade].ts`)
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

// queryKey: ["entidade", orgId]
// enabled: !!user && !!orgId
// Mutations: create, update, remove com invalidateQueries + toast
```

### Template de Página (`src/pages/[Nome].tsx`)
1. `PageHeader` (título + descrição) + botão de ação principal
2. KPI cards em `glass-card` (grid 3 colunas)
3. Filtros em `glass-card` (Select, Calendar, botão Limpar)
4. Tabela/lista em `glass-card` com empty state
5. `[Nome]FormDialog` separado em `src/components/`
6. `AlertDialog` para confirmação de exclusão

### Template de Formulário (`src/components/[Nome]FormDialog.tsx`)
- Props: `open`, `onOpenChange`, `onSubmit`, `initialData`, `loading`
- `useEffect` para resetar form quando `initialData` ou `open` mudam
- Campos com `Label` + `Input/Select/Calendar`

### Convenções Gerais
- **Rotas**: registradas em `src/App.tsx` dentro de `ProtectedRoutes`
- **Navegação**: item em `navItems` no `src/components/AppLayout.tsx`
- **Audit log**: operações críticas usam `useAuditLog`
- **Origem dos dados**: coluna `source` (manual/erp) + `external_ref`
- **UI**: tema escuro, `glass-card`, `animate-fade-in`, ícones lucide-react, formatação pt-BR
- **Formatação monetária**: `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`

---

## 2. Tabelas e Políticas RLS

### Funções auxiliares de segurança

| Função | Assinatura | Descrição |
|--------|-----------|-----------|
| `is_org_member` | `(p_user_id uuid, p_org_id uuid) → boolean` | Verifica se usuário é membro da org |
| `has_org_role` | `(p_user_id uuid, p_org_id uuid, p_roles text[]) → boolean` | Verifica role específica |
| `get_user_org_ids` | `(p_user_id uuid) → SETOF uuid` | Retorna org_ids do usuário |

Todas são `SECURITY DEFINER` com `search_path = 'public'`.

---

### profiles
| Coluna | Tipo |
|--------|------|
| id | uuid (PK, = auth.uid) |
| full_name | text |
| company_name | text |

**RLS:**
- SELECT: `auth.uid() = id`
- INSERT: `auth.uid() = id`
- UPDATE: `auth.uid() = id`
- DELETE: bloqueado

---

### organizations
| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| name | text |
| document_type | text (default 'CNPJ') |
| document_number | text |
| logo_url | text |
| created_by | uuid |

**RLS:**
- SELECT: `auth.uid() = created_by OR is_org_member(auth.uid(), id)`
- INSERT: `auth.uid() = created_by`
- UPDATE: `has_org_role(auth.uid(), id, ['owner','admin'])`
- DELETE: `has_org_role(auth.uid(), id, ['owner'])`

---

### organization_members
| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| organization_id | uuid (FK) |
| user_id | uuid |
| role | text (default 'member') |

**RLS:**
- SELECT: `is_org_member(auth.uid(), organization_id)`
- INSERT: `auth.uid() = user_id OR has_org_role(auth.uid(), organization_id, ['owner','admin'])`
- UPDATE: `has_org_role(auth.uid(), organization_id, ['owner','admin'])`
- DELETE: `auth.uid() = user_id OR has_org_role(auth.uid(), organization_id, ['owner'])`

---

### chart_of_accounts
| Coluna | Tipo | Nota |
|--------|------|------|
| id | uuid (PK) | |
| organization_id | uuid (FK) | |
| user_id | uuid | |
| code | text | UNIQUE(organization_id, code) |
| name, type, nature, accounting_class | text | |
| level | integer | |
| parent_id | uuid (FK self) | |
| is_synthetic, is_system_default, active | boolean | |
| tags | text[] | |

**RLS:**
- SELECT: `auth.uid() = user_id OR (org IS NOT NULL AND is_org_member(...))`
- INSERT: `auth.uid() = user_id AND (org IS NULL OR is_org_member(...))`
- UPDATE: `auth.uid() = user_id OR has_org_role(..., ['owner','admin','member'])`
- DELETE: `auth.uid() = user_id OR has_org_role(..., ['owner','admin'])`

---

### cost_centers
| Coluna | Tipo | Nota |
|--------|------|------|
| id | uuid (PK) | |
| organization_id | uuid (FK) | |
| user_id | uuid | |
| code | text | UNIQUE(organization_id, code) |
| name, description, responsible, business_unit | text | |
| parent_id | uuid (FK self) | |
| active | boolean | |

**RLS:** mesma estrutura de `chart_of_accounts`.

---

### contracts
| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| organization_id | uuid (FK) |
| user_id | uuid |
| nome, tipo | text |
| valor | numeric |
| vencimento | date |
| status | text (default 'Ativo') |
| source | text (default 'manual') |
| external_ref, notes | text |

**RLS:** mesma estrutura de `chart_of_accounts`.

---

### audit_log
| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| organization_id | uuid (FK) |
| user_id | uuid |
| entity_type, entity_id, action | text |
| old_data, new_data | jsonb |

**RLS:**
- SELECT: `auth.uid() = user_id OR (org IS NOT NULL AND is_org_member(...))`
- INSERT: `auth.uid() = user_id`
- UPDATE/DELETE: bloqueado

---

### plan_migrations
| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| organization_id | uuid (FK) |
| user_id | uuid |
| status | text (default 'DRAFT') |
| mapping_accounts, mapping_cost_centers | jsonb |
| notes | text |

**RLS:**
- SELECT: `auth.uid() = user_id OR (org IS NOT NULL AND is_org_member(...))`
- INSERT/UPDATE/DELETE: `auth.uid() = user_id`

---

## 3. Módulos Implementados

| Módulo | Status | Dados |
|--------|--------|-------|
| Auth | ✅ Completo | login/signup email, contexto de sessão |
| Organizações | ✅ Completo | CRUD, seletor sidebar, membership com roles |
| Dashboard | ⚠️ Mock | KPIs + gráficos com dados mock |
| Fluxo de Caixa | ⚠️ Mock | visualização realizado/previsto mock |
| Contratos | ✅ CRUD básico | filtros, KPIs, banco real |
| Planejamento | ⚠️ Mock | cenários comparativos mock |
| Conciliação | ⚠️ Mock | lista de transações mock |
| Tarefas | ⚠️ Mock | lista com prioridade mock |
| Configurações | ✅ Completo | Plano de Contas + Centros de Custo (CRUD, hierarquia, seed) |
| Integrações | 🔲 Placeholder | — |
| IA Financeira | 🔲 Placeholder | — |

---

## 4. Especificação do Módulo de Contratos (Escopo Completo)

### 4.1 Recorrência Financeira
- Campos: `tipo_recorrencia` (mensal/bimestral/trimestral/semestral/anual/personalizado), `data_inicio`, `data_fim` (ou prazo indeterminado), `valor_base`, `valor_total` (calculado)
- Geração automática de lançamentos no fluxo de caixa previsto
- Vínculo contrato → lançamento
- Recálculo em alterações de valor/período
- Suspensão em pausa/cancelamento

### 4.2 Reajustes Automáticos
- Tipo de índice: IPCA, IGPM, INPC, percentual fixo, manual
- Periodicidade configurável
- Histórico de reajustes aplicados
- Simulação de impacto no fluxo de caixa

### 4.3 Alertas e Eventos
- Eventos: próximo ao vencimento, reajuste iminente, vencido, renovação automática/manual, sem movimentação
- Canais: dashboard, notificação interna, geração de tarefas

### 4.4 Integração com Fluxo de Caixa
- Lançamentos previstos automáticos a partir de contratos recorrentes
- Vínculo: contrato → lançamento previsto → lançamento realizado
- Comparação previsto × realizado
- Atualização automática em pausa/renegociação/cancelamento

### 4.5 Inteligência do Contrato
- Peso no custo total da organização
- Evolução do custo ao longo do tempo
- Ranking de pressão no caixa
- Concentração por fornecedor/tipo/centro de custo/unidade

### 4.6 Classificações Financeiras
- Natureza: fixo / variável / fixo+variável
- Impacto: custo / despesa / investimento
- Vínculo com centro de custo e unidade de negócio

### 4.7 Responsável e Governança
- Responsável interno e área
- SLA de revisão
- Histórico automático de ações (criação, edição, reajustes, pausas, cancelamentos)

### 4.8 Documentos e Histórico
- Upload de contrato e aditivos
- Versionamento de documentos
- Observações obrigatórias em alterações críticas

---

## 5. Próximo Módulo a Implementar

**Contratos — Seção 4.1: Recorrência Financeira**

Escopo:
- Novas colunas na tabela `contracts`: `tipo_recorrencia`, `data_inicio`, `data_fim`, `prazo_indeterminado`, `valor_base`
- Atualização do formulário e hook
- Lógica de cálculo de valor total baseado na recorrência
- Base para geração de lançamentos previstos (seção 4.4)
