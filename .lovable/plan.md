# Ativar o módulo TI no front

A página `src/pages/TI.tsx` já está pronta (Dashboard, Equipamentos, Sistemas, Telecom, Chamados/SLA, Sinistros, Depreciação, TCO, Configurações) mas está órfã: não tem rota nem entrada na sidebar. Esta correção liga tudo.

## Mudanças

### 1. `src/App.tsx`
- Adicionar entrada em `pageFactories`:
  ```ts
  ti: () => import("@/pages/TI"),
  ```
- Criar o lazy component:
  ```ts
  const TI = lazyRetry(pageFactories.ti);
  ```
- Adicionar a rota dentro de `ProtectedRoutes` (antes do `path="*"`):
  ```tsx
  <Route path="/ti" element={
    <RouteShell skeleton={<GenericPageSkeleton title="TI & Ativos" />}>
      <ModuleMaintenanceGuard moduleKey="ti"><TI /></ModuleMaintenanceGuard>
    </RouteShell>
  } />
  ```

### 2. `src/components/AppLayout.tsx`
- Importar ícone `Monitor` de `lucide-react`.
- Adicionar item ao `navItems` (entre Cadastros e Tarefas, agrupando com módulos operacionais):
  ```ts
  { path: "/ti", label: "TI & Ativos", icon: Monitor, module: "ti", prefetch: "ti" },
  ```

### 3. `src/data/moduleDefinitions.ts`
- Registrar o módulo `ti` no `MODULE_DEFINITIONS` para que apareça nas permissões do BackOffice e no controle de manutenção:
  ```ts
  {
    key: "ti",
    label: "TI & Ativos",
    tabs: [
      { key: "dashboard", label: "Dashboard" },
      { key: "equipamentos", label: "Equipamentos" },
      { key: "sistemas", label: "Sistemas" },
      { key: "telecom", label: "Links / Telecom" },
      { key: "chamados", label: "Chamados" },
      { key: "sinistros", label: "Sinistros" },
      { key: "depreciacao", label: "Depreciação" },
      { key: "tco", label: "TCO" },
      { key: "config", label: "Configurações" },
    ],
  },
  ```

## Verificações pós-alteração
- Sidebar mostra "TI & Ativos" para usuários com permissão.
- `/ti` carrega a página com Suspense + skeleton.
- BackOffice → Permissões da empresa lista o módulo TI com suas tabs.
- `ModuleMaintenanceGuard moduleKey="ti"` respeita o flag global em `system_modules`.

## Fora de escopo
- Módulo Jurídico (não existe no codebase — fica para próximo plano).
