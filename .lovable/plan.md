

# Atualizar Diagnóstico Completo — DB + Fallback + Score 100pts

## Situação Atual

O banco de dados (step 1 em `onboarding_step_config`) contém perguntas antigas em todas as 4 seções. O fallback no código também está incompleto para Maturidade, Sistema e Tecnologia. Ambos precisam ser atualizados simultaneamente.

## Distribuição de Pontuação (100 pontos total)

```text
Estrutura Societária ........... 20 pts
Maturidade Financeira .......... 40 pts  (4 subseções)
Sistema Financeiro ............. 25 pts
Tecnologia ..................... 15 pts
─────────────────────────────────────────
Total ......................... 100 pts
```

## Mudanças Necessárias

### 1. Atualizar registro no banco (`onboarding_step_config` step 1)

Usar a ferramenta de inserção/update para substituir o JSON `config` com todas as perguntas detalhadas:

**Estrutura (20 pts)** — 9 perguntas já definidas (faturamento, segmento, sócios, distribuição, responsável, cargo, equipe, bancos, contas bancárias). Sem mudança nas perguntas, apenas garantir que os pontos somem até ~20.

**Maturidade Financeira (40 pts)** — 10 perguntas em 4 subseções:
- Controle de Caixa: fluxo de caixa (0-3), projeção (0-3), DRE gerencial (0-3), análise pela gestão (0-3)
- Gestão de Despesas: classificação (0-3), centro de custo (0-2)
- Gestão de Receitas: previsibilidade (0-2), monitoramento recorrente (0-2)
- Gestão de Inadimplência: existência (0-3), sentimento (0-2)

**Sistema Financeiro (25 pts)** — 5 perguntas:
- Usa ERP (0-2), qual ERP (condicional, 0 pts — contextual), contas a pagar (0-3), contas a receber (0-3), conciliação bancária (0-4)

**Tecnologia (15 pts)** — 4 perguntas:
- Importação extratos (0-2), integração entre sistemas (0-3), dashboard (0-3), indicadores (0-2)

**Thresholds de maturidade** recalibrados para escala 0-100:
- Nível 1 (0-20): Controle básico
- Nível 2 (21-40): Financeiro estruturado
- Nível 3 (41-60): Controladoria
- Nível 4 (61-80): Governança financeira
- Nível 5 (81-100): Gestão orientada por dados

### 2. Atualizar `Step1Diagnostico.tsx`

- Atualizar `FALLBACK_SECTIONS` para espelhar exatamente o novo JSON do banco (as 4 seções completas com todas as perguntas)
- Atualizar `FALLBACK_THRESHOLDS` para escala 0-100
- Adicionar lógica condicional para "Qual ERP?" (condicional: `usa_erp === "sim"`)
- Atualizar `COMPLEXITY_THRESHOLDS` por seção com ranges proporcionais ao peso de cada seção
- Exibir score individual por seção **e** score total consolidado no card final

### 3. Atualizar `OnboardingConfigTab.tsx`

- Nenhuma mudança estrutural necessária — o editor já suporta `type`, `conditional`, e `complexity_thresholds`
- Os novos dados aparecerão automaticamente quando o banco for atualizado

## Problemas Potenciais

1. **Respostas antigas incompatíveis**: Usuários que já responderam o diagnóstico antigo terão keys que não existem mais (`num_empresas`, `tem_holding`, etc.). O código já ignora keys desconhecidas, então não quebra — mas o progresso anterior será "resetado" visualmente.

2. **Score desbalanceado na Estrutura**: A pergunta `qtd_contas_bancarias` (number_input) pode gerar pontuação muito alta sozinha (ex: 15 contas = 25 pts). Precisamos ajustar o cap dessa pergunta ou redistribuir os pontos da seção Estrutura para que o total real fique próximo de 20.

3. **Thresholds por seção vs global**: O `COMPLEXITY_THRESHOLDS` atual é genérico (0-3, 4-6, 7-9, 10+). Com pesos diferentes por seção (20, 40, 25, 15), cada seção precisa de thresholds proporcionais — ou usamos percentual (0-25%, 25-50%, 50-75%, 75-100% do máximo da seção).

4. **Tipo `select_input` para ERP**: A pergunta "Qual ERP?" precisa de um tipo `select_input` (lista de opções + campo "Outro"). O componente já suporta esse tipo.

## Arquivos Afetados

- **Banco de dados**: UPDATE no registro `onboarding_step_config` onde `step_number = 1`
- **`src/components/onboarding-guiado/Step1Diagnostico.tsx`**: Fallback sections, thresholds, e lógica de score por seção
- **`.lovable/plan.md`**: Atualizar documentação do diagnóstico

