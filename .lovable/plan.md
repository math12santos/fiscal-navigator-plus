## Diagnóstico

Confirmei dois bugs no módulo **DP → Cargos** (`src/components/dp/DPCargos.tsx` + `src/hooks/useDP.ts` + RLS de `public.positions`):

### Bug 1 — Salvar cria vários cargos iguais
O botão "Criar/Salvar" não fica desabilitado durante a mutation, e o `Dialog` só fecha no `onSuccess` (assíncrono). Cada clique extra dispara um novo `INSERT` em `positions`, gerando duplicatas. Mesmo padrão no painel de Rotinas.

### Bug 2 — Excluir cargo não remove nada
Causas combinadas:
1. **RLS bloqueia silenciosamente.** A política de DELETE em `public.positions` exige papel `owner` ou `admin`:
   ```
   has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])
   ```
   Membros comuns conseguem criar/editar mas o `DELETE` afeta 0 linhas (Supabase não retorna erro nesse caso).
2. **UI sem feedback nem confirmação.** O botão de lixeira chama `removePos.mutate(p.id)` direto, sem `AlertDialog` e sem toast de sucesso/erro — o usuário clica, nada acontece, e o cargo continua na lista.

## Plano de correção

### 1. Frontend — `src/components/dp/DPCargos.tsx`
- Desabilitar o botão "Criar/Salvar" enquanto `createPos.isPending` ou `updatePos.isPending`, com label "Salvando…".
- Guardar `handleSavePos` contra duplo clique (early return se já houver mutation pendente).
- Adicionar `onError` em criar/editar/excluir mostrando toast de erro.
- Trocar a exclusão direta por `AlertDialog` de confirmação ("Excluir cargo? Esta ação é permanente.").
- Mostrar toast de sucesso na exclusão e, se a mutation indicar 0 linhas afetadas, exibir "Sem permissão para excluir este cargo".
- Aplicar o mesmo tratamento (loading + toast + confirmação) no painel de Rotinas (criar e excluir).

### 2. Hook — `src/hooks/useDP.ts`
- Em `useMutatePosition.remove`, usar `.delete().eq("id", id).select("id")`. Se o array vier vazio, lançar erro tratável pelo `onError` (detecta RLS silencioso).
- Mesmo ajuste em `useMutateRoutine.remove`.

### 3. RLS — migração em `public.positions` (e `public.position_routines` por consistência)
Substituir a política de DELETE para permitir exclusão por:
- `owner` ou `admin` da organização **OU**
- o próprio usuário que criou o cargo (`auth.uid() = user_id`).

```sql
DROP POLICY "Org admins can delete positions" ON public.positions;
CREATE POLICY "Admins or creator can delete positions"
  ON public.positions FOR DELETE
  USING (
    has_org_role(auth.uid(), organization_id, ARRAY['owner','admin'])
    OR auth.uid() = user_id
  );
```

### 4. Limpeza dos cargos duplicados da usuária
Após confirmação, gerar um `DELETE` one-shot que mantenha 1 registro por `(organization_id, name)` e remova os demais (preservando o mais antigo).

## Próximo passo
Se aprovar este plano, implemento na ordem: RLS → hook → UI → limpeza dos duplicados.
