# Persistência automática do Líquido a partir de payroll_events

## Problema atual

Hoje `payroll_items.total_liquido` (e `total_bruto`/`total_descontos`) só é atualizado quando o usuário clica em **"Calcular Folha"** em `DPFolha.tsx`. Eventos variáveis (`payroll_events` — horas extras, faltas, bônus, vales) ficam em tabela separada e **não impactam o líquido materializado** até alguém recalcular. Isso quebra:

- Relatórios e dashboards que leem `total_liquido` direto.
- Sincronização com cashflow (vide memória `Termination → Cashflow Sync`), que pode ler valor desatualizado.
- Confiança do CFO/board: o líquido mostrado não reflete os eventos lançados.

## Solução: colunas dedicadas + trigger de agregação

### 1. Migration

a. **Adicionar colunas em `payroll_items`** para isolar a parte vinda de eventos (preserva auditoria entre "fixos calculados" e "variáveis lançados"):
```sql
ALTER TABLE public.payroll_items
  ADD COLUMN eventos_proventos numeric NOT NULL DEFAULT 0,
  ADD COLUMN eventos_descontos numeric NOT NULL DEFAULT 0,
  ADD COLUMN eventos_atualizado_em timestamptz;
```

b. **Função de recomputação** (`recompute_payroll_item_from_events`): para um par `(payroll_run_id, employee_id)`, soma os eventos por `signal`, faz upsert da linha em `payroll_items` (criando-a se ainda não existir) e recalcula:
```
total_bruto    = salario_base + horas_extras + comissoes + adicionais + dsr + eventos_proventos
total_descontos = inss_empregado + irrf + vt_desconto + faltas_desconto + outros_descontos + eventos_descontos
total_liquido  = total_bruto - total_descontos
```
A função respeita o flag `payroll_runs.locked` — se a folha estiver fechada, **não** atualiza (raise notice + return).

c. **Trigger `trg_payroll_events_sync_item`** em `payroll_events` AFTER INSERT/UPDATE/DELETE chamando a função para o `(payroll_run_id, employee_id)` afetado (e também para o par antigo, em caso de UPDATE que mude a vinculação).

A trigger só roda quando `payroll_run_id IS NOT NULL` (eventos avulsos sem run vinculado não materializam).

d. **Backfill único** ao final da migration: rodar a função para todos os pares `(payroll_run_id, employee_id)` distintos já existentes em `payroll_events`, garantindo que folhas atuais já reflitam os eventos lançados.

### 2. Ajuste em `DPFolha.tsx` / `useDP.ts`

O cálculo manual continua válido (recomputa fixos: salário, INSS, IRRF, VT, encargos), mas o `upsertItem` precisa **preservar** as colunas de eventos. Solução: na função `handleCalcPayroll`, após gravar os fixos via `upsertItem`, chamar a mesma `recompute_payroll_item_from_events` via RPC para garantir consistência total. Alternativamente — e mais limpo — a função SQL recebe um parâmetro opcional para sobrescrever só os fixos, mantendo eventos.

Abordagem escolhida: o `upsertItem` continua gravando apenas as colunas fixas (sem mexer em `eventos_*`); ao final do loop em `handleCalcPayroll`, o cliente dispara um `supabase.rpc("recompute_payroll_run_totals", { p_run_id })` que itera todos os funcionários da run e roda a recomputação para cada par. Isso garante:

- Inserção de evento → trigger atualiza item daquele funcionário.
- Recálculo manual → atualiza fixos + recomputa totais incluindo eventos.

### 3. Validações pós-implementação

- Inserir evento de bônus em folha aberta: `total_liquido` daquele funcionário deve subir automaticamente.
- Editar evento (mudar valor): líquido reflete novo valor.
- Deletar evento: líquido volta ao anterior.
- Inserir evento em folha `locked=true`: trigger não altera item; aplicação deve impedir o lançamento na UI (já há `locked` no schema; recomendo guard adicional em `useMutatePayrollEvent.create` — verificar `payroll_runs.locked` antes de inserir).
- Backfill: folhas antigas com eventos passam a ter líquido correto sem clicar em recalcular.

## Notas

- Trigger é `SECURITY DEFINER` com `search_path = public` para conseguir gravar em `payroll_items` mesmo que o usuário não tenha permissão direta de UPDATE — necessário porque o usuário pode ter permissão em `payroll_events` mas o item pertence ao mesmo escopo.
- Idempotente: rodar duas vezes com o mesmo conjunto de eventos produz o mesmo resultado.
- Não cria duplicidade graças à constraint `payroll_items_run_employee_unique` adicionada na migration anterior.
- Logging via `RAISE NOTICE` para folhas locked, sem console.error em cliente (alinhado à política `Error Handling Policy`).
