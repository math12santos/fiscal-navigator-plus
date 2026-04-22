-- Adiciona campos de auditoria detalhada ao histórico de exportações de PDF do Planejamento.
-- Permite que o usuário compare entre exportações: quais nomes (não só IDs) foram filtrados
-- e por que um recorte específico ficou vazio (caso aplicável).
ALTER TABLE public.planning_report_exports
  ADD COLUMN IF NOT EXISTS filter_labels jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS had_data boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS empty_reason text NULL;

COMMENT ON COLUMN public.planning_report_exports.filter_labels IS
  'Nomes legíveis das dimensões filtradas no momento da exportação — preserva contexto para auditoria mesmo se entidades forem renomeadas/excluídas depois. Estrutura: { subsidiary?: string, bankAccounts?: string[], costCenters?: string[] }';

COMMENT ON COLUMN public.planning_report_exports.had_data IS
  'Snapshot rápido: o recorte gerou PDF com dados (true) ou em branco (false). Útil para listar/auditar exportações vazias.';

COMMENT ON COLUMN public.planning_report_exports.empty_reason IS
  'Motivo do recorte vazio (NULL quando had_data=true). Valores conhecidos: "no_period_data" (sem lançamentos no período), "filters_excluded_all" (filtros eliminaram todos os dados), "no_budget_version" (sem versão orçamentária ativa), "other".';