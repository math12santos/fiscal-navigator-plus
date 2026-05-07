import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntities } from "@/hooks/useEntities";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useHolding } from "@/contexts/HoldingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2, Plus } from "lucide-react";
import { BankAccountFormDialog } from "./BankAccountFormDialog";
import EntityFormDialog from "@/components/EntityFormDialog";
import type { FinanceiroInput } from "@/hooks/useFinanceiro";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "saida" | "entrada";
  onSave: (input: FinanceiroInput) => Promise<void>;
  isPending: boolean;
  initial?: Partial<FinanceiroInput>;
  editMode?: boolean;
}

const TIPOS_DESPESA = [
  { value: "fixa", label: "Fixa" },
  { value: "variavel", label: "Variável" },
  { value: "eventual", label: "Eventual" },
  { value: "recorrente", label: "Recorrente" },
  { value: "investimento", label: "Investimento" },
  { value: "impostos", label: "Impostos" },
  { value: "distribuicao_lucro", label: "Distribuição de Lucro" },
  { value: "outros", label: "Outros" },
];

// Classificação de receitas / entradas de capital
const TIPOS_RECEITA = [
  { value: "receita_servicos", label: "Receita de Serviços" },
  { value: "receita_produtos", label: "Receita de Produtos / Vendas" },
  { value: "receita_recorrente", label: "Receita Recorrente (assinaturas)" },
  { value: "receita_financeira", label: "Receita Financeira (juros/aplicações)" },
  { value: "aporte_socios", label: "Aporte de Sócios" },
  { value: "aporte_investidor", label: "Aporte de Investidor" },
  { value: "emprestimo_recebido", label: "Empréstimo / Captação" },
  { value: "venda_ativo", label: "Venda de Ativo" },
  { value: "reembolso", label: "Reembolso / Estorno" },
  { value: "subvencao", label: "Subvenção / Incentivo" },
  { value: "outras_receitas", label: "Outras Receitas" },
];

const TIPOS_DOCUMENTO_SAIDA = [
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "fatura", label: "Fatura" },
  { value: "recibo", label: "Recibo" },
  { value: "contrato", label: "Contrato Nº" },
  { value: "darf", label: "DARF" },
  { value: "guia", label: "Guia" },
];

const TIPOS_DOCUMENTO_ENTRADA = [
  { value: "nota_fiscal", label: "Nota Fiscal de Serviço/Venda" },
  { value: "fatura", label: "Fatura / Boleto" },
  { value: "recibo", label: "Recibo" },
  { value: "contrato", label: "Contrato Nº" },
  { value: "ted_doc", label: "Comprovante TED/PIX" },
  { value: "termo_aporte", label: "Termo de Aporte" },
  { value: "ccb", label: "CCB / Contrato de Mútuo" },
];

const NATUREZAS_SAIDA = [
  { value: "operacional", label: "Operacional" },
  { value: "administrativa", label: "Administrativa" },
  { value: "comercial", label: "Comercial" },
  { value: "financeira", label: "Financeira" },
  { value: "tributaria", label: "Tributária" },
  { value: "patrimonial", label: "Patrimonial" },
];

const NATUREZAS_ENTRADA = [
  { value: "operacional", label: "Operacional (atividade-fim)" },
  { value: "nao_operacional", label: "Não Operacional" },
  { value: "financeira", label: "Financeira" },
  { value: "patrimonial", label: "Patrimonial (venda de ativo)" },
  { value: "capital", label: "Entrada de Capital (aporte/empréstimo)" },
];

const STATUS_OPTIONS_SAIDA = [
  { value: "pendente", label: "Pendente" },
  { value: "agendada", label: "Agendada" },
  { value: "paga", label: "Paga" },
  { value: "vencida", label: "Vencida" },
  { value: "cancelada", label: "Cancelada" },
  { value: "renegociada", label: "Renegociada" },
];

const STATUS_OPTIONS_ENTRADA = [
  { value: "pendente", label: "Pendente" },
  { value: "agendada", label: "Agendada" },
  { value: "recebido", label: "Recebido" },
  { value: "vencida", label: "Vencida" },
  { value: "cancelada", label: "Cancelada" },
  { value: "renegociada", label: "Renegociada" },
];

