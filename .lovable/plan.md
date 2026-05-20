# Maturidade configurável + tendência por período

Duas entregas conectadas: (1) painel administrativo para ajustar **pesos das 3 dimensões, faixas de classificação (críticos/desenvolvimento/maduro/excelente) e thresholds operacionais** de cada setor sem alterar código; (2) gráfico de progresso da maturidade com alternância mensal/trimestral e um indicador de tendência (▲/▼/=) em cada card do Dashboard.

## 1. Banco — extensão de `sector_maturity_targets`

Migração adicionando colunas (defaults preservam comportamento atual):

- `weight_completeness` (int, default 50)
- `weight_freshness` (int, default 25)
- `weight_routines` (int, default 25)
- `band_desenvolvimento` (int, default 40)
- `band_maduro` (int, default 70)
- `band_excelente` (int, default 90)

Trigger valida `weights` somando 100 e `bands` crescentes (0 < desenv < maduro < excel ≤ 100).

## 2. Modelo de avaliação

- `targets.ts` ganha os 6 campos novos no tipo + defaults + normalização.
- `fieldsForSector` inclui pesos/faixas para os 5 setores.
- `maturityLabelFromScore(score, bands?)` aceita bandas customizadas.
- Cada `evaluate*` continua devolvendo `completeness/freshness/routines` na escala 0..50/0..25/0..25 (sem mexer nos `weight` dos checklist items). No `useSectorOnboarding`, após o evaluator, aplicamos:
  - `completeness' = completeness * (weight_completeness/50)`
  - `freshness'    = freshness    * (weight_freshness/25)`
  - `routines'     = routines     * (weight_routines/25)`
  - `score = round(completeness' + freshness' + routines')`
  - `label = maturityLabelFromScore(score, bands)`

Isso mantém os checklists intactos e centraliza a personalização.

## 3. Tela de configuração central

Nova rota `/configuracoes/maturidade` (acessível pelo menu Configurações). Estrutura:

```text
PageHeader: Maturidade dos Departamentos
Tabs: [DP] [Financeiro] [Jurídico] [TI & Patrimônio] [Compras]
  Cada aba:
    SectionCard "Pesos das dimensões" — 3 sliders (Completude/Atualização/Rotinas), somatório 100 (auto-balance + aviso)
    SectionCard "Faixas de classificação" — 3 inputs (Desenvolvimento, Maduro, Excelente) com preview da barra colorida
    SectionCard "Thresholds operacionais" — usa o conteúdo do `SectorMaturityTargetsDialog` (campos por `fieldsForSector`)
    Footer: Salvar / Restaurar padrões + badge "Padrão | Personalizado"
```

Refatora o conteúdo do `SectorMaturityTargetsDialog` para um componente `SectorMaturityTargetsForm` reutilizado pelo dialog (mantido para acesso rápido na barra do módulo) e pela nova tela.

## 4. Tendência nos cards do Dashboard

`SectorMaturityCard` ganha:

- Leitura de `useMaturityHistory(sector, undefined, 3)` (últimos 3 meses).
- **Trend chip** ao lado do score: ▲ verde / ▼ vermelho / = cinza com delta absoluto vs. mês anterior (`score - prev`).
- **Sparkline** (12px) com `recharts <LineChart>` dos últimos 3 snapshots ao lado do progress, sem eixos.
- Loading silencioso (sem skeleton extra).

## 5. Gráfico mensal/trimestral

`MaturityTrendChart` ganha toggle `Mensal | Trimestral` (ToggleGroup). No modo trimestral:

- Agrupa snapshots por `YYYY-Qn` (último snapshot de cada trimestre define o ponto).
- Eixo X passa a usar `T1/25`, `T2/25`, etc.
- Mantém as 4 séries (Score/Completude/Atualização/Rotinas).

Também adiciona um pequeno cabeçalho com **delta vs. período anterior** (mesmo cálculo do card).

## 6. Detalhes técnicos

- Arquivos novos: `src/pages/ConfiguracaoMaturidade.tsx`, `src/components/sector-onboarding/SectorMaturityTargetsForm.tsx`, `src/components/dashboard/MaturityTrendChip.tsx`.
- Arquivos alterados: migração; `src/lib/sectorMaturity/targets.ts`, `types.ts`; `src/hooks/useSectorOnboarding.ts` (aplica pesos/bandas); `src/components/sector-onboarding/SectorMaturityTargetsDialog.tsx` (passa a renderizar o Form); `src/components/sector-onboarding/MaturityTrendChart.tsx` (toggle período); `src/components/dashboard/SectorMaturityCard.tsx` (trend + sparkline); `src/App.tsx` (rota); `src/pages/Configuracoes.tsx` ou menu lateral (link).
- Sem mudança nos snapshots históricos: a recomputação usa pesos atuais ao renderizar, e os snapshots persistem o score final calculado naquele mês (auditável).
- Realtime invalidation: chave `sector-maturity-targets` já invalida `sector-onboarding` (existente).

## Fora de escopo

- Editar pesos dos itens de checklist individualmente (continua hardcoded).
- Recalcular retroativamente os snapshots históricos com os novos pesos.
- Versionamento/auditoria das mudanças de targets (só `updated_at`).
