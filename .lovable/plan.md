

# Varredura do Módulo Planejamento — Limpeza Visual e Mapa de Integrações

## Diagnóstico

O módulo Planejamento tem **8 abas paralelas** (Visão Geral, Orçamento, Cenários, Plan×Real, Liquidez, Passivos, RH, Comercial), causando sobrecarga cognitiva. O conteúdo é poderoso, mas a navegação é "horizontal demais", duplicações existem (KPI de runway aparece em 3 lugares com cálculos próprios), e várias integrações com outros módulos estão **subutilizadas ou implícitas**.

### Problemas identificados

1. **Sobreposição de KPIs e conceitos** — Runway, Saldo Mínimo, Burn Mensal e Custo Folha aparecem em Visão Geral, Liquidez, Passivos e Dashboard com cálculos próprios em cada lugar (risco de divergência numérica entre telas).
2. **Aba "Liquidez" é só configuração** — apenas três inputs (saldo mínimo / colchão / alerta runway). Não justifica uma aba dedicada — pertence a Configurações do módulo.
3. **Cenários não materializam impacto** — variações de receita/custo são aplicadas apenas no gráfico de saldo líquido, sem propagar para Orçamento, Plan×Real, RH, Passivos.
4. **Plan×Real só compara orçamento vs. realizado** — não considera contratos projetados, folha projetada, nem CRM ponderado.
5. **Comercial é uma "ilha"** — tem orçamento próprio, cenários próprios, sem cruzamento com o orçamento principal nem com CRM real.
6. **Passivos está descontextualizado** — KPIs aparecem mas não impactam o gráfico de cenários nem o runway.
7. **Filtro de horizonte global** muda KPIs mas em algumas abas (Liquidez, Passivos) não tem efeito visual.

---

## Proposta — Reorganização em 4 Abas + Configurações

```text
ANTES (8 abas):
Visão Geral | Orçamento | Cenários | Plan×Real | Liquidez | Passivos | RH | Comercial

DEPOIS (4 abas + ícone de configuração):
Cockpit | Orçamento & Realizado | Cenários & Risco | Operacional        ⚙ Config
```

### Aba 1 — Cockpit (substitui Visão Geral)

Visão consolidada e única fonte de verdade dos KPIs, hierarquia executiva CFO-first:
- Linha topo (4 KPIs principais): Saldo Projetado · Runway · Burn Mensal · Receita Projetada × Despesa Projetada
- Mini-cards secundários: Custo Folha/mês · Contratos Ativos · Passivos Total · Pipeline Ponderado (CRM)
- Gráfico unificado: barras Entradas/Saídas + linha Saldo Acumulado + linha tracejada do Saldo Mínimo
- Lista de alertas (vinda de `useFinancialSummary` — já existe)

### Aba 2 — Orçamento & Realizado (funde Orçamento + Plan×Real)

- Topo: seletor de versão de orçamento + status (Rascunho/Aprovado/Arquivado)
- Sub-abas internas leves (`Tabs`): "Linhas do Orçamento" | "Comparativo Plan×Real"
- O comparativo passa a incluir 3 séries: **Orçado · Realizado · Projetado** (somando contratos recorrentes + folha + projeções de CRM ganho)
- Quando não há orçamento, mostra estado vazio com CTA para criar ou importar do anterior

### Aba 3 — Cenários & Risco (funde Cenários + Passivos)

- Bloco superior: seletor de cenários ativos (Base/Otimista/Conservador/Stress) com cards compactos
- Bloco inferior: **Passivos** apresentados como contribuintes ao stress (não como tabela isolada). Cada passivo "ativo" ou "judicial" alimenta automaticamente o cenário Stress via `impacto_stress`
- Gráfico único: linhas de saldo por cenário **+ banda de risco de passivos**
- Tabela colapsável com lista de passivos, KPIs (Total · Dívidas · Contingências Prováveis · Exposição Stress · Contas a Pagar)

### Aba 4 — Operacional (funde RH + Comercial)

- Sub-abas internas: "Planejamento RH" | "Plano Comercial"
- Mantém funcionalidades atuais sem perda
- Adiciona no topo de cada sub-aba uma linha de "impacto no caixa" que conecta com o Cockpit (ex: "Headcount adicional → +R$ X/mês no burn")

### Configurações (botão ⚙ ao lado do filtro de horizonte)

- Recebe a antiga aba "Liquidez": Saldo Mínimo · Colchão · Alerta Runway
- Adiciona "Importar do realizado": botão para gerar primeira versão de orçamento usando média dos últimos 12 meses (acelera entrada de dados)

---

## Limpeza Visual

- **Padronizar cards de KPI** em uma altura única e ícones consistentes (atualmente alguns cards usam `glass-card` direto, outros usam `KPICard`)
- **Reduzir o número de cards exibidos simultaneamente** nas grids de cenário (atualmente 4 cards horizontais ficam apertados em telas médias) — usar grid 2×2 quando ≥3 cenários ativos
- **Remover redundância visual**: badges "+X% rec" no toggle de cenário + KPI no card de cenário mostram a mesma info — manter só um
- **Filtro de horizonte fixo no topo** (sticky) para não perder ao rolar
- **Mensagens de estado vazio** unificadas (ícone + título + CTA), substituindo as várias variações atuais

---

## Mapa de Integrações Financeiro & Planejamento × Outros Módulos

