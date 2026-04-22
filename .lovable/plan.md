

# Plano: Persistir filtros de Planejamento no URL

## Objetivo
Sincronizar os filtros (unidade, conta bancária, centro de custo) com a query string do URL, permitindo recarregar a página e compartilhar links que abram a mesma visualização do Cockpit / Plan×Real×Projetado.

## Comportamento esperado
- Ao alterar um filtro no `FilterPopover`, o URL é atualizado automaticamente:
  `…/planejamento?org=<uuid>&conta=<uuid>&cc=<uuid>`
- Ao recarregar a página ou abrir um link compartilhado, os filtros são lidos do URL e aplicados ao estado.
- Quando um filtro é limpo (volta a `null`), o parâmetro é removido do URL — sem deixar `?org=null` sujo.
- Filtros vazios mantêm o URL limpo (`/planejamento`).
- A persistência se aplica apenas aos filtros desta página; não afeta a aba ativa, datas ou versão de orçamento (que já têm seu próprio mecanismo).

## Mudanças técnicas (1 arquivo)

**`src/pages/Planejamento.tsx`**
1. Importar `useSearchParams` de `react-router-dom`.
2. Substituir o `useState<PlanningFilters>(EMPTY_PLANNING_FILTERS)` por um par leitura/escrita derivado do URL:
   - **Leitura inicial** (`useMemo`): lê `org`, `conta`, `cc` de `searchParams` e monta o objeto `PlanningFilters`.
   - **Setter** (`setFilters`): recebe o novo `PlanningFilters`, monta novos `URLSearchParams` preservando os params existentes (não relacionados aos filtros) e remove chaves cujos valores forem `null`.
3. Passar `filters` e o novo setter ao `FilterPopover`, `PlanningCockpit`, `PlanningBudget` e `ExportPdfButton` exatamente como hoje — a interface dos consumidores não muda.

## Detalhes de implementação

```ts
const [searchParams, setSearchParams] = useSearchParams();

const filters = useMemo<PlanningFilters>(() => ({
  subsidiaryOrgId: searchParams.get("org"),
  bankAccountId: searchParams.get("conta"),
  costCenterId: searchParams.get("cc"),
}), [searchParams]);

const setFilters = (next: PlanningFilters) => {
  const params = new URLSearchParams(searchParams);
  const apply = (key: string, value: string | null) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };
  apply("org", next.subsidiaryOrgId);
  apply("conta", next.bankAccountId);
  apply("cc", next.costCenterId);
  setSearchParams(params, { replace: true });
};
```

`replace: true` evita poluir o histórico do navegador a cada mudança de filtro (Voltar não fica preso em estados intermediários).

## Garantias
- **Compartilhável**: copiar o URL e abrir em outra aba/usuário (com permissão) reproduz a mesma visualização.
- **Auditável**: o link salvo no histórico de exportações de PDF segue refletindo o recorte real.
- **Sem regressão**: nenhum hook ou componente downstream muda — apenas a fonte de `filters` passa de `useState` para URL.

## Arquivos afetados
- **Editado:** `src/pages/Planejamento.tsx`

