

## Revisão completa do módulo DP — melhorias e exportações

Análise do módulo atual identificou pontos fortes (cálculo de encargos, rescisão com simulador, integração com cashflow e planejamento de RH, propagação Holding) e lacunas relevantes para um módulo DP de cockpit financeiro. Abaixo, o plano organizado por **camadas de prioridade**, todas opcionais — você pode aprovar tudo ou apenas as fases que fizerem sentido.

---

### O que existe hoje
- **Dashboard** com KPIs (headcount, folha bruta, encargos, custo médio) e cards de VT/VA/Saúde.
- **Colaboradores** com cadastro, comissão, VT, vínculo de benefícios e desligamento via simulador.
- **Folha** mensal com cálculo de INSS/IRRF/VT e fechamento (lock).
- **Férias/13º** com provisões e prazos legais.
- **Rescisões** com simulador, integração com planejamento e materialização em cashflow.
- **Encargos** com detalhamento por colaborador (INSS patronal, RAT, FGTS, terceiros).
- **Cargos & Rotinas** com organograma e SLA das rotinas.
- **Benefícios** cadastrados e atribuídos por colaborador.
- **Configurações** com Encargos, Provisionamentos, Descontos, propagação para subsidiárias.

### O que falta (lacunas identificadas)
- Nenhuma exportação de relatório (PDF/Excel/CSV).
- Sem holerite/recibo individual do colaborador.
- Sem dossiê do colaborador (anexos: contrato, RG, CPF, CTPS, exames).
- Sem eventos variáveis de folha (horas extras, faltas, adicionais, descontos pontuais).
- Sem absenteísmo / banco de horas.
- Sem dissídio coletivo / reajuste em massa.
- Sem aniversariantes, tempo de casa, aniversário de admissão.
- Sem importação em lote de colaboradores (CSV/XLSX).
- Sem alertas proativos (férias vencendo, exames a renovar, contratos de experiência expirando).
- Sem comparativo histórico (folha mês vs mês, headcount evolução).
- Integração com Tarefas para rotinas existe, mas sem visão consolidada de pendências do DP no Dashboard.

---

## Fase 1 — Exportação de relatórios (foco do pedido)

Adicionar exportação **PDF executivo** e **Excel detalhado** em pontos-chave do módulo, reutilizando `jsPDF + jspdf-autotable` (já no projeto) e `xlsx` (já no projeto via `useFinanceiroImport`).

**Relatórios disponíveis:**

| Relatório | PDF | Excel | Origem |
|---|---|---|---|
| **Folha de pagamento** (resumo + analítico por colaborador) | ✅ | ✅ | aba Folha, por `payroll_run` |
| **Holerite individual** (contracheque PDF) | ✅ | — | aba Folha, item selecionado |
| **Encargos sociais** (mensal por colaborador) | ✅ | ✅ | aba Encargos |
| **Provisões de Férias e 13º** | ✅ | ✅ | aba Férias |
| **Rescisões** (período) com totais e multa FGTS | ✅ | ✅ | aba Rescisões |
| **Headcount e custos por CC** | ✅ | ✅ | Dashboard |
| **Lista de colaboradores** (cadastro completo) | — | ✅ | aba Colaboradores |
| **Benefícios atribuídos** (matriz colaborador × benefício) | — | ✅ | aba Benefícios |

**Onde aparece:** botão **"Exportar"** no canto superior direito de cada aba (dropdown PDF/Excel). Holerite individual: ícone de download na linha do colaborador na aba Folha.

**Padrão visual do PDF:** cabeçalho com nome da empresa, período, logo placeholder; rodapé com "Gerado por Colli FinCore — DD/MM/AAAA HH:mm"; tabelas com zebra striping; resumo executivo no topo (totais).

---

## Fase 2 — Dossiê e ciclo de vida do colaborador

