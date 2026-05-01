---
name: SectionCard pattern (DP-style sections)
description: Padrão visual de seções dentro de tabs — wrapper SectionCard com ícone, título sm, descrição xs e separator. Padronizado em DP/Juridico/TI/Financeiro/CRM/Planejamento/Contratos.
type: design
---

**Componente:** `src/components/SectionCard.tsx` (`DpSection` é re-export para back-compat).

**Quando usar:** Sempre que uma tab tiver conteúdo principal (tabela, formulário, KPIs, gráfico). Substitui `<Card><CardHeader><CardTitle>` quando o objetivo é dar título + descrição + ações + separator.

**API:**
- `icon` (LucideIcon) — exibido em quadrado primary/10 8x8
- `title` (string) — text-sm font-semibold
- `description` (string) — text-xs muted
- `actions` (ReactNode) — alinhados à direita do header (ex.: search + botão "Novo")
- `variant` — `default` | `compact` | `highlighted`

**Padrão de páginas (TabsList):**
```tsx
<div className="animate-fade-in space-y-6">
  <PageHeader ... />
  <Tabs className="space-y-4">
    <TabsList className="flex-wrap bg-muted/40 border border-border p-1 h-auto">
      <TabsTrigger className="text-xs">...</TabsTrigger>
    </TabsList>
  </Tabs>
</div>
```

Não usar `container mx-auto p-4` em páginas internas — o AppLayout já aplica padding.
