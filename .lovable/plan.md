

## Shell-first loading + indicador global de cálculo nas páginas

Reduzir a sensação de lentidão ao trocar de módulo exibindo **imediatamente o "esqueleto" da página** (cabeçalho, abas, cards, gráficos vazios) e um **marcador global de "calculando"** enquanto os dados são buscados. O usuário deixa de ver tela em branco ou skeletons genéricos e passa a ver a estrutura real da página com placeholders animados + um indicador claro de progresso.

### O que o usuário verá

**1. Ao clicar em qualquer módulo da sidebar**

A área central troca instantaneamente para um esqueleto **fiel ao layout final**:
- Linha do título da página (com nome real do módulo) + descrição cinza
- Linha de abas (quando o módulo tem abas, ex.: Financeiro, Planejamento, DP, CRM)
- Grid de KPIs cinza (4–6 cards retangulares)
- Bloco de gráfico/tabela cinza ocupando o resto da viewport

Sem mais "flash" da `ContentSkeleton` genérica seguida de tela vazia — o esqueleto **já tem o formato do módulo**.

**2. Marcador global "Calculando…" no topo da área central**

Um badge fixo no canto direito do header (ao lado de Tema/Notificações):
- Aparece com `Loader2` girando + texto "Calculando…" sempre que **qualquer query do React Query** estiver `isFetching` (não só na primeira carga, mas também em refetches manuais).
- Soma o número de queries ativas (ex.: "Calculando… (3)") para dar feedback do volume.
- Some sozinho quando todas as queries terminam.
- Tooltip mostra "Buscando dados do servidor" para deixar claro o que está acontecendo.

Implementação: usa `useIsFetching()` do `@tanstack/react-query` — zero overhead, já vem do provider existente.

**3. Cards e gráficos preenchem progressivamente**

Quando `isLoading` de cada hook resolve, o card real substitui o skeleton individualmente. A página não "pisca" nem reorganiza — o esqueleto reserva o espaço exato.

### Como funciona (técnico)

**A. Skeletons por módulo (`src/components/skeletons/`)**

Criar um arquivo de skeletons específicos, mínimos e síncronos (sem fetches, sem hooks pesados):

- `DashboardSkeleton.tsx`: header + 6 KPIs + 2 gráficos lado a lado + 1 tabela.
- `FinanceiroSkeleton.tsx`: header + barra de abas + 4 KPIs + tabela longa.
- `PlanejamentoSkeleton.tsx`: header + abas + 3 cards de orçamento + área de gráfico.
- `DpSkeleton.tsx`, `CrmSkeleton.tsx`, `ContratosSkeleton.tsx`, `RelatorioKpiSkeleton.tsx`: cada um espelhando a estrutura real.
- `GenericPageSkeleton.tsx`: fallback (header + 4 KPIs + bloco), substituindo o `ContentSkeleton` genérico atual.

Cada skeleton usa `<Skeleton>` do shadcn (já existe em `src/components/ui/skeleton.tsx`), portanto consistente com o tema dark/light.

**B. Mapear cada rota ao seu skeleton no `Suspense` interno (`src/App.tsx`)**

Hoje há um único `<Suspense fallback={<ContentSkeleton />}>` cobrindo todas as rotas. Em vez disso, envolver cada `<Route element={...}>` em um `<Suspense>` com fallback específico do módulo. Exemplo:

```tsx
<Route path="/financeiro" element={
  <Suspense fallback={<FinanceiroSkeleton />}>
    <ModuleMaintenanceGuard moduleKey="financeiro"><Financeiro /></ModuleMaintenanceGuard>
  </Suspense>
} />
```

A nota de memória `performance-optimization` diz "não usar Suspense aninhado por rota" para não desmontar sidebar/header — **isso continua respeitado**: a sidebar/header ficam fora, no `AppLayout`. O Suspense aninhado fica apenas dentro da área central, exatamente como o `ContentSkeleton` atual já faz, só que agora com fallback fiel ao módulo.

A memória será atualizada para refletir: "Suspense interno usa skeleton específico por rota; nunca envolve `AppLayout`."

**C. Indicador global "Calculando…" (`src/components/GlobalFetchingIndicator.tsx`)**

```tsx
import { useIsFetching } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export function GlobalFetchingIndicator() {
  const count = useIsFetching();
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs"
         title="Buscando dados do servidor">
      <Loader2 size={12} className="animate-spin" />
      <span>Calculando{count > 1 ? ` (${count})` : "…"}</span>
    </div>
  );
}
```

Inserir em `AppLayout.tsx` no header (linha 176), antes do `ThemeToggle`. Mesma coisa em `BackofficeLayout.tsx`.

**D. Skeleton dentro das páginas (refinamento mínimo, opcional por módulo)**

Hoje vários módulos retornam `null` ou vazio durante `isLoading`. Para os módulos críticos (Dashboard, Financeiro, Planejamento, DP), substituir os retornos vazios por **skeletons inline dos KPIs/tabelas** — assim, mesmo após o chunk carregar, o usuário vê estrutura enquanto o React Query traz os dados. O `GlobalFetchingIndicator` complementa avisando que algo está rodando.

Esta etapa é incremental: começamos por `Dashboard.tsx` e `Financeiro.tsx`. Outros módulos podem ser feitos depois se necessário.

### Resultado esperado

| Antes | Depois |
|---|---|
| Clica → skeleton genérico de 3 blocos → tela em branco → conteúdo aparece | Clica → esqueleto fiel ao módulo aparece imediatamente → badge "Calculando…" indica fetch em andamento → cards preenchem in-place |
| Sem feedback visual durante refetches | Badge "Calculando…" no header sempre que qualquer query roda |
| Sensação de "travado" | Sensação de "está vindo" |

### Arquivos

**Criar:**
- `src/components/GlobalFetchingIndicator.tsx`
- `src/components/skeletons/GenericPageSkeleton.tsx`
- `src/components/skeletons/DashboardSkeleton.tsx`
- `src/components/skeletons/FinanceiroSkeleton.tsx`
- `src/components/skeletons/PlanejamentoSkeleton.tsx`
- `src/components/skeletons/ContratosSkeleton.tsx`
- `src/components/skeletons/DpSkeleton.tsx`
- `src/components/skeletons/CrmSkeleton.tsx`
- `src/components/skeletons/RelatorioKpiSkeleton.tsx`

**Editar:**
- `src/App.tsx` — Suspense por rota com fallback de skeleton específico (manter um único nível interno; sidebar/header permanecem fora).
- `src/components/AppLayout.tsx` — adicionar `<GlobalFetchingIndicator />` no header.
- `src/components/BackofficeLayout.tsx` — mesma adição no header do backoffice.
- `src/pages/Dashboard.tsx` — substituir retorno vazio durante `isLoading` por `<DashboardSkeleton />` inline (estrutura preservada).
- `src/pages/Financeiro.tsx` — idem com `<FinanceiroSkeleton />`.

**Memória:**
- Atualizar `mem://architecture/performance-optimization` para registrar: "Skeletons fiéis por rota + `useIsFetching` no header" como padrão oficial.

Sem mudanças de schema, sem mudanças de lógica de negócio, sem alterar hooks de dados — apenas camada visual de carregamento e indicador global.

