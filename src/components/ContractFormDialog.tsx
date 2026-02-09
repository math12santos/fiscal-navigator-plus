import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useCostCenters } from "@/hooks/useCostCenters";

export interface ContractFormData {
  nome: string;
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
}

const tipos = ["Fornecedor", "Locação", "Tecnologia", "Serviço", "Seguro", "Outro"];
const statuses = ["Ativo", "Próximo ao vencimento", "Vencido", "Cancelado", "Pausado"];
const recorrencias = [
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
  nome: "", tipo: "Fornecedor", valor: 0, vencimento: "", status: "Ativo", notes: "",
  tipo_recorrencia: "mensal", intervalo_personalizado: null, data_inicio: "", data_fim: "",
  prazo_indeterminado: false, valor_base: 0, dia_vencimento: null,
  tipo_reajuste: "manual", indice_reajuste: "", percentual_reajuste: null,
  periodicidade_reajuste: "anual", proximo_reajuste: "",
  natureza_financeira: "fixo", impacto_resultado: "custo", cost_center_id: "",
  responsavel_interno: "", area_responsavel: "", sla_revisao_dias: null,
};

export default function ContractFormDialog({ open, onOpenChange, onSubmit, initialData, loading }: Props) {
  const [form, setForm] = useState<ContractFormData>({ ...defaultForm });
  const { costCenters } = useCostCenters();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="recorrencia">Recorrência</TabsTrigger>
              <TabsTrigger value="reajuste">Reajuste</TabsTrigger>
              <TabsTrigger value="governanca">Governança</TabsTrigger>
            </TabsList>

            {/* TAB: Básico */}
            <TabsContent value="basico" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do contrato</Label>
                <Input id="nome" value={form.nome} onChange={(e) => set("nome", e.target.value)} required maxLength={200} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
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
                  <Label htmlFor="vencimento">Vencimento (contrato)</Label>
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
                  <Label>Tipo de recorrência</Label>
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
              <div className="space-y-2">
                <Label htmlFor="dia_vencimento">Dia de vencimento mensal (1-31)</Label>
                <Input id="dia_vencimento" type="number" min={1} max={31} placeholder="Ex: 15" value={form.dia_vencimento ?? ""} onChange={(e) => set("dia_vencimento", e.target.value ? Number(e.target.value) : null)} />
                <p className="text-xs text-muted-foreground">Dia fixo do mês em que a parcela vence</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor_base">Valor base (R$)</Label>
                  <Input id="valor_base" type="number" min={0} step={0.01} value={form.valor_base} onChange={(e) => set("valor_base", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor mensal (R$)</Label>
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
              <div className="flex items-center gap-3">
                <Switch checked={form.prazo_indeterminado} onCheckedChange={(v) => { set("prazo_indeterminado", v); if (v) set("data_fim", ""); }} />
                <Label>Prazo indeterminado</Label>
              </div>
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
          </Tabs>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