function buildDefault(tipo: "saida" | "entrada", initial?: Partial<FinanceiroInput>): FinanceiroInput {
  return {
    tipo,
    categoria: initial?.categoria ?? null,
    descricao: initial?.descricao ?? "",
    valor_previsto: initial?.valor_previsto ?? 0,
    valor_realizado: initial?.valor_realizado ?? null,
    data_prevista: initial?.data_prevista ?? "",
    data_realizada: initial?.data_realizada ?? null,
    status: initial?.status ?? "pendente",
    account_id: initial?.account_id ?? null,
    cost_center_id: initial?.cost_center_id ?? null,
    entity_id: initial?.entity_id ?? null,
    notes: initial?.notes ?? null,
    source: "manual",
    contract_id: null,
    contract_installment_id: null,
    documento: initial?.documento ?? null,
    tipo_documento: initial?.tipo_documento ?? null,
    tipo_despesa: initial?.tipo_despesa ?? null,
    subcategoria_id: initial?.subcategoria_id ?? null,
    valor_bruto: initial?.valor_bruto ?? 0,
    valor_desconto: initial?.valor_desconto ?? 0,
    valor_juros_multa: initial?.valor_juros_multa ?? 0,
    competencia: initial?.competencia ?? null,
    data_vencimento: initial?.data_vencimento ?? null,
    data_prevista_pagamento: initial?.data_prevista_pagamento ?? null,
    natureza_contabil: initial?.natureza_contabil ?? null,
    impacto_fluxo_caixa: initial?.impacto_fluxo_caixa ?? true,
    impacto_orcamento: initial?.impacto_orcamento ?? true,
    afeta_caixa_no_vencimento: initial?.afeta_caixa_no_vencimento ?? true,
    conta_contabil_ref: initial?.conta_contabil_ref ?? null,
    forma_pagamento: initial?.forma_pagamento ?? null,
    conta_bancaria_id: initial?.conta_bancaria_id ?? null,
    num_parcelas: initial?.num_parcelas ?? null,
    recorrencia: initial?.recorrencia ?? null,
    conciliacao_id: initial?.conciliacao_id ?? null,
  };
}

