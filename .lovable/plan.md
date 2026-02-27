

## Otimizacao da Arvore de Dependencia de Rede

### Diagnostico

O Lighthouse identificou que **314 KiB de JavaScript nao utilizado** esta sendo carregado na pagina inicial. Isso ocorre porque **todas as 20+ paginas** do sistema sao importadas estaticamente no `App.tsx`, gerando um unico bundle JavaScript de ~422 KB. Quando o usuario acessa `/auth`, por exemplo, todo o codigo de Dashboard, CRM, Planejamento, Backoffice, etc. e carregado desnecessariamente.

### Solucao: Code Splitting com React.lazy

Substituir os imports estaticos por imports dinamicos usando `React.lazy()` e `Suspense`. Isso faz com que o Vite gere chunks separados para cada pagina, carregando apenas o codigo necessario para a rota atual.

### Alteracoes

**Arquivo: `src/App.tsx`**

1. Substituir todos os imports de paginas por `React.lazy()`:

```text
// ANTES (import estatico - tudo no bundle principal)
import Dashboard from "@/pages/Dashboard";
import FluxoCaixa from "@/pages/FluxoCaixa";
...

// DEPOIS (import dinamico - chunk separado por pagina)
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const FluxoCaixa = lazy(() => import("@/pages/FluxoCaixa"));
...
```

2. Tambem aplicar lazy loading nos layouts pesados (`AppLayout`, `BackofficeLayout`)

3. Envolver as `<Routes>` com `<Suspense>` usando o mesmo componente de loading que ja existe no codigo (o "Carregando..." com animate-pulse)

### Paginas que serao lazy-loaded (17 paginas + 2 layouts)

- Dashboard, Financeiro, FluxoCaixa, Contratos, Planejamento, Conciliacao
- Tarefas, Integracoes, IAFinanceira, Configuracoes, DepartamentoPessoal, CRM
- CreateOrganization, Onboarding, Auth, NotFound
- BackofficeDashboard, BackofficeCompany, BackofficeUsers, BackofficeAudit, BackofficeConfig, BackofficeSystem
- AppLayout, BackofficeLayout

### Impacto esperado

- O bundle principal cairia de ~422 KB para ~100-150 KB (framework + roteamento + auth)
- Cada pagina seria carregada sob demanda como um chunk separado de ~20-50 KB
- Reducao significativa do "Unused JavaScript" reportado pelo Lighthouse
- A cadeia de requisicoes criticas ficaria mais curta pois o bundle inicial seria menor

### Nenhuma outra alteracao necessaria

- O Vite ja suporta code splitting nativamente com `import()` dinamico
- Nao requer mudanca em configuracao, dependencias ou banco de dados