**a) Dossiê do colaborador (drawer lateral)**
Ao clicar no nome do colaborador, abrir drawer com 4 abas:
- **Dados** — cadastrais + cargo + CC.
- **Histórico de salário** — usa `employee_compensations` (já existe, mas sem UI de visualização).
- **Documentos** — upload de RG, CPF, CTPS, contrato, exames admissional/periódico (Storage bucket `employee-documents` com isolamento por org).
- **Histórico de folha** — todas as folhas em que apareceu, com link para o holerite.

**b) Eventos variáveis de folha**
Nova tabela `payroll_events` (employee_id, payroll_run_id, type, description, value, signal +/−).
Tipos: hora extra 50%, hora extra 100%, adicional noturno, faltas, atrasos, desconto pontual, bônus, comissão variável.
UI: dentro do detalhe da folha, botão "+ Lançamento variável" que entra no cálculo do líquido.

**c) Reajuste em massa (dissídio)**
Modal "Aplicar reajuste" filtrando por cargo/CC, aplicando % ou valor fixo. Cria automaticamente registros em `employee_compensations` com motivo = "dissídio".

---

## Fase 3 — Inteligência e alertas

**a) Painel de pendências DP no Dashboard:**
- Férias vencendo nos próximos 30/60 dias (já calculado, falta destaque).
- Contratos de experiência (45/90 dias) expirando.
- Exames periódicos vencidos (depende da Fase 2 — documentos com data).
- Aniversariantes do mês + aniversário de admissão.
- Folhas pendentes de fechamento.

**b) Comparativos históricos:**
- Gráfico "Evolução da folha bruta" (últimos 12 meses).
- Gráfico "Evolução do headcount" (admitidos vs desligados por mês).
- Card "Turnover anualizado" (desligamentos / headcount médio).

**c) Importação em lote de colaboradores:**
Reaproveitar o padrão `ImportDialog` do Financeiro (CSV/XLSX → mapeamento IA → preview → confirmar). Coluna obrigatória: nome, CPF, admissão, salário.

---

## Fase 4 — Integrações (melhorias nas existentes)

| Integração | Status atual | Melhoria proposta |
|---|---|---|
| **Cashflow** (rescisões) | OK, materializa via `dedup_hash` | Estender para folha mensal: ao **fechar** uma `payroll_run`, materializar 1 entry por sub_category (já existe lógica em `usePayrollProjections` — falta o "promote to real"). |
| **Planejamento RH** | OK (rescisão fecha ciclo) | Estender: admissões planejadas → quando colaborador for cadastrado a partir de um item, marcar `hr_planning_item` como executado. |
| **Tarefas** (rotinas DP) | OK | Adicionar widget "Rotinas DP de hoje" no Dashboard do DP (atualmente só aparece em Tarefas). |
| **Centros de Custo** | OK | Adicionar visão "DRE de pessoal por CC" (rateio quando colaborador atende +1 CC). |
| **Contratos** | Ligação `contract_id` existe na tabela `employees` mas **não tem UI** | Selector de contrato no cadastro do colaborador — útil para terceirizados/PJ ligados a um contrato de prestação. |

---

## Sugestão de priorização

Para não comprometer o cronograma, sugiro **3 sprints**:

1. **Sprint 1 (foco do pedido):** Fase 1 completa — todos os exports.
2. **Sprint 2:** Fase 3 (alertas, comparativos, importação em lote) + Fase 4 (widget de rotinas no Dashboard, link de contrato).
3. **Sprint 3:** Fase 2 (dossiê + eventos variáveis + dissídio) — maior, demanda novas tabelas e Storage.

---

## Decisão necessária

Para eu começar, escolha o escopo:

- **(A)** Apenas Fase 1 — exportações de relatórios (recomendo começar por aqui).
- **(B)** Fase 1 + Fase 3 (exports + alertas/comparativos/importação).
- **(C)** Tudo (Fases 1 a 4) em sprints sequenciais.
- **(D)** Outro recorte — me diga quais itens da lista priorizar.

Sem mudanças destrutivas em qualquer fase: novas tabelas e colunas são aditivas; UI nova convive com a existente; integrações respeitam o padrão MECE de materialização (sem duplicatas).

