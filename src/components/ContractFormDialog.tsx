import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useContractDocuments } from "@/hooks/useContractDocuments";
import { useContractInstallments } from "@/hooks/useContractInstallments";
import { useEntities } from "@/hooks/useEntities";
import { useProducts } from "@/hooks/useProducts";
import EntityFormDialog from "@/components/EntityFormDialog";
import ProductFormDialog from "@/components/ProductFormDialog";
import { Upload, FileText, Eye, Trash2, Loader2, Plus, UserPlus, PackagePlus, Zap } from "lucide-react";

export interface ContractFormData {
  nome: string;
  entity_id: string;
  product_id: string;
  tipo: string;
  valor: number;
  vencimento: string;
  status: string;
  notes: string;
  // 3.1 Recorrência
  tipo_recorrencia: string;
  intervalo_personalizado: number | null;
  data_inicio: string;
  data_fim: string;
  prazo_indeterminado: boolean;
  valor_base: number;
  dia_vencimento: number | null;
  // 3.2 Reajustes
  tipo_reajuste: string;
  indice_reajuste: string;
  percentual_reajuste: number | null;
  periodicidade_reajuste: string;
  proximo_reajuste: string;
  // 3.6 Classificações
  natureza_financeira: string;
  impacto_resultado: string;
  cost_center_id: string;
  // 3.7 Governança
  responsavel_interno: string;
  area_responsavel: string;
  sla_revisao_dias: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ContractFormData) => void;
  initialData?: ContractFormData | null;
  loading?: boolean;
  contractId?: string | null;
}

const RequiredLabel = ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
  <Label htmlFor={htmlFor}>
    {children} <span className="text-destructive">*</span>
  </Label>
);

// tipos removed - now using products/services
const statuses = ["Ativo", "Próximo ao vencimento", "Vencido", "Cancelado", "Pausado"];
const recorrencias = [
  { value: "unico", label: "Único (sem recorrência)" },
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
  { value: "personalizado", label: "Personalizado" },
];
const tiposReajuste = [
  { value: "manual", label: "Manual" },
  { value: "indice", label: "Índice" },
  { value: "percentual_fixo", label: "Percentual fixo" },
];
const indices = ["IPCA", "IGPM", "INPC"];
const naturezas = [
  { value: "fixo", label: "Fixo" },
  { value: "variavel", label: "Variável" },
  { value: "fixo_variavel", label: "Fixo + Variável" },
];
const impactos = [
  { value: "receita", label: "Receita" },
  { value: "custo", label: "Custo" },
  { value: "despesa", label: "Despesa" },
  { value: "investimento", label: "Investimento" },
];

const defaultForm: ContractFormData = {
  nome: "", entity_id: "", product_id: "", tipo: "", valor: 0, vencimento: "", status: "Ativo", notes: "",
  tipo_recorrencia: "mensal", intervalo_personalizado: null, data_inicio: "", data_fim: "",
  prazo_indeterminado: false, valor_base: 0, dia_vencimento: null,
  tipo_reajuste: "manual", indice_reajuste: "", percentual_reajuste: null,
  periodicidade_reajuste: "anual", proximo_reajuste: "",
  natureza_financeira: "fixo", impacto_resultado: "custo", cost_center_id: "",
  responsavel_interno: "", area_responsavel: "", sla_revisao_dias: null,
};

