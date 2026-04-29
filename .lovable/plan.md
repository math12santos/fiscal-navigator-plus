## Problema

Hoje a Matriz 9 Box é totalmente subjetiva: o gestor digita "nota desempenho 1–5" e "nota potencial 1–5" sem nenhuma âncora, sem rubrica, sem evidência e sem ninguém para contestar. Resultado: avaliação vira opinião, perde valor para sucessão, PDI e decisões de board.

## Objetivo

Manter a autonomia do gestor, mas obrigar que cada nota seja **derivada de critérios objetivos, evidências registradas e calibrada por um segundo olhar**, deixando rastro auditável.

## Solução proposta — 5 camadas de objetividade

### 1. Rubrica configurável (Critérios)

Em vez de uma nota única, desempenho e potencial passam a ser compostos por **critérios ponderados**, cada um com âncoras descritivas por nível 1–5.

- **Desempenho (default, editável por org):**
  - Entrega de resultados (peso 40%) — puxa BSC do colaborador
  - Qualidade técnica (20%)
  - Cumprimento de prazos (15%)
  - Colaboração / trabalho em equipe (15%)
  - Aderência a valores/cultura (10%)
- **Potencial (default, editável):**
  - Capacidade de aprendizado (25%)
  - Liderança / influência (25%)
  - Adaptabilidade (20%)
  - Visão estratégica (20%)
  - Mobilidade / disponibilidade (10%)
  &nbsp;

Cada critério exibe uma **âncora textual** ("Nota 4 = entregou >100% das metas, …") para o gestor escolher pelo comportamento, não pelo número.

A nota final 1–5 é **calculada automaticamente** (média ponderada) — o gestor não digita mais a nota cheia, ele avalia critério a critério.

### 2. Evidências obrigatórias

- Para nota **≥ 4** ou **≤ 2** em qualquer critério: campo de **evidência obrigatória** (texto curto + opção de anexar link/documento).
- Sem evidência → não salva.
- Critério "Entrega de resultados" puxa automaticamente o **BSC ativo** como evidência (snapshot do percentual de atingimento).

### 3. Triangulação (anti-viés do gestor único)

Cada avaliação 9 Box passa a ter até 3 fontes ponderadas:

- **Auto-avaliação** do colaborador (peso 20%)
- **Gestor direto** (peso 60%)
- **Par/skip-level** opcional (peso 20%)

Quando só o gestor avaliou, o sistema mostra um **selo "Avaliação unilateral"** e desconta confiabilidade no card.

### 4. Calibração (workflow obrigatório antes de virar oficial)

Toda avaliação nasce em status `**rascunho**` → vai para `**em_calibração**` (revisão por RH ou gestor do gestor) → `**calibrada**` → `**liberada para colaborador**`.

Na tela de calibração:

- Visão consolidada do time inteiro do gestor
- **Detector de viés**: alerta quando >60% do time está em quadrantes 8/9 (inflação) ou >50% em 1/2 (deflação)
- Distribuição forçada sugerida (ex.: máx 20% no Q9)
- Histórico de notas anteriores do colaborador (evita salto sem justificativa)
- Comparação com percentual de atingimento BSC e PDI

### 5. Auditoria e versionamento

- Toda avaliação salva snapshot dos critérios, pesos, evidências e quem calibrou.
- Reabrir uma avaliação cria nova versão; histórico fica imutável.
- Log de quem viu/alterou/liberou.

---

## Detalhes técnicos

### Banco

Novas tabelas (migration):

- `hr_9box_criteria_templates` — rubrica padrão e por organização (critério, dimensão `desempenho`/`potencial`, peso, âncoras 1–5).
- `hr_9box_evaluation_scores` — 1 linha por critério avaliado (evaluation_id, criterio_id, fonte `auto`/`gestor`/`par`, nota 1–5, evidência texto, evidência URL).
- `hr_9box_evaluation_sources` — quem avaliou (auto/gestor/par), peso, status individual.
- `hr_9box_calibration_log` — quem calibrou, quando, mudança aplicada, observação.

