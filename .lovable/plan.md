

## Presets favoritos de período no Relatório KPI

Adicionar a capacidade de **salvar, nomear, aplicar e excluir presets de período (from/to)** na página `/relatorio-kpi/:metric`, persistidos por usuário/organização no backend, com acesso rápido ao lado do seletor de período já existente.

### O que o usuário verá

1. **Botão "★ Presets"** ao lado do `RangePicker` no card de "Período".
2. Ao clicar, abre um **Popover** com:
   - **Lista dos presets salvos** (nome + range "MMM/yyyy – MMM/yyyy"), cada um clicável para aplicar imediatamente o `from/to` na URL.
   - Ícone de **lixeira** ao lado de cada preset para excluir (com confirmação inline).
   - Indicador visual ✓ no preset que coincide com o range atualmente aplicado.
3. **Botão "Salvar período atual como preset"** dentro do mesmo popover:
   - Abre um pequeno form (input de nome, ex.: "Operações do 1º semestre") + botão "Salvar".
   - Validação: nome obrigatório, máx. 60 caracteres, sem duplicidade de nome (atualiza o existente se mesmo nome).
   - Toast de confirmação ao salvar/excluir.
4. **Estado vazio**: quando não houver presets, o popover exibe orientação curta ("Salve combinações de período que você usa com frequência") e foca direto no input de nome.
5. **Escopo**: presets ficam **por usuário** e funcionam para qualquer KPI (são apenas pares from/to). Quando o usuário está em um KPI com `scopeIsCurrentMonth`, o botão fica desabilitado com tooltip explicativo ("Este KPI usa o mês corrente — presets não se aplicam").

### Como funciona por baixo

**Backend (Lovable Cloud / Supabase)**

Nova tabela `kpi_period_presets`:

```text
id              uuid PK
user_id         uuid  (auth.uid)
organization_id uuid  (escopo multi-tenant)
name            text  (1..60 chars, único por user_id+organization_id)
range_from      date
range_to        date
created_at      timestamptz
updated_at      timestamptz
```

- RLS: SELECT/INSERT/UPDATE/DELETE apenas onde `user_id = auth.uid()` E o usuário pertence à organização (padrão `has_org_access`/membership já usado no projeto).
- Trigger `updated_at` no padrão existente.
- Validação por **trigger** (não CHECK) para garantir `range_from <= range_to` e `name` não vazio — segue a regra do projeto de evitar CHECK com expressões mutáveis.

**Frontend**

- Novo hook `src/hooks/useKpiPeriodPresets.ts`:
  - `presets`, `isLoading`, `savePreset(name, from, to)`, `deletePreset(id)`.
  - Usa React Query, escopado por `currentOrg.id` + `user.id`.
  - Invalida cache em mutações; toasts em sucesso/erro.
- Novo componente `src/components/relatorio/KpiPeriodPresetsPopover.tsx`:
  - Recebe `currentFrom`, `currentTo`, `onApply(from, to)` e `disabled`.
  - Renderiza Popover + lista + form de criação descritos acima.
- Integração em `src/pages/RelatorioKpi.tsx`:
  - Inserir `<KpiPeriodPresetsPopover>` adjacente ao `RangePicker` no header do card de Período.
  - `onApply` chama o `applyRange(from, to)` já existente que atualiza `searchParams`, disparando recarga natural via `useFinancialSummary`.
  - Desabilitado quando `meta.scopeIsCurrentMonth` é `true`.

### Auditabilidade & princípios do produto

- Presets **não alteram dados** — são apenas atalhos de filtro de visualização.
- Como a aplicação atualiza a URL (`?from=...&to=...`), qualquer preset aplicado gera uma URL compartilhável e reproduzível, mantendo o princípio "o relatório de hoje pode ser reproduzido amanhã".
- Sem mudanças na lógica de cálculo, reconciliação ou export CSV.

### Arquivos

- **Migração nova**: `supabase/migrations/<timestamp>_kpi_period_presets.sql` (tabela + RLS + trigger).
- **Criar**: `src/hooks/useKpiPeriodPresets.ts`, `src/components/relatorio/KpiPeriodPresetsPopover.tsx`.
- **Editar**: `src/pages/RelatorioKpi.tsx` (renderizar o popover ao lado do `RangePicker` existente).

