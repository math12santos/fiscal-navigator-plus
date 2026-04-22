

# Plano: Sanitização automática de filtros inválidos + aviso ao exportar

## Problema
Hoje o URL pode carregar IDs que não existem mais (conta bancária excluída, CC desativado, subsidiária removida, link compartilhado por usuário com escopo diferente). O sistema continua aplicando esses filtros silenciosamente — nenhum dado bate com o ID, então KPIs zeram, gráficos ficam vazios e o PDF é exportado "limpo" sem avisar que a visão é vazia por filtro fantasma. Vai contra o princípio de "decisões auditáveis".

## Comportamento esperado

1. **Sanitização automática (silenciosa quando trivial, com aviso quando relevante)**
   - Ao montar a página de Planejamento, tão logo as listas de referência (`allBankAccounts`, `costCenters`, `subsidiaryOrgs`) terminem de carregar, o sistema valida cada ID presente no URL.
   - IDs que não existem mais nas listas ativas são removidos do URL via `replace: true` (não polui histórico).
   - Se algo foi removido, dispara um **toast informativo único** (não bloqueia): _"Removemos N filtro(s) que não existem mais nesta organização."_ — com a lista das dimensões afetadas.
   - Aguarda explicitamente o fim do carregamento das três fontes antes de validar (não remove filtro só porque a query ainda não voltou).

2. **Aviso ao exportar PDF com filtros inconsistentes**
   - O `ExportPdfButton` ganha uma checagem pré-exportação:
     - Se algum filtro ativo **não casa com nenhum lançamento/contrato/passivo no horizonte selecionado** (resultado vazio causado pelo filtro), abre um `AlertDialog` de confirmação: _"O recorte atual não retorna dados no período. O PDF será gerado em branco. Deseja continuar?"_ com botões **Revisar filtros** (fecha) e **Exportar mesmo assim**.
   - O cálculo de "filtro vazio" é barato: reaproveita os arrays já filtrados que `usePlanningPdfReport` produz internamente (vamos expor um booleano `hasFilteredData` no retorno do hook).
   - Quando não há filtro ativo OU há dados, o fluxo continua igual ao atual (sem diálogo extra).

3. **Mensagem visual no FilterPopover**
   - Pequena nota no rodapé do popover quando há filtros ativos mas zero resultado: _"Recorte atual sem dados no período."_ — ajuda o usuário a entender por que a tela está vazia antes mesmo de tentar exportar.

## Mudanças técnicas

### 1. `src/lib/planningFilters.ts`
- Nova função utilitária:
```ts
sanitizeFilters(
  current: PlanningFilters,
  valid: { orgIds: Set<string>; bankIds: Set<string>; ccIds: Set<string> },
): { sanitized: PlanningFilters; removed: { dimension: string; count: number }[] }
```
- Retorna o objeto limpo e a lista de dimensões com itens removidos para o toast.

### 2. `src/pages/Planejamento.tsx`
- Novo `useEffect` que roda **apenas** quando `isLoadingBankAccounts === false && isLoadingCostCenters === false && holdingQuery loaded`. Compara `filters` atual contra os Sets válidos via `sanitizeFilters`, e:
  - Se `removed.length > 0`, chama `setFilters(sanitized)` e dispara `toast.info(...)`.
  - Usa um `useRef` para garantir que o toast só apareça **uma vez por sessão de sanitização** (não dispara em loop após `setFilters`).
- Passa a propriedade `hasActiveFiltersWithoutData` (derivada abaixo) para o `FilterPopover` exibir a nota de "sem dados".

### 3. `src/hooks/usePlanningPdfReport.ts`
- Expor no retorno: `hasFilteredData: boolean` — true se a soma de `entries.length + contracts.length + payrollProjections.length > 0` após filtros, ou se não há filtro ativo.
- Não muda a lógica de geração — apenas adiciona o sinalizador.

### 4. `src/pages/Planejamento.tsx` — `ExportPdfButton`
- Importa `AlertDialog` do shadcn.
- Antes de chamar `generatePdf()`:
  - Se `hasAnyFilter(filters) && !hasFilteredData` → abre o dialog de confirmação.
  - Botão **Exportar mesmo assim** chama `generatePdf()` (mesmo fluxo de toast/registro).
  - Botão **Revisar filtros** fecha o dialog.
- Quando não há motivo para alertar, fluxo segue idêntico ao atual.

## Garantias

- **Sem perda silenciosa de visão**: usuário sempre sabe quando o sistema removeu filtros obsoletos ou quando o recorte resulta em vazio.
- **Sem loops**: a sanitização só roda após carregamento concluído e usa ref para single-fire por mudança real.
- **Compatibilidade com links compartilhados**: link válido continua funcionando; link inválido se auto-corrige e avisa o destinatário.
- **PDF auditável**: relatório só é gerado em branco mediante confirmação explícita, preservando o princípio "se não pode ser reproduzido, não é válido".
- **Sem regressão**: filtros válidos seguem aplicados; nenhum cálculo (Cockpit, Plan×Real, PDF) muda.

## Arquivos afetados
- **Editado:** `src/lib/planningFilters.ts` (nova `sanitizeFilters`)
- **Editado:** `src/hooks/usePlanningPdfReport.ts` (expõe `hasFilteredData`)
- **Editado:** `src/pages/Planejamento.tsx` (effect de sanitização, AlertDialog no export, nota no FilterPopover)

