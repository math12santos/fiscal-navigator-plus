

# Reestruturar Regras de Aglutinação — Cobertura Completa

## Problema

As regras template atuais (`ruleTemplates.ts`) são genéricas demais. Exemplo: a regra "Folha de Pagamento" captura tudo com `source=dp` num único grupo, misturando salários, encargos (FGTS, INSS, IRRF), benefícios e provisões. Os demais macrogrupos também têm regras vagas baseadas apenas em keywords de descrição, sem aproveitar campos estruturados como `dp_sub_category`, `source`, `categoria`, ou `natureza_financeira` dos contratos.

## Escopo

1. **Reescrever `src/data/ruleTemplates.ts`** — regras precisas para todos os 10 macrogrupos e seus grupos
2. **Adicionar "Provisões" ao seed** em `src/hooks/useGroupingMacrogroups.ts`
3. **Adicionar `dp_sub_category`** como match field disponível em `src/hooks/useGroupingRules.ts`
4. **Atualizar DEFAULT_RULES** fallback — substituir a regra genérica `source=dp`
5. **Aging List** — filtrar para exibir apenas vencidos + a vencer até 30 dias (remover bucket "Futuro > 30d" da tabela de detalhes)

## Design das Regras por Macrogrupo

### 1. Pessoal e RH (+ novo grupo "Provisões")
| Grupo | match_field | operator | match_value | Prio |
|---|---|---|---|---|
| Folha | dp_sub_category | equals | salario_liquido | 25 |
| Encargos | dp_sub_category | in_list | encargos_fgts,encargos_inss,encargos_irrf | 24 |
| VT | dp_sub_category | equals | vt | 23 |
| Benefícios | dp_sub_category | equals | beneficios | 22 |
| Provisões | dp_sub_category | equals | provisoes | 21 |
| Pró-labore | descricao | contains | (keyword) pro-labore,pró-labore,prolabore | 18 |
| Férias | descricao | contains | (keyword) férias,ferias | 13 |
| 13º Salário | descricao | contains | (keyword) 13o,13º,décimo terceiro | 13 |
| Rescisões | descricao | contains | (keyword) rescisão,rescisao,multa rescisória | 12 |
| RPA | descricao | contains | (keyword) rpa,autônomo,recibo pagamento | 11 |

### 2. Infraestrutura
Mantém regras por keyword na descrição (aluguel, condomínio, água, energia, etc.) — sem alterações significativas, apenas revisão de prioridades para evitar conflitos.

### 3. Tecnologia e Sistemas
Mantém regras por keyword (saas, software, aws, azure, etc.) — sem alterações.

### 4. Fornecedores Operacionais
| Grupo | match_field | operator | match_value/keyword | Prio |
|---|---|---|---|---|
| Materiais | descricao | contains | material,insumo,matéria-prima | 12 |
| Logística | descricao | contains | frete,transporte,correios,logística,sedex | 12 |
| Suprimentos | descricao | contains | suprimento,estoque,reposição | 11 |

### 5. Serviços Profissionais
Mantém regras por keyword — adicionar "Auditoria":
| Grupo | match_field | operator | match_value/keyword | Prio |
|---|---|---|---|---|
| Auditoria | descricao | contains | auditoria,audit | 13 |

### 6. Contratos
| Grupo | match_field | operator | match_value | Prio |
|---|---|---|---|---|
| Contratos Recorrentes | source | equals | contrato | 10 |
| Contratos Pontuais | (sem regra automática — requer classificação manual) | — | — | — |

### 7. Tributário
Mantém regras por keyword (irpj, csll, icms, iss, etc.) — adicionar "Parcelamentos":
| Grupo | match_field | operator | match_value/keyword | Prio |
|---|---|---|---|---|
| Parcelamentos | descricao | contains | parcelamento,refis,pert,programa especial | 10 |

### 8. Financeiro
Mantém regras existentes + adicionar "IOF":
| Grupo | match_field | operator | match_value/keyword | Prio |
|---|---|---|---|---|
| IOF | descricao | contains | iof,imposto operações financeiras | 10 |

### 9. Patrimonial / Investimentos
| Grupo | match_field | operator | match_value/keyword | Prio |
|---|---|---|---|---|
| Investimentos | descricao | contains | investimento,aplicação,cdb,lci,lca,fundo | 10 |
| Amortização | descricao | contains | amortização,amortizacao,parcela empréstimo | 10 |
| Depreciação | descricao | contains | depreciação,depreciacao | 8 |

### 10. Despesas Eventuais
Mantém regras existentes + adicionar "Eventos":
| Grupo | match_field | operator | match_value/keyword | Prio |
|---|---|---|---|---|
| Eventos | descricao | contains | evento,confraternização,workshop,treinamento | 8 |

## Alterações no Aging List

No `AgingListTab.tsx`, remover o bucket "Futuro > 30d" da tabela de detalhes (index 7). Os cards de resumo podem continuar mostrando o total futuro, mas a tabela detalhada fica limitada a vencidos + a vencer em até 30 dias.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/data/ruleTemplates.ts` | Reescrever todas as regras com lógica granular |
| `src/hooks/useGroupingMacrogroups.ts` | Adicionar "Provisões" ao seed de Pessoal e RH |
| `src/hooks/useGroupingRules.ts` | Adicionar `dp_sub_category` aos match fields + atualizar DEFAULT_RULES |
| `src/components/financeiro/AgingListTab.tsx` | Filtrar tabela de detalhes para vencidos + a vencer ≤30d |

