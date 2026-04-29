# Corrigir duplicidade no recálculo da Folha de Pagamento

## Problema diagnosticado

A tabela `payroll_items` (migration `20260223130915`) **não possui constraint UNIQUE** em `(payroll_run_id, employee_id)`. Combinado com o uso de `supabase.from("payroll_items").upsert(...)` em `src/hooks/useDP.ts` (linha 287) **sem `onConflict`**, o Postgres cai no comportamento default (conflito por PK `id`). Como o cliente nunca envia `id`, cada chamada gera uma linha nova.

Resultado: a cada clique em "Calcular Folha" em `DPFolha.tsx` (que chama `upsertItem` em loop por colaborador) os itens são duplicados, inflando totais e quebrando relatórios.

## Plano de correção

### 1. Migration: deduplicar e adicionar UNIQUE

Nova migration SQL que:

a. **Deduplica registros existentes** mantendo o mais recente por `(payroll_run_id, employee_id)`:
```sql
DELETE FROM public.payroll_items a
USING public.payroll_items b
WHERE a.payroll_run_id = b.payroll_run_id
  AND a.employee_id = b.employee_id
  AND a.created_at < b.created_at;
-- desempate por id para empates exatos de timestamp
DELETE FROM public.payroll_items a
USING public.payroll_items b
WHERE a.payroll_run_id = b.payroll_run_id
  AND a.employee_id = b.employee_id
  AND a.created_at = b.created_at
  AND a.id < b.id;
```

b. **Adiciona a constraint**:
```sql
ALTER TABLE public.payroll_items
  ADD CONSTRAINT payroll_items_run_employee_unique
  UNIQUE (payroll_run_id, employee_id);
```

### 2. Ajustar `upsertItem` em `src/hooks/useDP.ts`

Trocar:
```ts
.from("payroll_items").upsert({ ...item, ... })
```
por:
```ts
.from("payroll_items").upsert(
  { ...item, user_id: user!.id, organization_id: currentOrg!.id },
  { onConflict: "payroll_run_id,employee_id", ignoreDuplicates: false }
)
```

Isso garante que o segundo cálculo da mesma folha **atualiza** a linha do colaborador em vez de inserir nova.

### 3. Validação após implementação

- Rodar "Calcular Folha" duas vezes na mesma run e confirmar via consulta que `count(*)` por `(payroll_run_id, employee_id)` permanece 1.
- Confirmar que totais em `payroll_runs` (calculados em `handleCalcPayroll`) batem com a soma dos itens.

## Notas

- A constraint não impacta RLS nem triggers existentes (não há triggers em `payroll_items`).
- Não há outros pontos no código que façam INSERT em `payroll_items` além de `upsertItem` (verificado via `rg`), então o ajuste é suficiente.
- A deduplicação preserva a versão mais recente — alinhada à premissa do produto de "passado imutável" considerando o último cálculo como a verdade vigente da folha em aberto. Folhas com `locked=true` raramente teriam duplicatas, mas a regra de manter o mais recente também as cobre sem perder dados estruturais.
