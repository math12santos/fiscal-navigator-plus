import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useITDepreciation } from "@/hooks/useITDepreciation";
import { useITEquipment } from "@/hooks/useITEquipment";
import { Pencil, AlertCircle } from "lucide-react";

const ECON_STATUS = ["novo","em_uso_saudavel","proximo_substituicao","substituicao_recomendada","obsoleto"];
const labelize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DepreciationTab() {
  const { list, update } = useITDepreciation();
  const equipments = useITEquipment().list.data ?? [];
  const eqMap = new Map(equipments.map((e: any) => [e.id, e]));

  const [open, setOpen] = useState(false);
  const [v, setV] = useState<any>(null);
  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  const rows = list.data ?? [];

  return (
    <div className="space-y-3">
      <div className="bg-warning/10 border border-warning/30 text-sm p-3 rounded-md flex gap-2">
        <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Aba espelho TI ↔ Financeiro</p>
          <p className="text-muted-foreground">Apenas o time financeiro deve preencher os parâmetros contábeis. Cálculos automáticos: Valor Contábil = NF − impostos recuperáveis − descontos + frete/instalação. Base depreciável = Valor Contábil − residual.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr className="text-left">
                <th className="p-3">Equipamento</th><th className="p-3">NF Bruto</th><th className="p-3">Valor contábil</th>
                <th className="p-3">Base depreciável</th><th className="p-3">Vida (meses)</th><th className="p-3">Status econômico</th>
                <th className="p-3">Pendência</th><th className="p-3 text-right w-20">Ação</th>
              </tr></thead>
              <tbody>
                {list.isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
                {!list.isLoading && rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Cadastre equipamentos para gerar parâmetros.</td></tr>}
                {rows.map((d: any) => {
                  const eq: any = eqMap.get(d.equipment_id);
                  return (
                    <tr key={d.id} className="border-t hover:bg-muted/30">
                      <td className="p-3"><div className="font-medium">{eq?.name ?? "—"}</div><div className="text-xs text-muted-foreground font-mono">{eq?.patrimonial_code}</div></td>
                      <td className="p-3">{fmt(Number(d.invoice_gross_value || 0))}</td>
                      <td className="p-3">{fmt(Number(d.accounting_value || 0))}</td>
                      <td className="p-3">{fmt(Number(d.depreciable_base || 0))}</td>
                      <td className="p-3">{d.accounting_useful_life_months ?? "—"}</td>
                      <td className="p-3">{d.manual_economic_status ? <Badge variant="outline">{labelize(d.manual_economic_status)}</Badge> : "—"}</td>
                      <td className="p-3">{d.requires_finance_input ? <Badge className="bg-warning/15 text-warning">Pendente Financeiro</Badge> : <Badge className="bg-success/15 text-success">OK</Badge>}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => { setV({ ...d }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {v && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Parâmetros de depreciação</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground mb-2">{(eqMap.get(v.equipment_id) as any)?.patrimonial_code} — {(eqMap.get(v.equipment_id) as any)?.name}</p>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">Depreciação contábil</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>NF — Valor bruto</Label><Input type="number" step="0.01" value={v.invoice_gross_value ?? 0} onChange={(e) => set("invoice_gross_value", parseFloat(e.target.value) || 0)} /></div>
                  <div><Label>Impostos recuperáveis</Label><Input type="number" step="0.01" value={v.recoverable_taxes ?? 0} onChange={(e) => set("recoverable_taxes", parseFloat(e.target.value) || 0)} /></div>
                  <div><Label>Impostos não recuperáveis</Label><Input type="number" step="0.01" value={v.non_recoverable_taxes ?? 0} onChange={(e) => set("non_recoverable_taxes", parseFloat(e.target.value) || 0)} /></div>
                  <div><Label>Frete / Instalação</Label><Input type="number" step="0.01" value={v.freight_install_setup ?? 0} onChange={(e) => set("freight_install_setup", parseFloat(e.target.value) || 0)} /></div>
                  <div><Label>Descontos</Label><Input type="number" step="0.01" value={v.discounts ?? 0} onChange={(e) => set("discounts", parseFloat(e.target.value) || 0)} /></div>
                  <div><Label>Valor residual contábil</Label><Input type="number" step="0.01" value={v.accounting_residual_value ?? 0} onChange={(e) => set("accounting_residual_value", parseFloat(e.target.value) || 0)} /></div>
                  <div><Label>Vida útil contábil (meses)</Label><Input type="number" value={v.accounting_useful_life_months ?? ""} onChange={(e) => set("accounting_useful_life_months", parseInt(e.target.value) || null)} /></div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Depreciação econômica</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Vida útil econômica (meses)</Label><Input type="number" value={v.economic_useful_life_months ?? ""} onChange={(e) => set("economic_useful_life_months", parseInt(e.target.value) || null)} /></div>
                  <div><Label>Valor residual econômico</Label><Input type="number" step="0.01" value={v.economic_residual_value ?? 0} onChange={(e) => set("economic_residual_value", parseFloat(e.target.value) || 0)} /></div>
                  <div className="col-span-2">
                    <Label>Status econômico</Label>
                    <Select value={v.manual_economic_status ?? ""} onValueChange={(val) => set("manual_economic_status", val || null)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{ECON_STATUS.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => { update.mutate(v); setOpen(false); }}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
