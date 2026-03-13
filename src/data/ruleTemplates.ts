/**
 * Static rule templates mapped to group names from DEFAULT_SEED.
 * Each template defines a rule that can be auto-created when the corresponding group exists.
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
  // ── Pessoal e RH ──
  { groupName: "Folha", ruleName: "Folha de Pagamento", match_field: "source", operator: "equals", match_value: "dp", match_keyword: null, sub_group_field: "dp_sub_category", min_items: 2, priority: 20 },
  { groupName: "Pró-labore", ruleName: "Pró-labore (descrição)", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "pro-labore,pró-labore,prolabore", sub_group_field: null, min_items: 1, priority: 18 },
  { groupName: "Encargos", ruleName: "Encargos Trabalhistas", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "inss,fgts,encargos,gps,darf,contribuição previdenciária", sub_group_field: null, min_items: 1, priority: 17 },
  { groupName: "Benefícios", ruleName: "Benefícios (categoria)", match_field: "categoria", operator: "equals", match_value: "Benefícios", match_keyword: null, sub_group_field: null, min_items: 1, priority: 15 },
  { groupName: "VT", ruleName: "Vale Transporte", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "vale transporte,vt,bilhete único,passagem", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Férias", ruleName: "Férias", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "férias,ferias", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "13º Salário", ruleName: "13º Salário", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "13o,13º,décimo terceiro,decimo terceiro", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "Rescisões", ruleName: "Rescisões", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "rescisão,rescisao,multa rescisória", sub_group_field: null, min_items: 1, priority: 12 },
  { groupName: "RPA", ruleName: "RPA / Autônomos", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "rpa,recibo pagamento autônomo,autônomo", sub_group_field: null, min_items: 1, priority: 11 },

  // ── Infraestrutura ──
  { groupName: "Aluguel", ruleName: "Aluguel", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "aluguel,locação,locacao", sub_group_field: null, min_items: 1, priority: 15 },
  { groupName: "Condomínio", ruleName: "Condomínio", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "condomínio,condominio,cond.", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Água", ruleName: "Água e Esgoto", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "sabesp,copasa,sanepar,água,esgoto,saneamento", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Energia", ruleName: "Energia Elétrica", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "cpfl,cemig,enel,eletropaulo,light,energia elétrica,celesc,copel,coelba", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Internet", ruleName: "Internet / Banda Larga", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "internet,banda larga,fibra,vivo fibra,net,claro internet", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "Telefonia", ruleName: "Telefonia", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "telefone,telefonia,vivo,claro,tim,oi móvel", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "Limpeza", ruleName: "Limpeza e Conservação", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "limpeza,conservação,faxina,zeladoria", sub_group_field: null, min_items: 1, priority: 12 },

  // ── Tecnologia e Sistemas ──
  { groupName: "Software/SaaS", ruleName: "Software e SaaS", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "saas,software,licença,assinatura,microsoft,google workspace,adobe,zoom,slack", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Hospedagem/Cloud", ruleName: "Hospedagem e Cloud", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "aws,azure,google cloud,hospedagem,servidor,cloud,digitalocean,heroku", sub_group_field: null, min_items: 1, priority: 13 },
  { groupName: "Suporte TI", ruleName: "Suporte de TI", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "suporte ti,manutenção ti,helpdesk,service desk", sub_group_field: null, min_items: 1, priority: 12 },

  // ── Serviços Profissionais ──
  { groupName: "Contabilidade", ruleName: "Contabilidade", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "contabilidade,contábil,contador,escritório contábil", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Jurídico", ruleName: "Jurídico / Advocacia", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "jurídico,advocacia,advogado,honorários advocatícios", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Consultoria", ruleName: "Consultoria", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "consultoria,assessoria,consulting", sub_group_field: null, min_items: 1, priority: 13 },

  // ── Contratos ──
  { groupName: "Contratos Recorrentes", ruleName: "Contratos (fonte)", match_field: "source", operator: "equals", match_value: "contrato", match_keyword: null, sub_group_field: "entity_id", min_items: 2, priority: 10 },

  // ── Tributário ──
  { groupName: "Impostos Federais", ruleName: "Impostos Federais", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "irpj,csll,cofins,pis,darf,simples nacional,das", sub_group_field: null, min_items: 1, priority: 15 },
  { groupName: "Impostos Estaduais", ruleName: "ICMS / Impostos Estaduais", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "icms,imposto estadual,substituição tributária", sub_group_field: null, min_items: 1, priority: 14 },
  { groupName: "Impostos Municipais", ruleName: "ISS / Impostos Municipais", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "iss,iptu,imposto municipal,taxa municipal", sub_group_field: null, min_items: 1, priority: 14 },

  // ── Financeiro ──
  { groupName: "Juros", ruleName: "Juros e Multas", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "juros,multa,mora,encargos financeiros", sub_group_field: null, min_items: 1, priority: 10 },
  { groupName: "Tarifas Bancárias", ruleName: "Tarifas Bancárias", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "tarifa bancária,ted,doc,pix tarifa,manutenção conta,anuidade", sub_group_field: null, min_items: 1, priority: 10 },
  { groupName: "Seguros", ruleName: "Seguros", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "seguro,apólice,sinistro,porto seguro,bradesco seguros", sub_group_field: null, min_items: 1, priority: 12 },

  // ── Despesas Eventuais ──
  { groupName: "Viagens", ruleName: "Viagens e Deslocamentos", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "viagem,passagem aérea,hotel,hospedagem,uber,99,diária", sub_group_field: null, min_items: 1, priority: 8 },
  { groupName: "Marketing", ruleName: "Marketing e Publicidade", match_field: "descricao", operator: "contains", match_value: "", match_keyword: "marketing,publicidade,google ads,meta ads,facebook,instagram,campanha", sub_group_field: null, min_items: 1, priority: 10 },
];
