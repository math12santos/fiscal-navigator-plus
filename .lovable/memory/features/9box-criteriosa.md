---
name: 9 Box criteriosa
description: Matriz 9 Box ponderada por rubrica de critérios, evidências obrigatórias em notas extremas, triangulação gestor/auto/par, workflow de calibração e detector de viés.
type: feature
---

A Matriz 9 Box deixou de ser nota digitada subjetivamente. Agora:

- **Rubrica** (`hr_9box_criteria`): 5 critérios de desempenho + 5 de potencial, ponderados, com âncoras 1–5. Templates do sistema (organization_id NULL) servem de default; cada org pode sobrescrever criando seus próprios critérios.
- **Notas por critério × fonte** (`hr_9box_scores`): nota 1–5 + `evidence_text`/`evidence_url`. Trigger `validate_9box_score_evidence` impede salvar quando a nota é ≤2 ou ≥4 sem evidência.
- **Fontes ponderadas** (`hr_9box_sources`): gestor (60), auto (20), par (20). Avaliação nasce no fluxo do gestor; auto/par são habilitadas pelo wizard e enviadas depois.
- **Workflow** (`status` enum em `hr_9box_evaluations`): `rascunho` → `em_calibracao` → `calibrada`. Cada transição grava em `hr_9box_calibration_log`.
- **Confiabilidade** 0–100: combina diversidade de fontes (60), cobertura de critérios pelo gestor (30) e cobertura de evidências em notas extremas (10). Função pura `confidenceScore` em `src/lib/performance/scoring.ts`.
- **Detector de viés**: `detectBias` sinaliza inflação (>60% em Q8/Q9), deflação (>50% em Q1/Q2) e unilateralidade (>70% com 1 fonte). Aparece como **alerta visual** acima da matriz; nunca trava salvar.
- **Privacidade**: RLS de `hr_9box_evaluations` permite leitura apenas para owner/admin/manager da org, master e backoffice. Colaborador comum **nunca vê 9 Box, nem o próprio**. `liberado_para_colaborador` permanece sempre false.
- **Integração BSC**: o critério "Entrega de resultados" recebe sugestão automática a partir do `resultado_geral` do BSC ativo do colaborador.

UI:
- Wizard focado: `src/components/desempenho/NineBoxWizardDialog.tsx` (4 passos colapsáveis: fontes → desempenho → potencial → revisão).
- Tabela e cards com badges de status (`Rascunho`/`Em calibração`/`Calibrada`) e confiabilidade (`Alta`/`Média`/`Baixa`).
- Ação "Calibrar" inline na tabela para mover de `em_calibracao` → `calibrada`.

Arquivos: `src/lib/performance/scoring.ts` (+ testes), `src/hooks/useNineBoxRubric.ts`, `src/components/desempenho/NineBoxWizardDialog.tsx`, migration `20260429*` com tabelas/RLS/seed.