```text
                     ┌───────────────────────────────┐
                     │   Plano de Contas (estrutura) │
                     │   Centros de Custo            │
                     └───────────────┬───────────────┘
                                     │ classifica
                                     ▼
┌──────────┐   gera projeção   ┌──────────────┐   alimenta   ┌─────────────┐
│Contratos │ ────────────────► │ cashflow_    │ ───────────► │ Financeiro  │
│ (recorr.)│                   │ entries      │              │ (AP/AR)     │
└──────────┘                   │ + virtuais   │              └─────────────┘
                               │ proj-*       │                     │
┌──────────┐   gera projeção   │              │                     │
│   DP     │ ────────────────► │              │                     │
│ (folha)  │                   │              │                     │
└──────────┘                   └──────┬───────┘                     │
                                      │                             │
┌──────────┐   pondera           ┌────▼──────┐    consome     ┌─────▼──────┐
│   CRM    │ ──────────────────►│ Cockpit   │◄──────────────│Conciliação │
│(pipeline)│   ganho → contrato  │  /        │                └────────────┘
└──────────┘                     │ Cenários  │                ┌─────────────┐
                                 │           │◄───────────────│Fluxo Caixa  │
┌──────────┐   alimenta stress   │           │                └─────────────┘
│ Passivos │ ───────────────────►│           │
│(div/cont)│                     └───────────┘
└──────────┘                          ▲
                                      │ versão de orçamento
                              ┌───────┴────────┐
                              │  Orçamento     │
                              │ (budget_lines) │
                              └────────────────┘

Tarefas/Solicitações ──► gera lançamento financeiro (ExpenseRequest aprovado)
Backoffice          ──► define visibilidade de abas/módulos
Holding             ──► consolida métricas de subsidiárias no Cockpit
```

### Integrações já existentes (ativas)
- Contratos recorrentes → projeções no `cashflow_entries` (virtuais `proj-`)
- DP → projeções de folha mensal via `usePayrollProjections`
- CRM → pipeline ponderado em `useFinancialSummary` (Dashboard) e oportunidades ganhas geram contrato
- Passivos → KPI de Contas a Pagar via `useFinanceiro("saida")`
- Solicitações de despesa → lançamento financeiro após aprovação

### Integrações ausentes ou fracas (a fortalecer)
1. **Cenários × Passivos** — `impacto_stress` dos passivos não é aplicado ao cenário Stress; passa a entrar como ajuste adicional de saídas
2. **Cenários × Orçamento** — variação de cenário não recalcula linhas do orçamento; adicionar visualização "orçamento sob cenário X"
3. **Plan×Real × Projeções** — comparativo só usa orçamento e realizado; adicionar série "Projetado" (contratos + folha + CRM ponderado)
4. **Comercial × CRM** — plano comercial define metas, mas não compara com pipeline real do CRM; adicionar widget "Pipeline real vs. meta de receita"
5. **Comercial × Orçamento principal** — orçamento comercial fica isolado; adicionar opção "consolidar no orçamento principal" ao aprovar plano
6. **Tarefas × Planejamento** — itens de planejamento RH (contratações futuras) não geram tarefa no calendário do RH; adicionar trigger
7. **Onboarding × Planejamento** — diagnóstico de maturidade do onboarding não direciona o usuário para configurar Saldo Mínimo / Cenários quando o score é baixo nessa seção

---

## Arquivos Envolvidos

### Reestruturação visual
- `src/pages/Planejamento.tsx` — reduzir de 8 para 4 abas + botão de configurações
- `src/components/planning/PlanningOverview.tsx` → renomear para `PlanningCockpit.tsx` e absorver KPIs adicionais
- `src/components/planning/BudgetTab.tsx` + `PlannedVsActual.tsx` → fundir em `PlanningBudget.tsx` com sub-abas internas
- `src/components/planning/PlanningScenarios.tsx` + `PlanningLiabilities.tsx` → fundir em `PlanningScenariosRisk.tsx`
- `src/components/planning/PlanningHR.tsx` + `PlanningCommercial.tsx` → manter arquivos, expor via aba "Operacional" com sub-abas
- `src/components/planning/PlanningLiquidity.tsx` → mover para um `PlanningSettingsDialog.tsx` acionado pelo botão ⚙
- Ajustes de grid/spacing conforme princípios de limpeza visual

### Novas integrações
- `src/hooks/useFinancialSummary.ts` — adicionar série "projetado" (somar contratos+folha+CRM)
- `src/components/planning/PlanningScenariosRisk.tsx` — aplicar `impacto_stress` dos passivos no cenário Stress
- `src/components/planning/PlanningCommercial.tsx` — novo widget "Pipeline real vs. meta" usando `useCRMOpportunities`
- `src/hooks/useCommercialPlanning.ts` — flag de "consolidação" para refletir no orçamento principal

### Sem migrações SQL
Nenhuma alteração no schema. Toda a refatoração reaproveita tabelas e hooks existentes.

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 8 abas, sobrecarga visual | 4 abas + ⚙ Configurações |
| KPIs duplicados em 3 telas | Cockpit como fonte única |
| Cenários só no gráfico | Cenários propagam em orçamento + passivos |
| Plan×Real ignora projeções | Plan×Real inclui Orçado/Realizado/Projetado |
| Comercial isolado | Comercial conectado a CRM real e orçamento principal |
| Passivos como tabela solta | Passivos como vetor de risco no cenário Stress |

