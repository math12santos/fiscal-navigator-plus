# Validação do painel de Rotinas (DP → Cargos → Rotinas)

## O que está OK hoje

**1. Duplicidade ao salvar — já protegido.**
Em `src/components/dp/DPCargos.tsx` (`RoutinesPanel.handleAdd`):
- Há early-return: `if (create.isPending || !form.name.trim()) return;`
- O botão "Salvar" fica `disabled={!form.name.trim() || create.isPending}` e troca o label para "Salvando…".
- O formulário só é resetado no `onSuccess`.
Resultado: cliques repetidos não geram INSERTs duplicados.

**2. Exclusão via RLS — não é silenciosamente bloqueada.**
A policy de DELETE em `public.position_routines` é:
```
USING (is_org_member(auth.uid(), organization_id))
```
Ou seja, qualquer membro da organização pode excluir uma rotina — não há o mesmo problema de RLS silencioso que existia em `positions`. O `onError` + toast já estão ligados no `handleRemove`.

## O que ainda merece ajuste (consistência com Cargos)

**A. Confirmação de exclusão.**
Hoje o botão de lixeira da rotina chama `remove.mutate(id)` direto, sem `AlertDialog`. Como rotinas geram tarefas/notificações em cascata, faz sentido exigir confirmação igual à de Cargos.

**B. Detecção de delete silencioso (defensivo).**
Mesmo a policy estando aberta, padronizar a mutation com `.delete().eq("id", id).select("id")` e lançar erro quando 0 linhas voltarem deixa o hook resiliente a futuras mudanças de RLS. Aplicar também em `useMutatePosition.remove` (já feito) e em `useMutateRoutine.remove`.

**C. Guarda contra duplo clique na lixeira.**
Desabilitar o botão de lixeira da rotina enquanto `remove.isPending` (hoje só o de Cargos faz isso via AlertDialog).

## Plano de ajuste

### 1. `src/hooks/useDP.ts` — `useMutateRoutine.remove`
Trocar para:
```ts
const { data, error } = await supabase
  .from("position_routines")
  .delete()
  .eq("id", id)
  .select("id");
if (error) throw error;
if (!data || data.length === 0) {
  throw new Error("Sem permissão para excluir esta rotina ou ela já foi removida.");
}
```

### 2. `src/components/dp/DPCargos.tsx` — `RoutinesPanel`
- Adicionar estado `deletingRoutine: { id, name } | null`.
- Substituir o `onClick` do botão de lixeira por `setDeletingRoutine({ id: r.id, name: r.name })`.
- Renderizar um `AlertDialog` ao final do componente (título: "Excluir rotina?", descrição com o nome) com `confirmDelete` chamando `remove.mutate(deletingRoutine.id, { onSuccess, onError, onSettled: () => setDeletingRoutine(null) })`.
- Botões com `disabled={remove.isPending}` e label "Excluindo…".

## Fora de escopo
- Não mexer na RLS de `position_routines` (já está adequada).
- Não alterar lógica de criação de rotinas (já está protegida contra duplicidade).
- Nenhuma mudança em `useRoutineCalendar` / geração de tarefas.
