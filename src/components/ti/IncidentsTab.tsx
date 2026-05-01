import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { useITIncidents } from "@/hooks/useITIncidents";
import { SectionCard } from "@/components/SectionCard";

const TYPES = ["quebra_equipamento","furto","roubo","perda","dano_eletrico","dano_mau_uso","indisponibilidade_sistema","indisponibilidade_internet","vazamento_dados","acesso_indevido","ataque_cibernetico","falha_operacional","outro"];
const IMPACTS = ["baixo","medio","alto","critico"];
const STATUSES = ["registrado","em_analise","em_tratativa","resolvido","encerrado"];
const labelize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const IMPACT_TONE: Record<string, string> = {
  baixo: "bg-muted text-muted-foreground",
  medio: "bg-primary/15 text-primary",
  alto: "bg-warning/15 text-warning",
  critico: "bg-destructive/15 text-destructive",
};

export function IncidentsTab() {
  const { list, upsert, remove } = useITIncidents();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<any>(null);
  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  const rows = useMemo(() => {
    const t = q.toLowerCase().trim();
    return (list.data ?? []).filter((s: any) => !t || [s.incident_number, s.description].filter(Boolean).some((x: string) => x.toLowerCase().includes(t)));
  }, [list.data, q]);

  return (
    <div className="space-y-4">
      <SectionCard
        icon={ShieldAlert}
        title="Sinistros / Incidentes"
        description="Quebras, furtos, indisponibilidades e demais ocorrências com prejuízo estimado."
        actions={
          <>
            <div className="relative w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar incidente..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button onClick={() => { setV({ incident_type: "quebra_equipamento", operational_impact: "baixo", status: "registrado", occurred_at: new Date().toISOString() }); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Novo incidente
            </Button>
          </>
        }
      >
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left">
              <th className="p-3">Nº</th><th className="p-3">Tipo</th><th className="p-3">Ocorrência</th>
              <th className="p-3">Impacto</th><th className="p-3">Prejuízo</th><th className="p-3">Status</th>
              <th className="p-3 text-right w-28">Ações</th>
            </tr></thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!list.isLoading && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum incidente.</td></tr>}
              {rows.map((s: any) => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{s.incident_number}</td>
                  <td className="p-3 capitalize">{s.incident_type?.replace(/_/g, " ")}</td>
                  <td className="p-3">{new Date(s.occurred_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3"><Badge className={IMPACT_TONE[s.operational_impact]}>{labelize(s.operational_impact)}</Badge></td>
                  <td className="p-3">{fmt(Number(s.estimated_loss_value || 0))}</td>
                  <td className="p-3"><Badge variant="outline">{labelize(s.status)}</Badge></td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setV(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {v && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{v.id ? `Incidente ${v.incident_number}` : "Novo incidente"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={v.incident_type} onValueChange={(val) => set("incident_type", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((c) => <SelectItem key={c} value={c}>{labelize(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Ocorrido em *</Label><Input type="datetime-local" value={v.occurred_at ? v.occurred_at.slice(0, 16) : ""} onChange={(e) => set("occurred_at", e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
              <div className="col-span-2"><Label>Descrição</Label><Textarea value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
              <div>
                <Label>Impacto operacional</Label>
                <Select value={v.operational_impact} onValueChange={(val) => set("operational_impact", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{IMPACTS.map((c) => <SelectItem key={c} value={c}>{labelize(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={v.status} onValueChange={(val) => set("status", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((c) => <SelectItem key={c} value={c}>{labelize(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Impacto financeiro estimado</Label><Input type="number" step="0.01" value={v.estimated_financial_impact ?? 0} onChange={(e) => set("estimated_financial_impact", parseFloat(e.target.value) || 0)} /></div>
              <div><Label>Valor do prejuízo</Label><Input type="number" step="0.01" value={v.estimated_loss_value ?? 0} onChange={(e) => set("estimated_loss_value", parseFloat(e.target.value) || 0)} /></div>
              <div><Label>Valor recuperado</Label><Input type="number" step="0.01" value={v.recovered_value ?? 0} onChange={(e) => set("recovered_value", parseFloat(e.target.value) || 0)} /></div>
              <div><Label>Tempo de indisponibilidade (min)</Label><Input type="number" value={v.outage_duration_minutes ?? ""} onChange={(e) => set("outage_duration_minutes", parseInt(e.target.value) || null)} /></div>
              <div className="col-span-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.caused_outage} onChange={(e) => set("caused_outage", e.target.checked)} />Houve paralisação</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.insurance_triggered} onChange={(e) => set("insurance_triggered", e.target.checked)} />Acionou seguro</label>
              </div>
              {v.insurance_triggered && (
                <div className="col-span-2"><Label>Nº sinistro seguradora</Label><Input value={v.insurance_claim_number ?? ""} onChange={(e) => set("insurance_claim_number", e.target.value)} /></div>
              )}
              <div className="col-span-2"><Label>Ação corretiva</Label><Textarea value={v.corrective_action ?? ""} onChange={(e) => set("corrective_action", e.target.value)} /></div>
              <div className="col-span-2"><Label>Ação preventiva</Label><Textarea value={v.preventive_action ?? ""} onChange={(e) => set("preventive_action", e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => { upsert.mutate(v); setOpen(false); }}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