export default function ContractFormDialog({ open, onOpenChange, onSubmit, initialData, loading, contractId }: Props) {
  const [form, setForm] = useState<ContractFormData>({ ...defaultForm });
  const { costCenters } = useCostCenters();
  const { entities, create: createEntity } = useEntities();
  const { products, create: createProduct } = useProducts();
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const isEditing = !!contractId;

  // Filter clients (cliente or ambos)
  const clients = entities.filter((e) => e.active && (e.type === "cliente" || e.type === "ambos"));
  // Active products/services
  const activeProducts = products.filter((p) => p.active);

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm({ ...defaultForm });
    }
  }, [initialData, open]);

  const set = <K extends keyof ContractFormData>(key: K, value: ContractFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const tabCount = isEditing ? 5 : 4;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basico" className="w-full">
            <TabsList className={`grid w-full mb-4`} style={{ gridTemplateColumns: `repeat(${tabCount}, 1fr)` }}>
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="recorrencia">Recorrência</TabsTrigger>
              <TabsTrigger value="reajuste">Reajuste</TabsTrigger>
              <TabsTrigger value="governanca">Governança</TabsTrigger>
              {isEditing && <TabsTrigger value="documentos">Documentos</TabsTrigger>}
            </TabsList>

            {/* TAB: Básico */}
            <TabsContent value="basico" className="space-y-4">
              <div className="space-y-2">
                <RequiredLabel>Cliente</RequiredLabel>
                <div className="flex items-center gap-2">
                  <Select value={form.entity_id || "none"} onValueChange={(v) => {
                    const selected = clients.find((c) => c.id === v);
                    set("entity_id", v === "none" ? "" : v);
                    if (selected) set("nome", selected.name);
                  }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecionar...</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.document_number ? ` (${c.document_number})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setEntityDialogOpen(true)} title="Adicionar cliente">
                    <UserPlus size={16} />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <RequiredLabel>Produto / Serviço</RequiredLabel>
                <div className="flex items-center gap-2">
                  <Select value={form.product_id || "none"} onValueChange={(v) => {
                    const selected = activeProducts.find((p) => p.id === v);
                    set("product_id", v === "none" ? "" : v);
                    if (selected) set("tipo", selected.type === "servico" ? "Serviço" : "Produto");
                  }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar produto/serviço..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecionar...</SelectItem>
                      {activeProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} - {p.name} ({p.type === "servico" ? "Serviço" : "Produto"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setProductDialogOpen(true)} title="Adicionar produto/serviço">
                    <PackagePlus size={16} />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <RequiredLabel>Status</RequiredLabel>
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Natureza financeira</Label>
                  <Select value={form.natureza_financeira} onValueChange={(v) => set("natureza_financeira", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{naturezas.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Impacto no resultado</Label>
                  <Select value={form.impacto_resultado} onValueChange={(v) => set("impacto_resultado", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{impactos.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Centro de custo</Label>
                  <Select value={form.cost_center_id || "none"} onValueChange={(v) => set("cost_center_id", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {costCenters.filter((cc) => cc.active).map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="vencimento">Vencimento (contrato)</RequiredLabel>
                  <Input id="vencimento" type="date" value={form.vencimento} onChange={(e) => set("vencimento", e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} rows={2} />
              </div>
            </TabsContent>

            {/* TAB: Recorrência */}
            <TabsContent value="recorrencia" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <RequiredLabel>Tipo de recorrência</RequiredLabel>
                  <Select value={form.tipo_recorrencia} onValueChange={(v) => set("tipo_recorrencia", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{recorrencias.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.tipo_recorrencia === "personalizado" && (
                  <div className="space-y-2">
                    <Label>Intervalo (meses)</Label>
                    <Input type="number" min={1} value={form.intervalo_personalizado ?? ""} onChange={(e) => set("intervalo_personalizado", e.target.value ? Number(e.target.value) : null)} />
                  </div>
                )}
              </div>
              {form.tipo_recorrencia !== "unico" && (
                <div className="space-y-2">
                  <Label htmlFor="dia_vencimento">Dia de vencimento mensal (1-31)</Label>
                  <Input id="dia_vencimento" type="number" min={1} max={31} placeholder="Ex: 15" value={form.dia_vencimento ?? ""} onChange={(e) => set("dia_vencimento", e.target.value ? Number(e.target.value) : null)} />
                  <p className="text-xs text-muted-foreground">Dia fixo do mês em que a parcela vence</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor_base">{form.tipo_recorrencia === "unico" ? "Valor total (R$)" : "Valor base (R$)"}</Label>
                  <Input id="valor_base" type="number" min={0} step={0.01} value={form.valor_base} onChange={(e) => set("valor_base", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="valor">{form.tipo_recorrencia === "unico" ? "Valor do contrato (R$)" : "Valor mensal (R$)"}</RequiredLabel>
                  <Input id="valor" type="number" min={0} step={0.01} value={form.valor} onChange={(e) => set("valor", Number(e.target.value))} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_inicio">Data de início</Label>
                  <Input id="data_inicio" type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_fim">Data de término</Label>
                  <Input id="data_fim" type="date" value={form.data_fim} onChange={(e) => set("data_fim", e.target.value)} disabled={form.prazo_indeterminado} />
                </div>
              </div>
              {form.tipo_recorrencia !== "unico" && (
                <div className="flex items-center gap-3">
                  <Switch checked={form.prazo_indeterminado} onCheckedChange={(v) => { set("prazo_indeterminado", v); if (v) set("data_fim", ""); }} />
                  <Label>Prazo indeterminado</Label>
                </div>
              )}

              {/* Parcelas - only for "unico" contracts being edited */}
              {form.tipo_recorrencia === "unico" && isEditing && contractId && (
                <InstallmentsSection contractId={contractId} contractValue={form.valor} />
              )}
              {form.tipo_recorrencia === "unico" && !isEditing && (
                <p className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-3">
                  💡 Salve o contrato primeiro para cadastrar as parcelas de pagamento.
                </p>
              )}
            </TabsContent>

            {/* TAB: Reajuste */}
            <TabsContent value="reajuste" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de reajuste</Label>
                  <Select value={form.tipo_reajuste} onValueChange={(v) => set("tipo_reajuste", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{tiposReajuste.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.tipo_reajuste === "indice" && (
                  <div className="space-y-2">
                    <Label>Índice</Label>
                    <Select value={form.indice_reajuste} onValueChange={(v) => set("indice_reajuste", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>{indices.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {form.tipo_reajuste === "percentual_fixo" && (
                  <div className="space-y-2">
                    <Label>Percentual (%)</Label>
                    <Input type="number" min={0} step={0.01} value={form.percentual_reajuste ?? ""} onChange={(e) => set("percentual_reajuste", e.target.value ? Number(e.target.value) : null)} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Periodicidade</Label>
                  <Select value={form.periodicidade_reajuste} onValueChange={(v) => set("periodicidade_reajuste", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anual">Anual</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="personalizada">Personalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proximo_reajuste">Próximo reajuste</Label>
                  <Input id="proximo_reajuste" type="date" value={form.proximo_reajuste} onChange={(e) => set("proximo_reajuste", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* TAB: Governança */}
            <TabsContent value="governanca" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="responsavel_interno">Responsável interno</Label>
                  <Input id="responsavel_interno" value={form.responsavel_interno} onChange={(e) => set("responsavel_interno", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="area_responsavel">Área responsável</Label>
                  <Input id="area_responsavel" value={form.area_responsavel} onChange={(e) => set("area_responsavel", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sla_revisao_dias">SLA de revisão (dias)</Label>
                <Input id="sla_revisao_dias" type="number" min={0} value={form.sla_revisao_dias ?? ""} onChange={(e) => set("sla_revisao_dias", e.target.value ? Number(e.target.value) : null)} />
              </div>
            </TabsContent>

            {/* TAB: Documentos (only when editing) */}
            {isEditing && contractId && (
              <TabsContent value="documentos" className="space-y-4">
                <DocumentsTab contractId={contractId} />
              </TabsContent>
            )}
          </Tabs>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* Entity creation dialog */}
    <EntityFormDialog
      open={entityDialogOpen}
      onOpenChange={setEntityDialogOpen}
      entity={null}
      onSubmit={(data) => {
        createEntity.mutate({ ...data, type: data.type || "cliente" }, {
          onSuccess: () => setEntityDialogOpen(false),
        });
      }}
      isLoading={createEntity.isPending}
    />

    {/* Product/Service creation dialog */}
    <ProductFormDialog
      open={productDialogOpen}
      onOpenChange={setProductDialogOpen}
      product={null}
      products={products}
      accounts={[]}
      onSubmit={(data) => {
        createProduct.mutate(data, {
          onSuccess: () => setProductDialogOpen(false),
        });
      }}
      isLoading={createProduct.isPending}
    />
    </>
  );
}

// ==================== Installments Section ====================
function InstallmentsSection({ contractId, contractValue }: { contractId: string; contractValue: number }) {
  const { installments, isLoading, create, createMany, remove } = useContractInstallments(contractId);
  const [showGenerator, setShowGenerator] = useState(false);
  const [genQty, setGenQty] = useState(3);
  const [genStartDate, setGenStartDate] = useState("");
  const [genInterval, setGenInterval] = useState(30);

  const totalParcelas = installments.reduce((sum, i) => sum + Number(i.valor), 0);
  const diff = contractValue - totalParcelas;

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);

  const handleAddOne = () => {
    const nextNum = installments.length + 1;
    create.mutate({
      contract_id: contractId,
      descricao: nextNum === 1 ? "Entrada" : `Parcela ${nextNum - 1}`,
      numero: nextNum,
      valor: 0,
      data_vencimento: new Date().toISOString().split("T")[0],
      status: "pendente",
    });
  };

  const handleGenerate = () => {
    if (!genStartDate || genQty < 1 || contractValue <= 0) return;
    const valorParcela = Math.round((contractValue / genQty) * 100) / 100;
    const parcelas = Array.from({ length: genQty }, (_, i) => {
      const date = new Date(genStartDate);
      date.setDate(date.getDate() + genInterval * i);
      return {
        contract_id: contractId,
        descricao: i === 0 ? "Entrada" : `Parcela ${i}`,
        numero: i + 1,
        valor: valorParcela,
        data_vencimento: date.toISOString().split("T")[0],
        status: "pendente" as const,
      };
    });
    createMany.mutate(parcelas, { onSuccess: () => setShowGenerator(false) });
  };

  return (
    <div className="border border-border rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Parcelas</h4>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowGenerator(!showGenerator)} className="gap-1">
            <Zap size={14} /> Gerar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleAddOne} className="gap-1">
            <Plus size={14} /> Adicionar
          </Button>
        </div>
      </div>

      {showGenerator && (
        <div className="bg-secondary/30 rounded-md p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Gerar parcelas automaticamente</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" min={1} max={60} value={genQty} onChange={(e) => setGenQty(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Intervalo (dias)</Label>
              <Input type="number" min={1} value={genInterval} onChange={(e) => setGenInterval(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {genQty} x {fmt(contractValue / (genQty || 1))}
            </p>
            <Button type="button" size="sm" onClick={handleGenerate} disabled={createMany.isPending || !genStartDate}>
              {createMany.isPending ? "Gerando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-2"><Loader2 className="animate-spin text-primary" size={18} /></div>
      ) : installments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">Nenhuma parcela cadastrada.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {installments.map((inst) => (
            <div key={inst.id} className="flex items-center gap-2 text-sm">
              <span className="w-24 truncate font-medium">{inst.descricao}</span>
              <span className="w-24 text-right font-mono">{fmt(Number(inst.valor))}</span>
              <span className="w-28 text-muted-foreground">{new Date(inst.data_vencimento).toLocaleDateString("pt-BR")}</span>
              <Badge variant="outline" className="text-xs capitalize">{inst.status}</Badge>
              <Button type="button" variant="ghost" size="icon" className="ml-auto h-7 w-7 text-destructive" onClick={() => remove.mutate(inst.id)}>
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {installments.length > 0 && (
        <div className="flex items-center justify-between text-sm border-t border-border pt-2">
          <span className="text-muted-foreground">Total parcelas: <span className="font-mono font-medium text-foreground">{fmt(totalParcelas)}</span></span>
          <span className={`font-mono text-xs ${Math.abs(diff) < 0.01 ? "text-success" : "text-warning"}`}>
            {Math.abs(diff) < 0.01 ? "✓ Valores conferem" : `Diferença: ${fmt(diff)}`}
          </span>
        </div>
      )}
    </div>
  );
}

// ==================== Documents Tab ====================
function DocumentsTab({ contractId }: { contractId: string }) {
  const { documents, isLoading, upload, remove } = useContractDocuments(contractId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState("contrato");

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate({ file, fileType: uploadType });
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Anexe contratos assinados, NFs, aditivos e outros documentos.</p>
        <div className="flex items-center gap-2">
          <Select value={uploadType} onValueChange={setUploadType}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contrato">Contrato</SelectItem>
              <SelectItem value="aditivo">Aditivo</SelectItem>
              <SelectItem value="nf">Nota Fiscal</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1">
            <Upload size={14} /> Upload
          </Button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento anexado.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/30">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-primary" />
                <span className="text-sm">{d.file_name}</span>
                <Badge variant="outline" className="text-xs">{d.file_type} v{d.version}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" asChild>
                  <a href={d.file_url} target="_blank" rel="noopener"><Eye size={14} /></a>
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove.mutate(d.id)} className="text-destructive">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
