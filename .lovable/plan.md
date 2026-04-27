## Diagnóstico

A página `src/pages/DepartamentoPessoalDesempenho.tsx` (Gestão de Desempenho — PDI, 1:1, 9 Box, BSC) foi **criada nas etapas anteriores, mas nunca foi conectada ao app**:

1. **Não há rota registrada** em `src/App.tsx` para `/dp/desempenho`. Hoje só existe `/dp` (DepartamentoPessoal). Acessar `/dp/desempenho` cai no `NotFound`.
2. **Não existe link/botão** no `/dp` que leve até a subpágina — nem no `AppLayout` (sidebar), nem nas abas do `DepartamentoPessoal.tsx`, nem em qualquer card.
3. A página também não está em `pageFactories` (prefetch/lazy), então mesmo se o usuário digitasse a URL não havia o atalho carregado.

Por isso o usuário não encontra a aba: ela está implementada, mas órfã no roteamento.

## Plano de correção

### 1. Registrar a rota (`src/App.tsx`)
- Adicionar entrada em `pageFactories`:
  ```ts
  dpDesempenho: () => import("@/pages/DepartamentoPessoalDesempenho"),
  ```
- Criar `const DepartamentoPessoalDesempenho = lazyRetry(pageFactories.dpDesempenho);`
- Adicionar a rota logo abaixo de `/dp`, reaproveitando o mesmo `ModuleMaintenanceGuard moduleKey="dp"` e `DpSkeleton`:
  ```tsx
  <Route path="/dp/desempenho" element={<RouteShell skeleton={<DpSkeleton />}><ModuleMaintenanceGuard moduleKey="dp"><DepartamentoPessoalDesempenho /></ModuleMaintenanceGuard></RouteShell>} />
  ```

### 2. Adicionar ponto de entrada visível no módulo DP (`src/pages/DepartamentoPessoal.tsx`)
Em vez de poluir a sidebar com mais um item, manter o padrão atual do app (subpáginas acessadas a partir do módulo pai, ex.: `/relatorios/distribuicao` é módulo próprio mas as subpáginas do DP devem ficar dentro do DP).

- Adicionar um botão **"Gestão de Desempenho"** no `PageHeader` da página `/dp` (canto direito, ao lado do título), usando ícone `TrendingUp` ou `Target`, que faz `navigate("/dp/desempenho")`.
- Como a página de Desempenho é uma visão consolidada/transversal (PDI, 1:1, 9 Box, BSC), faz mais sentido como CTA no header do que como nova aba dentro do `Tabs` — mantém as 9 abas operacionais existentes intactas.

### 3. Prefetch on hover
- O `AppLayout` já tem mecanismo de prefetch via `pageFactories`. Como a subpágina não fica na sidebar, basta o botão do header já apontar para a rota — o `lazyRetry` cuida do code-splitting.

### 4. Permissões
- A subpágina herda permissões do módulo `dp` via `ModuleMaintenanceGuard moduleKey="dp"`. Não é necessária nova chave em `MODULE_DEFINITIONS` — quem acessa o DP acessa Desempenho.
- Se futuramente precisar restringir Desempenho a um subconjunto (ex.: só RH/gestores), aí adicionamos uma tab key `desempenho` em `MODULE_DEFINITIONS.dp.tabs` e checamos com `canAccessTab("dp", "desempenho")` antes de mostrar o botão e ao entrar na rota. **Não faremos isso agora** para manter o MVP simples — fica registrado como follow-up.

## Detalhes técnicos

**Arquivos editados:**
- `src/App.tsx` — registrar `pageFactories.dpDesempenho`, lazy import e `<Route path="/dp/desempenho" />`.
- `src/pages/DepartamentoPessoal.tsx` — adicionar botão "Gestão de Desempenho" no `PageHeader` (children) que navega para `/dp/desempenho`.

**Arquivos NÃO alterados:**
- `src/components/AppLayout.tsx` — não adicionar item na sidebar (Desempenho é subpágina do DP, não módulo separado).
- `src/data/moduleDefinitions.ts` — sem novas tabs/módulos por enquanto.
- `src/pages/DepartamentoPessoalDesempenho.tsx` — já existe e funciona; o botão "Voltar ao DP" interno continua válido.

## Resultado esperado

Após a aplicação:
- Usuário em `/dp` vê um botão **"Gestão de Desempenho"** no header.
- Clicar leva a `/dp/desempenho` (rota registrada, sem 404).
- A página existente carrega com PDI, 1:1, 9 Box, BSC e os gráficos Recharts já implementados.
- Botão "Voltar ao DP" da subpágina já volta para `/dp`.
