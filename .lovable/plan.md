# Maturidade por Setor no Dashboard Geral

Adicionar uma seção no Dashboard que exibe, em uma única visão executiva, o nível de maturidade de cada departamento (DP e Financeiro hoje; CRM/Contratos/Planejamento ficam preparados para quando seus avaliadores existirem).

## O que o usuário verá

Um bloco "Maturidade dos Departamentos" no Dashboard, com:

- Um card por setor implementado (DP, Financeiro), exibindo:
  - Score 0–100 + label (Inicial / Básico / Intermediário / Avançado / Excelente) com a cor padrão do termômetro.
  - Barra de progresso.
  - Mini-breakdown 50/25/25 (Completude / Atualização / Rotinas).
  - Quantidade de itens pendentes no checklist.
  - Botão "Abrir setor" → navega para a página do módulo (DP/Financeiro), onde a `SectorOnboardingBar` completa já existe (trilha, checklist, tendência, metas, PDF).
- Score consolidado da organização (média simples dos setores avaliados) no cabeçalho da seção, com label.
- Estado vazio amigável quando nenhum setor estiver avaliado ainda.
- Skeleton enquanto carrega.

A seção fica logo acima do bloco DP existente (`DPCockpitSection`), respeitando a hierarquia executiva (visão geral → drill-down).

## Como funciona

- Reusa o mesmo motor de avaliação que já roda em DP e Financeiro (`useSectorOnboarding`), garantindo número idêntico ao mostrado dentro de cada módulo (single source of truth).
- O Dashboard chama o hook uma vez por setor suportado. Cada chamada já carrega só seus datasets e respeita as metas configuráveis (`sector_maturity_targets`).
- Sem novas tabelas, sem nova migration, sem novo edge function.

## Detalhes técnicos

Arquivos novos:
- `src/components/dashboard/MaturityOverviewSection.tsx` — seção completa (cabeçalho + grid de cards + score consolidado + empty/loading state).
- `src/components/dashboard/SectorMaturityCard.tsx` — card por setor (score, label, progresso, mini 50/25/25, contagem de pendências, CTA "Abrir setor").

Arquivos editados:
- `src/pages/Dashboard.tsx` — importa e renderiza `<MaturityOverviewSection />` antes do `DPCockpitSection`.

Implementação:
- Lista interna `SUPPORTED_SECTORS: SectorKey[] = ["dp", "financeiro"]` (fácil estender quando CRM/Contratos/Planejamento ganharem `evaluate*`).
- Cada `SectorMaturityCard` consome `useSectorOnboarding(sector)` e usa `MATURITY_LABEL_META` + `SECTOR_META` para label/cor/rota.
- Score consolidado = média dos `result.score` dos setores com resultado disponível.
- Navegação via `useNavigate(SECTOR_META[sector].route)`.
- Sem strings dinâmicas de Tailwind (respeita a regra do projeto): cores via `cn()` e classes pré-definidas em `MATURITY_LABEL_META.badgeClass`.
- Sem alterações em RLS, schema, edge functions ou em `SectorOnboardingBar` / hooks existentes.

## Fora do escopo

- Não cria avaliadores para CRM, Contratos ou Planejamento (esses serão pilotos próprios, como foi DP→Financeiro).
- Não duplica trilha/checklist/tendência no Dashboard — esses continuam dentro de cada módulo via `SectorOnboardingBar` para evitar ruído na visão executiva.
- Não altera as metas nem a persistência em `sector_onboarding`.