export function FinanceiroEntryDialog({ open, onOpenChange, tipo, onSave, isPending, initial, editMode }: Props) {
  const { entities } = useEntities();
  const { costCenters } = useCostCenters();
  const { accounts } = useChartOfAccounts();
  const { bankAccounts, create: createBank } = useBankAccounts();
  const { methods: paymentMethods } = usePaymentMethods();
  const { isHolding, subsidiaryOrgs } = useHolding();
  const { currentOrg } = useOrganization();

  const [form, setForm] = useState<FinanceiroInput>(buildDefault(tipo, initial));
  const [activeTab, setActiveTab] = useState("identificacao");
  const [showEntityDialog, setShowEntityDialog] = useState(false);
  const [showBankDialog, setShowBankDialog] = useState(false);

  const valorLiquido = form.valor_bruto - form.valor_desconto + form.valor_juros_multa;
  const isEntrada = tipo === "entrada";
  const TIPOS_DOCUMENTO = isEntrada ? TIPOS_DOCUMENTO_ENTRADA : TIPOS_DOCUMENTO_SAIDA;
  const NATUREZAS = isEntrada ? NATUREZAS_ENTRADA : NATUREZAS_SAIDA;
  const STATUS_OPTIONS = isEntrada ? STATUS_OPTIONS_ENTRADA : STATUS_OPTIONS_SAIDA;
  const TIPOS_CLASSIF = isEntrada ? TIPOS_RECEITA : TIPOS_DESPESA;

  // Chart of accounts: filter by nature matching the lançamento direction
  const categorias = accounts.filter(
    (a) => a.level === 2 && a.active && a.nature === (isEntrada ? "entrada" : "saida")
  );
  const selectedCatId = form.account_id;
  const subcategorias = accounts.filter((a) => a.level === 3 && a.active && a.parent_id === selectedCatId);

  // Cliente (entrada) ou Fornecedor (saida)
  const counterpartyEntities = entities.filter((e) =>
    e.active && (
      isEntrada
        ? (e.type === "cliente" || e.type === "cliente_fornecedor")
        : (e.type === "fornecedor" || e.type === "cliente_fornecedor")
    )
  );

  const set = <K extends keyof FinanceiroInput>(k: K, v: FinanceiroInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    const finalForm = { ...form, valor_previsto: valorLiquido > 0 ? valorLiquido : form.valor_bruto || form.valor_previsto };
    await onSave(finalForm);
    onOpenChange(false);
  };

  const title = editMode
    ? (tipo === "entrada" ? "Editar Receita" : "Editar Despesa")
    : (tipo === "entrada" ? "Nova Receita" : "Nova Despesa");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="identificacao" className="text-xs">Identificação</TabsTrigger>
              <TabsTrigger value="financeiro" className="text-xs">Dados Financeiros</TabsTrigger>
              <TabsTrigger value="contabil" className="text-xs">Natureza Contábil</TabsTrigger>
              <TabsTrigger value="pagamento" className="text-xs">Pagamento</TabsTrigger>
            </TabsList>

            {/* ───── TAB 1: Identificação ───── */}
            <TabsContent value="identificacao" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome / Descrição *</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => set("descricao", e.target.value)}
                  placeholder={tipo === "entrada" ? "Ex: Pagamento cliente X" : "Ex: Aluguel escritório"}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo de Documento</Label>
                  <Select value={form.tipo_documento ?? ""} onValueChange={(v) => set("tipo_documento", v || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_DOCUMENTO.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nº Documento</Label>
                  <Input
                    value={form.documento ?? ""}
                    onChange={(e) => set("documento", e.target.value || null)}
                    placeholder="Nº NF, fatura, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <div className="flex gap-2">
                  <Select value={form.entity_id ?? "none"} onValueChange={(v) => set("entity_id", v === "none" ? null : v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {fornecedores.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => setShowEntityDialog(true)} title="Novo fornecedor">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo_despesa ?? ""} onValueChange={(v) => set("tipo_despesa", v || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_DESPESA.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Centro de Custo</Label>
                  <Select value={form.cost_center_id ?? "none"} onValueChange={(v) => set("cost_center_id", v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {costCenters.filter((c) => c.active).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Categoria (Plano de Contas)</Label>
                  <Select value={form.account_id ?? "none"} onValueChange={(v) => set("account_id", v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {categorias.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subcategoria</Label>
                  <Select
                    value={form.subcategoria_id ?? "none"}
                    onValueChange={(v) => set("subcategoria_id", v === "none" ? null : v)}
                    disabled={!selectedCatId}
                  >
                    <SelectTrigger><SelectValue placeholder={selectedCatId ? "Selecione" : "Selecione categoria primeiro"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {subcategorias.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isHolding && (
                <div className="space-y-2">
                  <Label>Empresa / Unidade Pagadora</Label>
                  <Select value={currentOrg?.id ?? ""} disabled>
                    <SelectTrigger><SelectValue placeholder={currentOrg?.name ?? "Empresa atual"} /></SelectTrigger>
                    <SelectContent>
                      {currentOrg && <SelectItem value={currentOrg.id}>{currentOrg.name}</SelectItem>}
                      {subsidiaryOrgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value || null)}
                  rows={2}
                />
              </div>
            </TabsContent>

            {/* ───── TAB 2: Dados Financeiros ───── */}
            <TabsContent value="financeiro" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Valor Bruto (R$) *</Label>
                  <Input
                    type="number"
                    value={form.valor_bruto || ""}
                    onChange={(e) => set("valor_bruto", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descontos (R$)</Label>
                  <Input
                    type="number"
                    value={form.valor_desconto || ""}
                    onChange={(e) => set("valor_desconto", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Juros/Multa (R$)</Label>
                  <Input
                    type="number"
                    value={form.valor_juros_multa || ""}
                    onChange={(e) => set("valor_juros_multa", Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">Valor Líquido: </span>
                <span className="font-semibold">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorLiquido)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Competência (mm/aa)</Label>
                  <Input
                    value={form.competencia ?? ""}
                    onChange={(e) => set("competencia", e.target.value || null)}
                    placeholder="03/26"
                    maxLength={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Vencimento *</Label>
                  <Input
                    type="date"
                    value={form.data_vencimento ?? ""}
                    onChange={(e) => set("data_vencimento", e.target.value || null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data Prevista de Pagamento</Label>
                  <Input
                    type="date"
                    value={form.data_prevista_pagamento ?? form.data_prevista ?? ""}
                    onChange={(e) => {
                      set("data_prevista_pagamento", e.target.value || null);
                      set("data_prevista", e.target.value || form.data_prevista);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Efetiva de Pagamento</Label>
                  <Input
                    type="date"
                    value={form.data_realizada ?? ""}
                    disabled
                    className="opacity-60"
                  />
                  <p className="text-xs text-muted-foreground">Preenchida ao confirmar pagamento</p>
                </div>
              </div>
            </TabsContent>

            {/* ───── TAB 3: Natureza Contábil ───── */}
            <TabsContent value="contabil" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Classificação no Plano de Contas</Label>
                <Select value={form.account_id ?? "none"} onValueChange={(v) => set("account_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {accounts.filter((a) => a.active && !a.is_synthetic).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Natureza</Label>
                <Select value={form.natureza_contabil ?? ""} onValueChange={(v) => set("natureza_contabil", v || null)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {NATUREZAS.map((n) => (
                      <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Impacto no Fluxo de Caixa</Label>
                  <Switch checked={form.impacto_fluxo_caixa} onCheckedChange={(v) => set("impacto_fluxo_caixa", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Impacto em Orçamento</Label>
                  <Switch checked={form.impacto_orcamento} onCheckedChange={(v) => set("impacto_orcamento", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Afeta caixa no vencimento</Label>
                  <Switch checked={form.afeta_caixa_no_vencimento} onCheckedChange={(v) => set("afeta_caixa_no_vencimento", v)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Conta Contábil Referencial</Label>
                <Input
                  value={form.conta_contabil_ref ?? ""}
                  onChange={(e) => set("conta_contabil_ref", e.target.value || null)}
                  placeholder="Para integração contábil"
                />
              </div>

              {form.competencia && (
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <span className="text-muted-foreground">Competência: </span>
                  <span className="font-medium">{form.competencia}</span>
                </div>
              )}
            </TabsContent>

            {/* ───── TAB 4: Pagamento e Liquidação ───── */}
            <TabsContent value="pagamento" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={form.forma_pagamento ?? ""} onValueChange={(v) => set("forma_pagamento", v || null)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conta Bancária Pagadora</Label>
                <div className="flex gap-2">
                  <Select value={form.conta_bancaria_id ?? "none"} onValueChange={(v) => set("conta_bancaria_id", v === "none" ? null : v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.nome}{b.banco ? ` — ${b.banco}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => setShowBankDialog(true)} title="Nova conta bancária">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nº de Parcelas</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.num_parcelas ?? ""}
                    onChange={(e) => set("num_parcelas", e.target.value ? Number(e.target.value) : null)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Recorrência</Label>
                  <Select value={form.recorrencia ?? ""} onValueChange={(v) => set("recorrencia", v || null)}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.conciliacao_id && (
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <span className="text-muted-foreground">Conciliação: </span>
                  <span className="font-mono text-xs">{form.conciliacao_id}</span>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.descricao || (!form.data_vencimento && !form.data_prevista) || isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editMode ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Entity (Fornecedor) creation */}
      <EntityFormDialog
        open={showEntityDialog}
        onOpenChange={setShowEntityDialog}
        entity={null}
        onSubmit={(data) => {
          // Will be handled by entities hook
        }}
        isLoading={false}
      />

      {/* Inline Bank Account creation */}
      <BankAccountFormDialog
        open={showBankDialog}
        onOpenChange={setShowBankDialog}
        onSave={async (data) => {
          await createBank.mutateAsync(data);
          setShowBankDialog(false);
        }}
        isPending={createBank.isPending}
      />
    </>
  );
}
