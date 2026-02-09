

# Modulo de Configuracoes Financeiras -- Plano Final Revisado

## Contexto

Este modulo cria a fundacao de classificacao financeira (Plano de Contas e Centros de Custo) que sera referenciada pelos modulos de Contratos, Fluxo de Caixa e Planejamento. O plano incorpora as sugestoes do usuario para aderencia ao canvas original, incluindo campos contabeis minimos e audit log opcional.

---

## Escopo: Fase 1 (Fundacao) + Fase 1.1 (Audit Log Opcional)

**Incluido nesta implementacao:**
- Plano de Contas hierarquico (4 niveis) com campos contabeis (natureza, classe contabil, transferencia)
- Centros de Custo hierarquicos com unidade de negocio e responsavel
- Pagina de Configuracoes com CRUD completo
- Navegacao atualizada
- (Fase 1.1) Audit log minimo para rastreabilidade

---

## 1. Banco de Dados

### 1.1 Tabela `chart_of_accounts`

| Coluna | Tipo | Default | Descricao |
|--------|------|---------|-----------|
| id | uuid PK | gen_random_uuid() | Identificador |
| user_id | uuid | -- | Dono do registro |
| code | text | -- | Codigo unico (ex: "3.1.01") |
| name | text | -- | Nome da conta |
| type | text | -- | receita, custo, despesa, investimento, transferencia |
| nature | text | 'neutro' | entrada, saida, neutro |
| accounting_class | text | 'resultado' | ativo, passivo, pl, resultado |
| level | integer | 1 | Nivel hierarquico (1-4) |
| parent_id | uuid (nullable) | null | Conta pai |
| description | text (nullable) | null | Descricao detalhada |
| tags | text[] (nullable) | null | Tags (fixo, variavel, etc.) |
| is_synthetic | boolean | false | Conta sintetica (nao recebe lancamentos) |
| is_system_default | boolean | false | Conta padrao do sistema (nao deletavel) |
| active | boolean | true | Status |
| created_at | timestamptz | now() | Criacao |
| updated_at | timestamptz | now() | Atualizacao |

**Constraints:**
- UNIQUE em (user_id, code)
- CHECK em `type`: receita, custo, despesa, investimento, transferencia
- CHECK em `nature`: entrada, saida, neutro
- CHECK em `accounting_class`: ativo, passivo, pl, resultado
- CHECK em `level`: 1-4

**Seguranca:** RLS com auth.uid() = user_id para SELECT, INSERT, UPDATE, DELETE
**Trigger:** update_updated_at_column

### 1.2 Tabela `cost_centers`

| Coluna | Tipo | Default | Descricao |
|--------|------|---------|-----------|
| id | uuid PK | gen_random_uuid() | Identificador |
| user_id | uuid | -- | Dono do registro |
| code | text | -- | Codigo unico (ex: "CC-001") |
| name | text | -- | Nome |
| parent_id | uuid (nullable) | null | Centro de custo pai |
| business_unit | text (nullable) | null | Unidade de negocio |
| responsible | text (nullable) | null | Responsavel |
| description | text (nullable) | null | Descricao |
| active | boolean | true | Status |
| created_at | timestamptz | now() | Criacao |
| updated_at | timestamptz | now() | Atualizacao |

**Constraints:** UNIQUE em (user_id, code)
**Seguranca:** RLS com auth.uid() = user_id para SELECT, INSERT, UPDATE, DELETE
**Trigger:** update_updated_at_column

### 1.3 Tabela `audit_log` (Fase 1.1)

| Coluna | Tipo | Default | Descricao |
|--------|------|---------|-----------|
| id | uuid PK | gen_random_uuid() | Identificador |
| user_id | uuid | -- | Usuario que executou a acao |
| entity_type | text | -- | chart_of_accounts ou cost_centers |
| entity_id | uuid | -- | Registro afetado |
| action | text | -- | INSERT, UPDATE, DELETE, ACTIVATE, DEACTIVATE |
| old_data | jsonb (nullable) | null | Snapshot anterior |
| new_data | jsonb (nullable) | null | Snapshot novo |
| created_at | timestamptz | now() | Data/hora |

**Seguranca:** RLS com auth.uid() = user_id (somente SELECT)
**Implementacao:** Via hooks no frontend na Fase 1.1. Migracao para triggers de banco na Fase 3.

---

## 2. Frontend -- Arquivos Novos e Alterados

### Novos arquivos

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/Configuracoes.tsx` | Pagina com 2 abas: Plano de Contas e Centros de Custo |
| `src/hooks/useChartOfAccounts.ts` | Hook CRUD para plano de contas (padrao useContracts) |
| `src/hooks/useCostCenters.ts` | Hook CRUD para centros de custo (padrao useContracts) |
| `src/hooks/useAuditLog.ts` | Hook para registrar e consultar logs (Fase 1.1) |
| `src/components/ChartOfAccountsFormDialog.tsx` | Dialog de criar/editar conta com campos: code, name, type, nature, accounting_class, parent_id, level, is_synthetic, tags, description |
| `src/components/CostCenterFormDialog.tsx` | Dialog de criar/editar centro de custo |
| `src/components/AccountTreeView.tsx` | Componente de arvore hierarquica com expand/collapse |

### Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/AppLayout.tsx` | Adicionar item "Configuracoes" com icone Settings no menu lateral |
| `src/App.tsx` | Adicionar rota `/configuracoes` apontando para Configuracoes.tsx |

