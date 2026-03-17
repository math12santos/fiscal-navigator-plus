/**
 * Static rule templates mapped to group names from DEFAULT_SEED.
 * Each template defines a rule that can be auto-created when the corresponding group exists.
 *
 * Design principles:
 * - Structured fields (dp_sub_category, source) take priority over keyword matching
 * - Keyword rules act as fallback for manual entries without structured metadata
 * - Higher priority = evaluated first; structured rules always outrank keyword rules
 */
export interface RuleTemplate {
  /** Must match a group name from DEFAULT_SEED */
  groupName: string;
  ruleName: string;
  match_field: string;
  operator: string;
  match_value: string;
  match_keyword: string | null;
  sub_group_field: string | null;
  min_items: number;
  priority: number;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  // ═══════════════════════════════════════════════════════
  // 1. PESSOAL E RH
  //    Structured rules via dp_sub_category (from payroll projection engine)
  //    Keyword rules as fallback for manual entries
  // ═══════════════════════════════════════════════════════

  // ── Structured (dp_sub_category) — high priority ──
  { groupName: "Folha", ruleName: "Salário Líquido (DP)", match_field: "dp_sub_category", operator: "equals", match_value: "salario_liquido", match_keyword: null, sub_group_field: null, min_items: 1, priority: 25 },
  { groupName: "Encargos", ruleName: "Encargos Sociais (DP)", match_field: "dp_sub_category", operator: "in_list", match_value: "encargos_fgts,encargos_inss,encargos_irrf", match_keyword: null, sub_group_field: null, min_items: 1, priority: 24 },
  { groupName: "VT", ruleName: "Vale Transporte (DP)", match_field: "dp_sub_category", operator: "equals", match_value: "vt", match_keyword: null, sub_group_field: null, min_items: 1, priority: 23 },
  { groupName: "Benefícios", ruleName: "Benefícios (DP)", match_field: "dp_sub_category", operator: "equals", match_value: "beneficios", match_keyword: null, sub_group_field: null, min_items: 1, priority: 22 },
  { groupName: "Provisões", ruleName: "Provisões (DP)", match_field: "dp_sub_category", operator: "equals", match_value: "provisoes", match_keyword: null, sub_group_field: null, min_items: 1, priority: 21 },

