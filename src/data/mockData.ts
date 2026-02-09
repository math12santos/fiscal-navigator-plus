// Mock financial data for the application

export const kpiData = {
  receita: { value: "R$ 2.847.350", change: 12.5, subtitle: "vs mês anterior" },
  despesas: { value: "R$ 1.923.180", change: -3.2, subtitle: "vs mês anterior" },
  lucroLiquido: { value: "R$ 924.170", change: 28.7, subtitle: "vs mês anterior" },
  saldoCaixa: { value: "R$ 4.156.890", change: 5.1, subtitle: "vs mês anterior" },
};

export const monthlyRevenue = [
  { month: "Jul", receita: 2100000, despesas: 1750000 },
  { month: "Ago", receita: 2350000, despesas: 1800000 },
  { month: "Set", receita: 2180000, despesas: 1900000 },
  { month: "Out", receita: 2500000, despesas: 1850000 },
  { month: "Nov", receita: 2530000, despesas: 1980000 },
  { month: "Dez", receita: 2847350, despesas: 1923180 },
];

export const cashFlowData = [
  { dia: "01", entradas: 320000, saidas: 180000, saldo: 4156890 },
  { dia: "05", entradas: 150000, saidas: 290000, saldo: 4016890 },
  { dia: "10", entradas: 480000, saidas: 120000, saldo: 4376890 },
  { dia: "15", entradas: 210000, saidas: 350000, saldo: 4236890 },
  { dia: "20", entradas: 560000, saidas: 200000, saldo: 4596890 },
  { dia: "25", entradas: 180000, saidas: 410000, saldo: 4366890 },
  { dia: "30", entradas: 390000, saidas: 150000, saldo: 4606890 },
];

export const expenseByCategory = [
  { name: "Pessoal", value: 680000, fill: "hsl(174, 72%, 50%)" },
  { name: "Operacional", value: 420000, fill: "hsl(152, 60%, 45%)" },
  { name: "Tributário", value: 350000, fill: "hsl(38, 92%, 55%)" },
  { name: "Financeiro", value: 280000, fill: "hsl(262, 60%, 55%)" },
  { name: "Outros", value: 193180, fill: "hsl(0, 72%, 55%)" },
];

export const contracts = [
  { id: 1, nome: "Contrato Fornecedor Alpha", tipo: "Fornecedor", valor: 450000, vencimento: "2026-06-15", status: "Ativo" },
  { id: 2, nome: "Locação Sede SP", tipo: "Locação", valor: 85000, vencimento: "2027-01-01", status: "Ativo" },
  { id: 3, nome: "Serviço Cloud AWS", tipo: "Tecnologia", valor: 32000, vencimento: "2026-12-31", status: "Ativo" },
  { id: 4, nome: "Consultoria Fiscal", tipo: "Serviço", valor: 18000, vencimento: "2026-03-30", status: "Próximo ao vencimento" },
  { id: 5, nome: "Seguro Empresarial", tipo: "Seguro", valor: 96000, vencimento: "2026-08-20", status: "Ativo" },
];

export const bankReconciliation = [
  { id: 1, data: "02/01", descricao: "Pagamento Fornecedor A", erp: -45000, extrato: -45000, status: "Conciliado" },
  { id: 2, data: "05/01", descricao: "Recebimento Cliente X", erp: 120000, extrato: 120000, status: "Conciliado" },
  { id: 3, data: "08/01", descricao: "Tarifa Bancária", erp: -350, extrato: -380, status: "Divergente" },
  { id: 4, data: "12/01", descricao: "Pagamento Folha", erp: -285000, extrato: -285000, status: "Conciliado" },
  { id: 5, data: "15/01", descricao: "Transferência Interna", erp: 50000, extrato: 0, status: "Pendente" },
  { id: 6, data: "18/01", descricao: "Recebimento NF 4521", erp: 78000, extrato: 78000, status: "Conciliado" },
];

export const tasks = [
  { id: 1, titulo: "Fechar DRE mensal", responsavel: "Ana Silva", prazo: "2026-02-10", status: "Em andamento", prioridade: "Alta" },
  { id: 2, titulo: "Conciliar extratos bancários", responsavel: "Carlos Souza", prazo: "2026-02-12", status: "Pendente", prioridade: "Alta" },
  { id: 3, titulo: "Revisar contratos vencendo", responsavel: "Maria Santos", prazo: "2026-02-15", status: "Pendente", prioridade: "Média" },
  { id: 4, titulo: "Atualizar projeção Q1", responsavel: "João Lima", prazo: "2026-02-20", status: "Em andamento", prioridade: "Média" },
  { id: 5, titulo: "Enviar relatório fiscal", responsavel: "Ana Silva", prazo: "2026-02-28", status: "Concluído", prioridade: "Alta" },
];

export const scenarioData = {
  otimista: [
    { mes: "Jan", valor: 3200000 },
    { mes: "Fev", valor: 3450000 },
    { mes: "Mar", valor: 3680000 },
    { mes: "Abr", valor: 3920000 },
    { mes: "Mai", valor: 4100000 },
    { mes: "Jun", valor: 4350000 },
  ],
  realista: [
    { mes: "Jan", valor: 2847350 },
    { mes: "Fev", valor: 2900000 },
    { mes: "Mar", valor: 2950000 },
    { mes: "Abr", valor: 3050000 },
    { mes: "Mai", valor: 3100000 },
    { mes: "Jun", valor: 3200000 },
  ],
  conservador: [
    { mes: "Jan", valor: 2500000 },
    { mes: "Fev", valor: 2480000 },
    { mes: "Mar", valor: 2520000 },
    { mes: "Abr", valor: 2550000 },
    { mes: "Mai", valor: 2510000 },
    { mes: "Jun", valor: 2600000 },
  ],
};