---

## 3. Regras de Negocio

- **Codigo unico por usuario**: validacao no banco (UNIQUE constraint) + feedback visual no frontend
- **Contas sinteticas** (is_synthetic=true): nao recebem lancamentos e ficam ocultas de selecoes em formularios financeiros
- **Contas padrao** (is_system_default=true): nao podem ser excluidas, apenas desativadas
- **Inativacao**: nao remove dados, apenas oculta de novas selecoes
- **Hierarquia**: limitada a 4 niveis, com validacao contra loops
- **CHECK constraints**: validam valores permitidos para type, nature e accounting_class no banco
- **Audit log** (Fase 1.1): registra alteracoes estruturais via hooks

---

## 4. Interface do Usuario

### Aba Plano de Contas
- Visualizacao em arvore com indentacao por nivel e expand/collapse
- Filtros: por type (incluindo transferencia) e busca por nome/codigo
- Badges visuais para: type, nature, accounting_class, sintetica
- Toggle ativar/desativar
- Botoes: Criar Conta, Editar, Desativar

### Aba Centros de Custo
- Listagem em tabela
- Filtro por unidade de negocio e busca por nome/codigo
- Toggle ativar/desativar
- Botoes: Criar Centro, Editar, Desativar

---

## 5. Sequencia de Implementacao

1. Criar tabelas `chart_of_accounts`, `cost_centers` e `audit_log` via migracao SQL (com RLS, constraints e triggers)
2. Criar hooks `useChartOfAccounts`, `useCostCenters` e `useAuditLog`
3. Criar componentes de formulario (ChartOfAccountsFormDialog, CostCenterFormDialog)
4. Criar componente AccountTreeView
5. Criar pagina Configuracoes.tsx com as duas abas
6. Atualizar AppLayout.tsx (menu) e App.tsx (rota)
7. Testar CRUD completo e validacoes

---

## 6. Decisoes Tecnicas

- **CHECK constraints vs CREATE TYPE (enum)**: CHECK constraints por flexibilidade -- adicionar valores futuros requer apenas ALTER constraint.
- **Audit log via hooks vs triggers**: Hooks no frontend na Fase 1.1 por simplicidade. Triggers de banco na Fase 3.
- **Hierarquia via parent_id**: Abordagem simples e suficiente para 4 niveis.

---

## 7. Roadmap de Fases Futuras

### Fase 2 -- Evolucao do Modulo de Contratos
- Adicionar campos `account_id` e `cost_center_id` na tabela `contracts` (FK para as novas tabelas)
- Recorrencia financeira: campos de frequencia (mensal, bimestral, trimestral, anual, personalizado), data inicio/fim
- Tabela `contract_entries`: lancamentos previstos gerados automaticamente a partir da recorrencia
- Tabela `contract_adjustments`: historico de reajustes (IPCA, IGPM, manual)
- Tabela `contract_events_log`: registro de eventos do contrato (criacao, renovacao, distrato, reajuste)
- Alertas de vencimento e renovacao automatica

### Fase 3 -- Integracao com Fluxo de Caixa e Auditoria Robusta
- Vinculacao de lancamentos previstos (contract_entries) com realizados no fluxo de caixa
- Visualizacao previsto vs. realizado com variancia
- Dashboard de impacto dos contratos no fluxo de caixa
- Migracao do audit_log de hooks para triggers de banco (mais robusto e inviolavel)
- Expansao do audit_log para cobrir contratos e lancamentos financeiros

### Fase 4 -- Mapeamento De/Para com ERPs (Secao 4 do documento)
- Tabela de mapeamento entre plano de contas interno e plano de contas do ERP/sistema contabil
- Importacao e sincronizacao de classificacoes externas
- Suporte a multiplos sistemas simultaneos

### Fase 5 -- Governanca e Relatorios (Secoes 6 e 7 do documento)
- Fechamento de periodo contabil (bloquear edicoes em periodos fechados)
- KPIs financeiros: peso de custo por centro, concentracao por tipo, indice de cobertura
- Relatorios gerenciais: DRE simplificado, visao por centro de custo
- Exportacao PDF/Excel
- Painel para investidores com indicadores de governanca

### Fase 6 -- Inteligencia e IA Financeira
- Sugestoes automaticas de classificacao contabil baseadas no historico
- Deteccao de anomalias em lancamentos
- Projecoes financeiras com base em contratos e tendencias
- Integracao com o modulo de IA Financeira existente

