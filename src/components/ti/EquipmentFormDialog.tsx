import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const EQUIP_TYPES = ["notebook","desktop","monitor","celular","tablet","impressora","roteador","servidor","nobreak","periferico","outro"];
const STATUSES = ["disponivel","em_uso","ativo","em_manutencao","extraviado","baixado","vendido","inativo"];
const ACQ_FORMS = ["compra_a_vista","compra_parcelada","leasing","comodato","locacao","outro"];
const CONSERV = ["novo","bom","regular","ruim","sucata"];

const labelize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: any;
  onSave: (v: any) => void;
}

export function EquipmentFormDialog({ open, onOpenChange, initial, onSave }: Props) {
  const [v, setV] = useState<any>(initial ?? { equipment_type: "notebook", status: "disponivel", acquisition_form: "compra_a_vista" });

  // reset when opened with new initial
  if (open && initial && initial.id !== v.id) setV(initial);

  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{v.id ? "Editar equipamento" : "Novo equipamento"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basico">
          <TabsList>
            <TabsTrigger value="basico">Básico</TabsTrigger>
            <TabsTrigger value="aquisicao">Aquisição</TabsTrigger>
            <TabsTrigger value="vida">Vida útil</TabsTrigger>
            <TabsTrigger value="planejamento">Planejamento</TabsTrigger>
          </TabsList>

          <TabsContent value="basico" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
              <div>
                <Label>Tipo *</Label>
                <Select value={v.equipment_type} onValueChange={(val) => set("equipment_type", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EQUIP_TYPES.map((t) => <SelectItem key={t} value={t}>{labelize(t)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Marca</Label><Input value={v.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></div>
              <div><Label>Modelo</Label><Input value={v.model ?? ""} onChange={(e) => set("model", e.target.value)} /></div>
              <div><Label>Nº de série</Label><Input value={v.serial_number ?? ""} onChange={(e) => set("serial_number", e.target.value)} /></div>
              <div><Label>Localização</Label><Input value={v.location ?? ""} onChange={(e) => set("location", e.target.value)} /></div>
              <div>
                <Label>Status</Label>
                <Select value={v.status} onValueChange={(val) => set("status", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conservação</Label>
                <Select value={v.conservation_state ?? ""} onValueChange={(val) => set("conservation_state", val || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{CONSERV.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
          </TabsContent>

          <TabsContent value="aquisicao" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data de aquisição</Label><Input type="date" value={v.acquisition_date ?? ""} onChange={(e) => set("acquisition_date", e.target.value || null)} /></div>
              <div><Label>Nº NF</Label><Input value={v.invoice_number ?? ""} onChange={(e) => set("invoice_number", e.target.value)} /></div>
              <div><Label>Valor de aquisição</Label><Input type="number" step="0.01" value={v.acquisition_value ?? 0} onChange={(e) => set("acquisition_value", parseFloat(e.target.value) || 0)} /></div>
              <div>
                <Label>Forma de aquisição</Label>
                <Select value={v.acquisition_form ?? "compra_a_vista"} onValueChange={(val) => set("acquisition_form", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACQ_FORMS.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(v.acquisition_form === "compra_parcelada" || v.acquisition_form === "leasing") && (
                <>
                  <div><Label>Nº parcelas</Label><Input type="number" value={v.installments_count ?? ""} onChange={(e) => set("installments_count", parseInt(e.target.value) || null)} /></div>
                  <div><Label>Valor parcela</Label><Input type="number" step="0.01" value={v.installment_value ?? ""} onChange={(e) => set("installment_value", parseFloat(e.target.value) || null)} /></div>
                  <div><Label>1ª parcela</Label><Input type="date" value={v.first_installment_date ?? ""} onChange={(e) => set("first_installment_date", e.target.value || null)} /></div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="vida" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vida útil contábil (meses)</Label><Input type="number" value={v.useful_life_accounting_months ?? ""} onChange={(e) => set("useful_life_accounting_months", parseInt(e.target.value) || null)} /></div>
              <div><Label>Vida útil econômica (meses)</Label><Input type="number" value={v.useful_life_economic_months ?? ""} onChange={(e) => set("useful_life_economic_months", parseInt(e.target.value) || null)} /></div>
              <div><Label>Valor residual</Label><Input type="number" step="0.01" value={v.residual_value ?? 0} onChange={(e) => set("residual_value", parseFloat(e.target.value) || 0)} /></div>
            </div>
          </TabsContent>

          <TabsContent value="planejamento" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.enters_patrimonial_planning} onChange={(e) => set("enters_patrimonial_planning", e.target.checked)} /> Entra no planejamento patrimonial</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.generates_future_installments} onChange={(e) => set("generates_future_installments", e.target.checked)} /> Gera parcelas futuras</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.generates_recurring_cost} onChange={(e) => set("generates_recurring_cost", e.target.checked)} /> Gera custo recorrente</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.generates_replacement_forecast} onChange={(e) => set("generates_replacement_forecast", e.target.checked)} /> Prevê substituição futura</label>
            </div>
            {v.generates_replacement_forecast && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div><Label>Data prevista de substituição</Label><Input type="date" value={v.replacement_forecast_date ?? ""} onChange={(e) => set("replacement_forecast_date", e.target.value || null)} /></div>
                <div><Label>Valor estimado</Label><Input type="number" step="0.01" value={v.replacement_estimated_value ?? ""} onChange={(e) => set("replacement_estimated_value", parseFloat(e.target.value) || null)} /></div>
                <div className="col-span-2"><Label>Justificativa</Label><Textarea value={v.replacement_justification ?? ""} onChange={(e) => set("replacement_justification", e.target.value)} /></div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { onSave(v); onOpenChange(false); }} disabled={!v.name}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