Em `hr_9box_evaluations`, adicionar:

- `status` enum: `rascunho` | `em_calibracao` | `calibrada` | `liberada`
- `confiabilidade` numeric (0–100) — derivado de quantas fontes responderam + cobertura de evidências
- `versao` int e `evaluation_pai_id` (versionamento)
- `viés_detectado` jsonb (snapshot dos alertas no momento do salvamento)

Trigger `compute_9box_quadrante` reescrito para **recalcular nota_desempenho/nota_potencial a partir da média ponderada dos critérios e fontes**, em vez de usar o valor cru digitado.

RLS: avaliação só fica visível ao colaborador quando `status = 'liberada'`.

### Backend / lógica pura

- `src/lib/performance/scoring.ts` — funções puras: `weightedScore(criteria[])`, `triangulate(sources[])`, `confidenceScore(evaluation)`, `detectBias(teamEvaluations[])`.
- Testes unitários cobrindo cada função.

### Frontend

- **Substituir** `NineBoxDialog` por um wizard focado (padrão `focused-wizard`) em 4 passos colapsáveis:
  1. Selecionar colaborador + fontes que vão avaliar
  2. Avaliar critérios de desempenho (sliders + âncoras + evidências)
  3. Avaliar critérios de potencial (idem)
  4. Revisão: quadrante calculado + confiabilidade + envio para calibração
- Nova **aba "Calibração"** dentro de 9 Box, visível só para RH/gestor do gestor, com a matriz do time + detector de viés + ações em massa.
- Nova **tela de configuração de rubrica** em Configurações → Desempenho, para o RH ajustar critérios, pesos e âncoras.
- Cards do quadrante passam a exibir **badge de confiabilidade** (Alta/Média/Baixa) e ícone de status (rascunho/em calibração/calibrada/liberada).

### Integração com módulos existentes

- BSC: critério "Entrega de resultados" puxa automaticamente `resultado_geral` do BSC ativo do colaborador (já existe `bsc_score_snapshot`).
- PDI: ao concluir avaliação calibrada, sugere automaticamente criar/atualizar PDI quando quadrante ∈ {1, 2, 4, 7}.
- Sucessão: quadrantes 8/9 calibrados marcam `indicacao_sucessao = true` automaticamente.

---

## O que NÃO muda

- Conceito dos 9 quadrantes e regras de faixa (1-2 baixo / 3 médio / 4-5 alto) em `quadrante.ts`.
- Visual da matriz 3x3 e cores por tom semântico.
- Hook `useNineBox` (apenas estendido).

---

## Entregáveis (ordem de execução)

1. Migration (tabelas, enum status, colunas novas, RLS, trigger atualizado).
2. `src/lib/performance/scoring.ts` + testes.
3. Hooks: `useNineBoxCriteria`, `useNineBoxScores`, `useNineBoxCalibration`.
4. Wizard substituindo `NineBoxDialog`.
5. Aba "Calibração" + detector de viés.
6. Configuração de rubrica em Configurações.
7. Atualização da matriz visual com badges de confiabilidade/status.
8. Atualização de `mem://features/...` documentando a nova lógica.

---

## Pontos para você decidir antes de eu implementar

1. **Rubrica padrão:** uso a sugerida acima ou prefere que eu apenas crie a estrutura e o RH preenche do zero?
2. **Triangulação:** já entrego com auto-avaliação + par opcional, ou começo só com gestor + 1 calibrador (mais simples) e deixo par/auto para fase 2?
3. **Distribuição forçada:** aplico só como **alerta** (recomendado) ou como **trava dura** (impede salvar se passar do %)?
4. **Visibilidade ao colaborador:** mantenho o flag `liberado_para_colaborador` manual, ou libero automaticamente após calibração?