  // ── Keyword fallback — lower priority ──
  { groupName: "Folha", ruleName: "Folha (descrição)", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "folha de pagamento,salário líquido,salario liquido,holerite", sub_group_field: null, min_items: 1, priority: 15 },
  { groupName: "Pró-labore", ruleName: "Pró-labore (descrição)", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "pro-labore,pró-labore,prolabore", sub_group_field: null, min_items: 1, priority: 18 },
  { groupName: "Encargos", ruleName: "Encargos (descrição)", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "inss,fgts,gps,darf previdenciário,contribuição previdenciária,encargos trabalhistas,irrf folha", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Benefícios", ruleName: "Benefícios (descrição)", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "plano de saúde,plano saude,vale refeição,vale alimentação,vr,va,assistência médica,odontológico", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "VT", ruleName: "Vale Transporte (descrição)", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "vale transporte,vt,bilhete único,passagem", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "Férias", ruleName: "Férias (descrição)", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "férias,ferias,pagamento férias", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "13º Salário", ruleName: "13º Salário (descrição)", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "13o,13º,décimo terceiro,decimo terceiro", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "Rescisões", ruleName: "Rescisões (descrição)", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "rescisão,rescisao,multa rescisória,verbas rescisórias,aviso prévio", sub_group_field: null, min_items: 1, priority: 12 },
  { groupName: "RPA", ruleName: "RPA / Autônomos (descrição)", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "rpa,recibo pagamento autônomo,autônomo,prestador pf", sub_group_field: null, min_items: 1, priority: 11 },

  // ═══════════════════════════════════════════════════════
  // 2. INFRAESTRUTURA
  //    Keyword matching on description — occupancy & utilities
  // ═══════════════════════════════════════════════════════
  { groupName: "Aluguel", ruleName: "Aluguel", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "aluguel,locação,locacao,aluguer", sub_group_field: null, min_items: 1, priority: 15 },
  { groupName: "Condomínio", ruleName: "Condomínio", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "condomínio,condominio,cond.,taxa condominial", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Água", ruleName: "Água e Esgoto", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "sabesp,copasa,sanepar,água,esgoto,saneamento,compesa,cagece", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Energia", ruleName: "Energia Elétrica", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "cpfl,cemig,enel,eletropaulo,light,energia elétrica,celesc,copel,coelba,equatorial", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Internet", ruleName: "Internet / Banda Larga", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "internet,banda larga,fibra,vivo fibra,net virtua,claro internet", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "Telefonia", ruleName: "Telefonia", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "telefone,telefonia,vivo móvel,claro móvel,tim,oi móvel", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "Limpeza", ruleName: "Limpeza e Conservação", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "limpeza,conservação,faxina,zeladoria,higienização", sub_group_field: null, min_items: 1, priority: 12 },

  // ═══════════════════════════════════════════════════════
  // 3. TECNOLOGIA E SISTEMAS
  //    Keyword matching — software licenses, cloud, IT support
  // ═══════════════════════════════════════════════════════
  { groupName: "Software/SaaS", ruleName: "Software e SaaS", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "saas,software,licença software,assinatura,microsoft 365,google workspace,adobe,zoom,slack,hubspot,salesforce", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Hospedagem/Cloud", ruleName: "Hospedagem e Cloud", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "aws,azure,google cloud,hospedagem,servidor,cloud,digitalocean,heroku,vercel,netlify", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "Suporte TI", ruleName: "Suporte de TI", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "suporte ti,manutenção ti,helpdesk,service desk,suporte técnico", sub_group_field: null, min_items: 1, priority: 12 },

  // ═══════════════════════════════════════════════════════
  // 4. FORNECEDORES OPERACIONAIS
  //    Keyword matching — materials, logistics, supplies
  // ═══════════════════════════════════════════════════════
  { groupName: "Materiais", ruleName: "Materiais e Insumos", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "material,insumo,matéria-prima,materia prima,material de escritório,material escritorio", sub_group_field: null, min_items: 1, priority: 12 },
  { groupName: "Logística", ruleName: "Logística e Frete", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "frete,transporte,correios,logística,sedex,transportadora,envio,remessa", sub_group_field: null, min_items: 1, priority: 12 },
  { groupName: "Suprimentos", ruleName: "Suprimentos e Estoque", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "suprimento,estoque,reposição,almoxarifado,compra recorrente", sub_group_field: null, min_items: 1, priority: 11 },

  // ═══════════════════════════════════════════════════════
  // 5. SERVIÇOS PROFISSIONAIS
  //    Keyword matching — professional services
  // ═══════════════════════════════════════════════════════
  { groupName: "Contabilidade", ruleName: "Contabilidade", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "contabilidade,contábil,contador,escritório contábil,honorários contábeis", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Jurídico", ruleName: "Jurídico / Advocacia", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "jurídico,advocacia,advogado,honorários advocatícios,assessoria jurídica", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Consultoria", ruleName: "Consultoria", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "consultoria,assessoria,consulting,mentoria", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "Auditoria", ruleName: "Auditoria", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "auditoria,audit,auditores", sub_group_field: null, min_items: 1, priority: 13 },

  // ═══════════════════════════════════════════════════════
  // 6. CONTRATOS
  //    Source-based rule for recurring contracts
  // ═══════════════════════════════════════════════════════
  { groupName: "Contratos Recorrentes", ruleName: "Contratos Recorrentes (fonte)", match_field: "source", operator: "equals", match_value: "contrato", match_keyword: null, sub_group_field: "entity_id", min_items: 2, priority: 10 },

  // ═══════════════════════════════════════════════════════
  // 7. TRIBUTÁRIO
  //    Keyword matching — federal, state, municipal taxes
  // ═══════════════════════════════════════════════════════
  { groupName: "Impostos Federais", ruleName: "Impostos Federais", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "irpj,csll,cofins,pis,darf,simples nacional,das,contribuição federal", sub_group_field: null, min_items: 1, priority: 15 },
  { groupName: "Impostos Estaduais", ruleName: "ICMS / Impostos Estaduais", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "icms,imposto estadual,substituição tributária,difal,antecipação tributária", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Impostos Municipais", ruleName: "ISS / Impostos Municipais", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "iss,iptu,imposto municipal,taxa municipal,alvará,tlf", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Parcelamentos", ruleName: "Parcelamentos Tributários", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "parcelamento,refis,pert,programa especial,parcelamento tributário,reparcelamento", sub_group_field: null, min_items: 1, priority: 10 },

  // ═══════════════════════════════════════════════════════
  // 8. FINANCEIRO
  //    Keyword matching — banking fees, interest, insurance
  // ═══════════════════════════════════════════════════════
  { groupName: "Juros", ruleName: "Juros e Multas", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "juros,multa,mora,encargos financeiros,juros mora,multa atraso", sub_group_field: null, min_items: 1, priority: 10 },
  { groupName: "Tarifas Bancárias", ruleName: "Tarifas Bancárias", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "tarifa bancária,tarifa pix,ted,doc,manutenção conta,anuidade,cesta de serviços", sub_group_field: null, min_items: 1, priority: 10 },
  { groupName: "IOF", ruleName: "IOF", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "iof,imposto operações financeiras,imposto operacoes financeiras", sub_group_field: null, min_items: 1, priority: 10 },
  { groupName: "Seguros", ruleName: "Seguros", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "seguro empresarial,apólice,sinistro,porto seguro,bradesco seguros,seguro patrimonial,seguro vida empresarial", sub_group_field: null, min_items: 1, priority: 12 },

  // ═══════════════════════════════════════════════════════
  // 9. PATRIMONIAL / INVESTIMENTOS
  //    Keyword matching — capex, investments, depreciation
  // ═══════════════════════════════════════════════════════
  { groupName: "Investimentos", ruleName: "Investimentos e Aplicações", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "investimento,aplicação financeira,cdb,lci,lca,fundo investimento,renda fixa,tesouro direto", sub_group_field: null, min_items: 1, priority: 10 },
  { groupName: "Amortização", ruleName: "Amortização de Dívidas", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "amortização,amortizacao,parcela empréstimo,parcela financiamento,pagamento principal", sub_group_field: null, min_items: 1, priority: 10 },
  { groupName: "Depreciação", ruleName: "Depreciação", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "depreciação,depreciacao,desgaste ativo,depreciação acumulada", sub_group_field: null, min_items: 1, priority: 8 },

  // ═══════════════════════════════════════════════════════
  // 10. DESPESAS EVENTUAIS
  //     Keyword matching — travel, marketing, events
  // ═══════════════════════════════════════════════════════
  { groupName: "Viagens", ruleName: "Viagens e Deslocamentos", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "viagem,passagem aérea,hotel,hospedagem,uber,99,diária,deslocamento,táxi", sub_group_field: null, min_items: 1, priority: 8 },
  { groupName: "Eventos", ruleName: "Eventos e Treinamentos", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "evento,confraternização,workshop,treinamento,capacitação,congresso,seminário", sub_group_field: null, min_items: 1, priority: 8 },
  { groupName: "Marketing", ruleName: "Marketing e Publicidade", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "marketing,publicidade,google ads,meta ads,facebook ads,instagram,campanha,mídia paga,branding", sub_group_field: null, min_items: 1, priority: 10 },
];
