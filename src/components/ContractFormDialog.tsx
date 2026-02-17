import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useContractDocuments } from "@/hooks/useContractDocuments";
import { useContractInstallments } from "@/hooks/useContractInstallments";
import { useEntities } from "@/hooks/useEntities";
import { useProducts } from "@/hooks/useProducts";
import EntityFormDialog from "@/components/EntityFormDialog";
import ProductFormDialog from "@/components/ProductFormDialog";
import { Upload, FileText, Eye, Trash2, Loader2, Plus, UserPlus, PackagePlus, Zap, CheckCircle2, ArrowRight, ArrowLeft, ShoppingCart, Store, Landmark } from "lucide-react";

export interface ContractFormData {
  nome: string;
  entity_id: string;
  product_id: string;
  tipo: string;
  valor: number;
  vencimento: string;
  status: string;
  notes: string;
  tipo_recorrencia: string;
  intervalo_personalizado: number | null;
  data_inicio: string;
  data_fim: string;
  prazo_indeterminado: boolean;
  valor_base: number;
  dia_vencimento: number | null;
  tipo_reajuste: string;
  indice_reajuste: string;
  percentual_reajuste: number | null;
  periodicidade_reajuste: string;
  proximo_reajuste: string;
  natureza_financeira: string;
  impacto_resultado: string;
  cost_center_id: string;
  responsavel_interno: string;
  area_responsavel: string;
  sla_revisao_dias: number | null;
  finalidade: string;
  operacao: string;
  subtipo_operacao: string;
  rendimento_mensal_esperado: number | null;
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

const statuses = ["Ativo", "Próximo ao vencimento", "Vencido", "Cancelado", "Pausado"];

const defaultForm: ContractFormData = {
  nome: "", entity_id: "", product_id: "", tipo: "", valor: 0, vencimento: "", status: "Ativo", notes: "",
  tipo_recorrencia: "mensal", intervalo_personalizado: null, data_inicio: "", data_fim: "",
  prazo_indeterminado: false, valor_base: 0, dia_vencimento: null,
  tipo_reajuste: "manual", indice_reajuste: "", percentual_reajuste: null,
  periodicidade_reajuste: "anual", proximo_reajuste: "",
  natureza_financeira: "fixo", impacto_resultado: "custo", cost_center_id: "",
  responsavel_interno: "", area_responsavel: "", sla_revisao_dias: null,
  finalidade: "", operacao: "", subtipo_operacao: "", rendimento_mensal_esperado: null,
};

// Classification tree
type SubtipoOption = { value: string; label: string };
type ClassificacaoNode = {
  label: string;
  subtipos?: SubtipoOption[];
  subcategorias?: Record<string, { label: string; subtipos: SubtipoOption[] }>;
};

const classificacaoTree: Record<string, {
  label: string;
  sublabel: string;
  icon: typeof ShoppingCart;
  classificacoes: Record<string, ClassificacaoNode>;
}> = {
  compra: {
    label: "Compra",
    sublabel: "Operacional",
    icon: ShoppingCart,
    classificacoes: {
      mercadoria: {
        label: "Mercadoria",
        subtipos: [
          { value: "revenda", label: "Revenda" },
          { value: "insumo_produtivo", label: "Insumo produtivo" },
          { value: "material_indireto", label: "Material indireto" },
        ],
      },
      servicos: {
        label: "Serviços",
        subtipos: [
          { value: "servicos_recorrentes", label: "Serviços recorrentes" },
          { value: "servicos_pontuais", label: "Serviços pontuais" },
          { value: "servicos_tecnicos", label: "Serviços técnicos / especializados" },
          { value: "terceirizacao", label: "Terceirização / outsourcing" },
        ],
      },
      material_uso_consumo: {
        label: "Material de Uso e Consumo",
        subtipos: [
          { value: "administrativo", label: "Administrativo" },
          { value: "operacional", label: "Operacional" },
          { value: "manutencao", label: "Manutenção" },
        ],
      },
    },
  },
  venda: {
    label: "Venda",
    sublabel: "Operacional",
    icon: Store,
    classificacoes: {
      servicos: {
        label: "Serviços",
        subtipos: [
          { value: "servicos_recorrentes", label: "Serviços recorrentes" },
          { value: "servicos_pontuais", label: "Serviços pontuais" },
          { value: "servicos_contrato", label: "Serviços por contrato / projeto" },
        ],
      },
      mercadoria: {
        label: "Mercadoria",
        subtipos: [
          { value: "revenda", label: "Revenda" },
          { value: "producao_propria", label: "Produção própria" },
          { value: "kits", label: "Kits / soluções integradas" },
        ],
      },
    },
  },
  patrimonio: {
    label: "Patrimônio",
    sublabel: "Não Operacional",
    icon: Landmark,
    classificacoes: {
      investimento: {
        label: "Investimento",
        subcategorias: {
          aporte_capital: {
            label: "Aporte de capital",
            subtipos: [
              { value: "equity", label: "Equity" },
              { value: "afac", label: "AFAC" },
              { value: "capital_social", label: "Capital social" },
            ],
          },
          mutuo: {
            label: "Mútuo",
            subtipos: [
              { value: "mutuo_simples", label: "Mútuo simples" },
              { value: "mutuo_conversivel", label: "Mútuo conversível" },
            ],
          },
          participacao_resultado: {
            label: "Participação em Resultado",
            subtipos: [
              { value: "joint_venture", label: "Joint Venture" },
              { value: "scp", label: "SCP" },
              { value: "parceria_operacional", label: "Parceria operacional com participação" },
            ],
          },
          investimento_financeiro: {
            label: "Investimento Financeiro",
            subtipos: [
              { value: "renda_fixa", label: "Renda fixa" },
              { value: "renda_variavel", label: "Renda variável" },
              { value: "investimento_estruturado", label: "Investimento estruturado" },
            ],
          },
        },
      },
      venda_ativo: {
        label: "Venda de Ativo",
        subcategorias: {
          ativo_imobilizado: {
            label: "Ativo Imobilizado",
            subtipos: [
              { value: "maquinas_equipamentos", label: "Máquinas e equipamentos" },
              { value: "veiculos", label: "Veículos" },
              { value: "moveis_instalacoes", label: "Móveis e instalações" },
            ],
          },
          ativo_intangivel: {
            label: "Ativo Intangível",
            subtipos: [
              { value: "software", label: "Software" },
              { value: "marca", label: "Marca" },
              { value: "direitos_licencas", label: "Direitos / licenças" },
            ],
          },
          participacoes_societarias: {
            label: "Participações Societárias",
            subtipos: [
              { value: "quotas", label: "Quotas" },
              { value: "acoes", label: "Ações" },
            ],
          },
        },
      },
    },
  },
};

// Helper to get classification label for badges
const getClassificacaoLabel = (operacao: string, subtipo: string): string => {
  const tree = classificacaoTree[operacao];
  if (!tree) return "";
  return tree.classificacoes[subtipo]?.label || "";
};

const getFinalidadeLabel = (operacao: string, subtipo: string, finalidade: string, categoriaPatrimonio?: string): string => {
  const node = classificacaoTree[operacao]?.classificacoes[subtipo];
  if (!node) return "";
  if (node.subtipos) {
    return node.subtipos.find(s => s.value === finalidade)?.label || "";
  }
  if (node.subcategorias && categoriaPatrimonio) {
    const sub = node.subcategorias[categoriaPatrimonio];
    return sub?.subtipos.find(s => s.value === finalidade)?.label || "";
  }
  return "";
};

export default function ContractFormDialog({ open, onOpenChange, onSubmit, initialData, loading, contractId }: Props) {
  const [form, setForm] = useState<ContractFormData>({ ...defaultForm });
  const [step, setStep] = useState(1); // 1 = contraparte+operação, 2 = condições de pagamento, 3 = detalhes finais
  const { costCenters } = useCostCenters();
  const { entities, create: createEntity } = useEntities();
  const { products, create: createProduct } = useProducts();
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const isEditing = !!contractId;

  const availableEntities = entities.filter((e) => e.active);
  const activeProducts = products.filter((p) => p.active);

  const selectedEntity = useMemo(
    () => availableEntities.find((e) => e.id === form.entity_id),
    [availableEntities, form.entity_id]
  );

  const selectedProduct = useMemo(
    () => activeProducts.find((p) => p.id === form.product_id),
    [activeProducts, form.product_id]
  );

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
      setStep(isEditing ? 2 : 1);
    } else {
      setForm({ ...defaultForm });
      setStep(1);
    }
  }, [initialData, open]);

  const set = <K extends keyof ContractFormData>(key: K, value: ContractFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Auto-classify based on entity + operacao
  const handleEntityChange = (entityId: string) => {
    const entity = availableEntities.find((e) => e.id === entityId);
    set("entity_id", entityId);
    if (entity) {
      set("nome", entity.name);
    }
  };

  const handleProductChange = (productId: string) => {
    const product = activeProducts.find((p) => p.id === productId);
    set("product_id", productId);
    if (product) {
      set("tipo", product.type === "servico" ? "Serviço" : product.type === "imobilizado" ? "Imobilizado" : "Produto");
    }
  };

  // Derive impacto_resultado from operacao + subtipo
  useEffect(() => {
    if (form.operacao === "compra") {
      set("impacto_resultado", "custo");
    } else if (form.operacao === "venda") {
      set("impacto_resultado", "receita");
    } else if (form.operacao === "patrimonio") {
      if (form.subtipo_operacao === "investimento") {
        set("impacto_resultado", "investimento");
      } else {
        set("impacto_resultado", "receita");
      }
    }
  }, [form.operacao, form.subtipo_operacao]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submittedForm = { ...form };
    if (!submittedForm.vencimento && submittedForm.data_fim) {
      submittedForm.vencimento = submittedForm.data_fim;
    }
    onSubmit(submittedForm);
  };

  // Build searchable options
  const entityOptions = useMemo(() =>
    availableEntities.map((e) => ({
      value: e.id,
      label: e.name,
      sublabel: `${e.document_number || "Sem documento"} — ${e.type === "cliente" ? "Cliente" : e.type === "fornecedor" ? "Fornecedor" : "Ambos"}`,
    })),
    [availableEntities]
  );

  const productOptions = useMemo(() =>
    activeProducts.map((p) => ({
      value: p.id,
      label: `${p.code} - ${p.name}`,
      sublabel: p.type === "servico" ? "Serviço" : p.type === "imobilizado" ? "Imobilizado" : "Produto",
    })),
    [activeProducts]
  );

  // Patrimônio intermediate category state
  const [categoriaPatrimonio, setCategoriaPatrimonio] = useState("");

  // Determine flags for step 2 conditional rendering
  const isCompra = form.operacao === "compra";
  const isVenda = form.operacao === "venda";
  const isPatrimonio = form.operacao === "patrimonio";
  const isMercadoriaCompra = isCompra && form.subtipo_operacao === "mercadoria";
  const isServicosCompra = isCompra && form.subtipo_operacao === "servicos";
  const isMaterialUsoConsumo = isCompra && form.subtipo_operacao === "material_uso_consumo";
  const isVendaServicos = isVenda && form.subtipo_operacao === "servicos";
  const isVendaMercadoria = isVenda && form.subtipo_operacao === "mercadoria";
  const isInvestimento = isPatrimonio && form.subtipo_operacao === "investimento";
  const isVendaAtivo = isPatrimonio && form.subtipo_operacao === "venda_ativo";
  const isInvestimentoFinanceiro = isInvestimento && categoriaPatrimonio === "investimento_financeiro";

  // Investment sub-type state (derived from categoriaPatrimonio for patrimônio, or manual for legacy)
  const [investimentoTipo, setInvestimentoTipo] = useState<"financeiro" | "maquinas">("financeiro");

  // Sync investimentoTipo from categoriaPatrimonio
  useEffect(() => {
    if (isInvestimento) {
      if (categoriaPatrimonio === "investimento_financeiro") {
        setInvestimentoTipo("financeiro");
      } else if (categoriaPatrimonio) {
        setInvestimentoTipo("maquinas");
      }
    }
  }, [isInvestimento, categoriaPatrimonio]);

  // Venda servicos sub-type 
  const [vendaServicoTipo, setVendaServicoTipo] = useState<"unico" | "mensalidade">("mensalidade");

  // Current tree node helpers
  const currentOperacaoNode = form.operacao ? classificacaoTree[form.operacao] : null;
  const currentClassificacaoNode = currentOperacaoNode && form.subtipo_operacao 
    ? currentOperacaoNode.classificacoes[form.subtipo_operacao] 
    : null;
  const hasSubcategorias = currentClassificacaoNode && "subcategorias" in currentClassificacaoNode && currentClassificacaoNode.subcategorias;
  const hasDirectSubtipos = currentClassificacaoNode && "subtipos" in currentClassificacaoNode && currentClassificacaoNode.subtipos;

  // Can advance from step 1?
  const canAdvanceStep1 = form.entity_id && form.operacao && form.subtipo_operacao && form.finalidade;

  // Can advance from step 2?
  const canAdvanceStep2 = form.valor > 0 || form.valor_base > 0 || (form.rendimento_mensal_esperado && form.rendimento_mensal_esperado > 0);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
          <DialogDescription className="text-xs">
            {step === 1 && "Etapa 1 de 3 — Contraparte e tipo de operação"}
            {step === 2 && "Etapa 2 de 3 — Condições de pagamento"}
            {step === 3 && "Etapa 3 de 3 — Detalhes e governança"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-1 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* ==================== STEP 1: Contraparte + Operação ==================== */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              {/* Contraparte */}
              <div className="space-y-2">
                <RequiredLabel>Contraparte</RequiredLabel>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      options={entityOptions}
                      value={form.entity_id}
                      onValueChange={handleEntityChange}
                      placeholder="Buscar contraparte..."
                      searchPlaceholder="Digitar nome ou documento..."
                    />
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={() => setEntityDialogOpen(true)} title="Adicionar entidade">
                    <UserPlus size={16} />
                  </Button>
                </div>
              </div>

              {/* Operação: Compra / Venda / Patrimônio */}
              <div className="space-y-2">
                <RequiredLabel>Tipo de operação</RequiredLabel>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(classificacaoTree).map(([key, node]) => {
                    const Icon = node.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          set("operacao", key);
                          set("subtipo_operacao", "");
                          set("finalidade", "");
                          setCategoriaPatrimonio("");
                        }}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                          form.operacao === key
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/50 text-muted-foreground"
                        }`}
                      >
                        <Icon size={24} />
                        <span className="font-medium text-sm">{node.label}</span>
                        <span className="text-xs text-center">{node.sublabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Classificação (level 2) */}
              {currentOperacaoNode && (
                <div className="space-y-2 animate-fade-in">
                  <RequiredLabel>Classificação</RequiredLabel>
                  <div className={`grid gap-2 ${Object.keys(currentOperacaoNode.classificacoes).length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                    {Object.entries(currentOperacaoNode.classificacoes).map(([key, node]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          set("subtipo_operacao", key);
                          set("finalidade", "");
                          setCategoriaPatrimonio("");
                        }}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          form.subtipo_operacao === key
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/50 text-muted-foreground"
                        }`}
                      >
                        {node.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subcategoria for Patrimônio (level 3 intermediate) */}
              {hasSubcategorias && (
                <div className="space-y-2 animate-fade-in">
                  <RequiredLabel>Categoria</RequiredLabel>
                  <div className={`grid gap-2 ${Object.keys(currentClassificacaoNode.subcategorias!).length <= 3 ? `grid-cols-${Object.keys(currentClassificacaoNode.subcategorias!).length}` : "grid-cols-2"}`}>
                    {Object.entries(currentClassificacaoNode.subcategorias!).map(([key, sub]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setCategoriaPatrimonio(key);
                          set("finalidade", "");
                        }}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          categoriaPatrimonio === key
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/50 text-muted-foreground"
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtipo final (leaf level) - direct subtipos */}
              {hasDirectSubtipos && (
                <div className="space-y-2 animate-fade-in">
                  <RequiredLabel>Subtipo</RequiredLabel>
                  <div className={`grid gap-2 ${currentClassificacaoNode.subtipos!.length <= 3 ? `grid-cols-${currentClassificacaoNode.subtipos!.length}` : "grid-cols-2"}`}>
                    {currentClassificacaoNode.subtipos!.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => set("finalidade", s.value)}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          form.finalidade === s.value
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/50 text-muted-foreground"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtipo final (leaf level) - from subcategorias */}
              {hasSubcategorias && categoriaPatrimonio && currentClassificacaoNode.subcategorias![categoriaPatrimonio] && (
                <div className="space-y-2 animate-fade-in">
                  <RequiredLabel>Subtipo</RequiredLabel>
                  <div className={`grid gap-2 ${currentClassificacaoNode.subcategorias![categoriaPatrimonio].subtipos.length <= 3 ? `grid-cols-${currentClassificacaoNode.subcategorias![categoriaPatrimonio].subtipos.length}` : "grid-cols-2"}`}>
                    {currentClassificacaoNode.subcategorias![categoriaPatrimonio].subtipos.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => set("finalidade", s.value)}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          form.finalidade === s.value
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/50 text-muted-foreground"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nome do contrato */}
              {form.entity_id && (
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do contrato</Label>
                  <Input id="nome" value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome descritivo do contrato" />
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button type="button" disabled={!canAdvanceStep1} onClick={() => setStep(2)} className="gap-1">
                  Próximo <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* ==================== STEP 2: Condições de Pagamento ==================== */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 flex-wrap">
                <Badge variant="outline">{classificacaoTree[form.operacao]?.label || form.operacao}</Badge>
                <Badge variant="outline">{getClassificacaoLabel(form.operacao, form.subtipo_operacao)}</Badge>
                {form.finalidade && <Badge variant="outline">{getFinalidadeLabel(form.operacao, form.subtipo_operacao, form.finalidade, categoriaPatrimonio)}</Badge>}
                {selectedEntity && <Badge variant="secondary">{selectedEntity.name}</Badge>}
              </div>

              {/* Produto/Serviço */}
              <div className="space-y-2">
                <Label>Produto / Serviço</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      options={productOptions}
                      value={form.product_id}
                      onValueChange={handleProductChange}
                      placeholder="Buscar produto/serviço..."
                      searchPlaceholder="Digitar código ou nome..."
                    />
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={() => setProductDialogOpen(true)} title="Adicionar produto/serviço">
                    <PackagePlus size={16} />
                  </Button>
                </div>
                {selectedProduct?.type === "imobilizado" && (
                  <p className="text-xs text-muted-foreground">
                    Ativo Imobilizado
                    {(selectedProduct as any).vida_util_fiscal_anos && ` • Depreciação fiscal: ${(selectedProduct as any).vida_util_fiscal_anos} anos`}
                    {(selectedProduct as any).vida_util_economica_anos && ` • Econômica: ${(selectedProduct as any).vida_util_economica_anos} anos`}
                  </p>
                )}
              </div>

              {/* ===== COMPRA / INVESTIMENTO ===== */}
              {isInvestimento && (
                <div className="space-y-4 border border-border rounded-lg p-4">
                  {isInvestimentoFinanceiro ? (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                      <div className="space-y-2">
                        <RequiredLabel>Valor total do investimento (R$)</RequiredLabel>
                        <Input type="number" min={0} step={0.01} value={form.valor} onChange={(e) => set("valor", Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <RequiredLabel>Rendimento mensal esperado (R$)</RequiredLabel>
                        <Input type="number" min={0} step={0.01} value={form.rendimento_mensal_esperado ?? 0} onChange={(e) => set("rendimento_mensal_esperado", Number(e.target.value))} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fade-in">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <RequiredLabel>Valor total (R$)</RequiredLabel>
                          <Input type="number" min={0} step={0.01} value={form.valor} onChange={(e) => set("valor", Number(e.target.value))} />
                        </div>
                      </div>
                      <InstallmentConfigSection form={form} set={set} contractId={contractId} isEditing={isEditing} />
                    </div>
                  )}
                </div>
              )}

              {/* ===== COMPRA / MERCADORIA ===== */}
              {isMercadoriaCompra && (
                <div className="space-y-4 border border-border rounded-lg p-4">
                  <div className="space-y-2">
                    <RequiredLabel>Valor total (R$)</RequiredLabel>
                    <Input type="number" min={0} step={0.01} value={form.valor} onChange={(e) => set("valor", Number(e.target.value))} />
                  </div>
                  <InstallmentConfigSection form={form} set={set} contractId={contractId} isEditing={isEditing} />
                </div>
              )}

              {/* ===== COMPRA / SERVIÇOS ===== */}
              {isServicosCompra && (
                <div className="space-y-4 border border-border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Serviço contratado — cadastre valor e condições de pagamento.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <RequiredLabel>Valor mensal (R$)</RequiredLabel>
                      <Input type="number" min={0} step={0.01} value={form.valor} onChange={(e) => set("valor", Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <RequiredLabel>Dia de pagamento (1-31)</RequiredLabel>
                      <Input type="number" min={1} max={31} value={form.dia_vencimento ?? ""} onChange={(e) => set("dia_vencimento", e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 10" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <RequiredLabel>Data de início</RequiredLabel>
                      <Input type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim do contrato</Label>
                      <Input type="date" value={form.vencimento} onChange={(e) => { set("vencimento", e.target.value); set("data_fim", e.target.value); }} disabled={form.prazo_indeterminado} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.prazo_indeterminado} onCheckedChange={(v) => { set("prazo_indeterminado", v); if (v) { set("data_fim", ""); set("vencimento", ""); } }} />
                    <Label className="text-sm">Prazo indeterminado</Label>
                  </div>
                </div>
              )}

              {/* ===== COMPRA / MATERIAL USO E CONSUMO (serviços recorrentes etc.) ===== */}
              {isMaterialUsoConsumo && (
                <div className="space-y-4 border border-border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Serviço ou material recorrente — cadastre dia de pagamento e valor mensal.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <RequiredLabel>Valor mensal (R$)</RequiredLabel>
                      <Input type="number" min={0} step={0.01} value={form.valor} onChange={(e) => set("valor", Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <RequiredLabel>Dia de pagamento (1-31)</RequiredLabel>
                      <Input type="number" min={1} max={31} value={form.dia_vencimento ?? ""} onChange={(e) => set("dia_vencimento", e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 10" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <RequiredLabel>Data de início</RequiredLabel>
                      <Input type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim do contrato</Label>
                      <Input type="date" value={form.vencimento} onChange={(e) => { set("vencimento", e.target.value); set("data_fim", e.target.value); }} disabled={form.prazo_indeterminado} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.prazo_indeterminado} onCheckedChange={(v) => { set("prazo_indeterminado", v); if (v) { set("data_fim", ""); set("vencimento", ""); } }} />
                    <Label className="text-sm">Prazo indeterminado</Label>
                  </div>
                </div>
              )}

              {/* ===== VENDA / SERVIÇOS ===== */}
              {isVendaServicos && (
                <div className="space-y-4 border border-border rounded-lg p-4">
                  <div className="space-y-2">
                    <RequiredLabel>Valor total do contrato (R$)</RequiredLabel>
                    <Input type="number" min={0} step={0.01} value={form.valor} onChange={(e) => set("valor", Number(e.target.value))} />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo do contrato</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setVendaServicoTipo("unico"); set("tipo_recorrencia", "unico"); }}
                        className={`p-3 rounded-lg border-2 text-sm transition-all ${vendaServicoTipo === "unico" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                      >
                        Contrato único
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVendaServicoTipo("mensalidade"); set("tipo_recorrencia", "mensal"); }}
                        className={`p-3 rounded-lg border-2 text-sm transition-all ${vendaServicoTipo === "mensalidade" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                      >
                        Com mensalidade
                      </button>
                    </div>
                  </div>

                  {vendaServicoTipo === "unico" && (
                    <div className="animate-fade-in">
                      <InstallmentConfigSection form={form} set={set} contractId={contractId} isEditing={isEditing} />
                    </div>
                  )}

                  {vendaServicoTipo === "mensalidade" && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <RequiredLabel>Valor da mensalidade (R$)</RequiredLabel>
                          <Input type="number" min={0} step={0.01} value={form.valor_base} onChange={(e) => set("valor_base", Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <RequiredLabel>Dia de vencimento mensal (1-31)</RequiredLabel>
                          <Input type="number" min={1} max={31} value={form.dia_vencimento ?? ""} onChange={(e) => set("dia_vencimento", e.target.value ? Number(e.target.value) : null)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <RequiredLabel>Data de início</RequiredLabel>
                          <Input type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Fim do contrato</Label>
                          <Input type="date" value={form.vencimento} onChange={(e) => { set("vencimento", e.target.value); set("data_fim", e.target.value); }} disabled={form.prazo_indeterminado} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={form.prazo_indeterminado} onCheckedChange={(v) => { set("prazo_indeterminado", v); if (v) { set("data_fim", ""); set("vencimento", ""); } }} />
                        <Label className="text-sm">Prazo indeterminado</Label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== VENDA / MERCADORIA ou VENDA DE ATIVO ===== */}
              {(isVendaMercadoria || isVendaAtivo) && (
                <div className="space-y-4 border border-border rounded-lg p-4">
                  <div className="space-y-2">
                    <RequiredLabel>Valor total (R$)</RequiredLabel>
                    <Input type="number" min={0} step={0.01} value={form.valor} onChange={(e) => set("valor", Number(e.target.value))} />
                  </div>
                  <InstallmentConfigSection form={form} set={set} contractId={contractId} isEditing={isEditing} />
                </div>
              )}

              {/* Dates for non-recurring sections that don't have dates yet */}
              {isInvestimentoFinanceiro && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel>Data de início</RequiredLabel>
                    <Input type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim do contrato</Label>
                    <Input type="date" value={form.vencimento} onChange={(e) => { set("vencimento", e.target.value); set("data_fim", e.target.value); }} disabled={form.prazo_indeterminado} />
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1">
                  <ArrowLeft size={16} /> Voltar
                </Button>
                <Button type="button" onClick={() => setStep(3)} className="gap-1">
                  Próximo <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* ==================== STEP 3: Detalhes finais ==================== */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 flex-wrap">
                <Badge variant="outline">{classificacaoTree[form.operacao]?.label || form.operacao}</Badge>
                <Badge variant="outline">{getClassificacaoLabel(form.operacao, form.subtipo_operacao)}</Badge>
                {form.finalidade && <Badge variant="outline">{getFinalidadeLabel(form.operacao, form.subtipo_operacao, form.finalidade, categoriaPatrimonio)}</Badge>}
                {selectedEntity && <Badge variant="secondary">{selectedEntity.name}</Badge>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Responsável interno</Label>
                  <Input value={form.responsavel_interno} onChange={(e) => set("responsavel_interno", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Área responsável</Label>
                  <Input value={form.area_responsavel} onChange={(e) => set("area_responsavel", e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} rows={2} />
              </div>

              {/* Documents section for editing */}
              {isEditing && contractId && (
                <DocumentsTab contractId={contractId} />
              )}

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)} className="gap-1">
                  <ArrowLeft size={16} /> Voltar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar contrato"}
                </Button>
              </div>
            </div>
          )}
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

// ==================== Installment Config Section (entrada + parcelas) ====================
function InstallmentConfigSection({ form, set, contractId, isEditing }: {
  form: ContractFormData;
  set: <K extends keyof ContractFormData>(key: K, value: ContractFormData[K]) => void;
  contractId?: string | null;
  isEditing: boolean;
}) {
  // Dates for non-recurring
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <RequiredLabel>Data de início</RequiredLabel>
          <Input type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Fim do contrato</Label>
          <Input type="date" value={form.vencimento} onChange={(e) => { set("vencimento", e.target.value); set("data_fim", e.target.value); }} />
        </div>
      </div>

      {/* Parcelas */}
      {isEditing && contractId ? (
        <InstallmentsSection contractId={contractId} contractValue={form.valor} />
      ) : (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-3">
          💡 Salve o contrato primeiro para cadastrar entrada e parcelas de pagamento.
        </p>
      )}
    </div>
  );
}

// ==================== Installments Section ====================
function InstallmentsSection({ contractId, contractValue }: { contractId: string; contractValue: number }) {
  const { installments, isLoading, create, createMany, remove, update } = useContractInstallments(contractId);
  const [showGenerator, setShowGenerator] = useState(false);
  const [genQty, setGenQty] = useState(3);
  const [genStartDate, setGenStartDate] = useState("");
  const [genInterval, setGenInterval] = useState(30);
  const [hasEntrada, setHasEntrada] = useState(true);
  const [entradaMode, setEntradaMode] = useState<"percentual" | "valor">("percentual");
  const [entradaPercentual, setEntradaPercentual] = useState(30);
  const [entradaValor, setEntradaValor] = useState(0);
  const [entradaDate, setEntradaDate] = useState("");

  const totalParcelas = installments.reduce((sum, i) => sum + Number(i.valor), 0);
  const diff = contractValue - totalParcelas;

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);

  const calcEntradaValor = () => {
    if (!hasEntrada) return 0;
    if (entradaMode === "percentual") return Math.round((contractValue * entradaPercentual) / 100 * 100) / 100;
    return entradaValor;
  };

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

  const handleValueChange = (changedId: string, newValue: number) => {
    const others = installments.filter((i) => i.id !== changedId);
    if (others.length === 0) {
      update.mutate({ id: changedId, valor: contractValue });
      return;
    }
    const remaining = Math.round((contractValue - newValue) * 100) / 100;
    const perOther = Math.round((remaining / others.length) * 100) / 100;
    const lastIdx = others.length - 1;
    const adjustedLast = Math.round((remaining - perOther * lastIdx) * 100) / 100;
    update.mutate({ id: changedId, valor: newValue });
    others.forEach((inst, idx) => {
      update.mutate({ id: inst.id, valor: idx === lastIdx ? adjustedLast : perOther });
    });
  };

  const handleGenerate = () => {
    if (!genStartDate || genQty < 1 || contractValue <= 0) return;
    const entrada = calcEntradaValor();
    const restante = contractValue - entrada;
    const numParcelas = genQty;
    const valorParcela = Math.round((restante / numParcelas) * 100) / 100;

    const parcelas: Array<{
      contract_id: string; descricao: string; numero: number;
      valor: number; data_vencimento: string; status: string;
    }> = [];

    let idx = 0;
    if (hasEntrada) {
      parcelas.push({
        contract_id: contractId,
        descricao: "Entrada",
        numero: 1,
        valor: entrada,
        data_vencimento: entradaDate || genStartDate,
        status: "pendente",
      });
      idx = 1;
    }

    for (let i = 0; i < numParcelas; i++) {
      const date = new Date(genStartDate);
      date.setDate(date.getDate() + genInterval * i);
      parcelas.push({
        contract_id: contractId,
        descricao: `Parcela ${i + 1}`,
        numero: idx + i + 1,
        valor: valorParcela,
        data_vencimento: date.toISOString().split("T")[0],
        status: "pendente",
      });
    }

    const totalGerado = parcelas.reduce((s, p) => s + p.valor, 0);
    const roundDiff = Math.round((contractValue - totalGerado) * 100) / 100;
    if (Math.abs(roundDiff) > 0 && parcelas.length > 0) {
      parcelas[parcelas.length - 1].valor = Math.round((parcelas[parcelas.length - 1].valor + roundDiff) * 100) / 100;
    }

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
          <div className="flex items-center gap-3">
            <Switch checked={hasEntrada} onCheckedChange={setHasEntrada} />
            <Label className="text-sm">Incluir entrada</Label>
          </div>

          {hasEntrada && (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Modo</Label>
                <Select value={entradaMode} onValueChange={(v) => setEntradaMode(v as "percentual" | "valor")}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">% do total</SelectItem>
                    <SelectItem value="valor">Valor fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{entradaMode === "percentual" ? "Percentual (%)" : "Valor (R$)"}</Label>
                {entradaMode === "percentual" ? (
                  <Input type="number" min={1} max={99} value={entradaPercentual} onChange={(e) => setEntradaPercentual(Number(e.target.value))} className="h-8 text-xs" />
                ) : (
                  <Input type="number" min={0} step={0.01} value={entradaValor} onChange={(e) => setEntradaValor(Number(e.target.value))} className="h-8 text-xs" />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data da entrada</Label>
                <Input type="date" min="2000-01-01" max="2099-12-31" value={entradaDate} onChange={(e) => setEntradaDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="col-span-3 text-xs text-muted-foreground">
                Entrada: <span className="font-mono font-medium text-foreground">{fmt(calcEntradaValor())}</span>
                {" · "}Restante: <span className="font-mono font-medium text-foreground">{fmt(contractValue - calcEntradaValor())}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nº parcelas</Label>
              <Input type="number" min={1} max={60} value={genQty} onChange={(e) => setGenQty(Number(e.target.value))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data 1ª parcela</Label>
              <Input type="date" min="2000-01-01" max="2099-12-31" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Intervalo (dias)</Label>
              <Input type="number" min={1} value={genInterval} onChange={(e) => setGenInterval(Number(e.target.value))} className="h-8 text-xs" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {hasEntrada && <>Entrada {fmt(calcEntradaValor())} + </>}
              {genQty} x {fmt((contractValue - calcEntradaValor()) / (genQty || 1))}
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
              <Input className="w-28 h-7 text-xs" value={inst.descricao} onChange={(e) => update.mutate({ id: inst.id, descricao: e.target.value })} />
              <Input className="w-24 h-7 text-xs text-right font-mono" type="number" min={0} step={0.01} value={inst.valor} onChange={(e) => handleValueChange(inst.id, Number(e.target.value))} />
              <Input className="w-32 h-7 text-xs" type="date" min="2000-01-01" max="2099-12-31" value={inst.data_vencimento}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val.length === 10) {
                    const year = parseInt(val.split("-")[0], 10);
                    if (year >= 2000 && year <= 2099) update.mutate({ id: inst.id, data_vencimento: val });
                  }
                }}
              />
              <Badge variant="outline" className={`text-xs capitalize ${inst.status === "pago" || inst.status === "recebido" ? "bg-success/10 text-success border-success/30" : ""}`}>
                {inst.status}
              </Badge>
              {inst.status === "pendente" && (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 text-success hover:text-success" onClick={() => update.mutate({ id: inst.id, status: "pago" })}>
                  <CheckCircle2 size={12} /> Pagar
                </Button>
              )}
              {(inst.status === "pago" || inst.status === "recebido") && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => update.mutate({ id: inst.id, status: "pendente" })}>
                  Reverter
                </Button>
              )}
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
    <div className="space-y-4 border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Documentos</h4>
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
                <Button type="button" variant="ghost" size="icon" onClick={() => remove.mutate(d.id)} className="text-destructive"><Trash2 size={14} /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
