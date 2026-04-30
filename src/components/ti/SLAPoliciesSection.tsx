import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useITSLA } from "@/hooks/useITSLA";

const CATS = ["suporte_tecnico","manutencao_equipamento","solicitacao_acesso","bloqueio_acesso","instalacao_sistema","problema_sistema","problema_internet","problema_email","solicitacao_compra","solicitacao_troca","seguranca_informacao","outro"];
const PRIO = ["baixa","media","alta","critica"];
const labelize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

export function SLAPoliciesSection() {
  const { list, upsert, remove } = useITSLA();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<any>(null);
  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  const startNew = () => {
    setV({ name: "", priority: "media", category: null, response_time_hours: 4, resolution_time_hours: 24, business_hours_only: false, active: true });
    setOpen(true);
  };

  const rows = list.data ?? [];

  return (
    <Card>
      <CardHeader className="flex-row justify-between items-center space-y-0">
        <CardTitle className="text-base">Políticas de SLA</CardTitle>
        <Button size="sm" onClick={startNew}><Plus className="h-4 w-4 mr-2" />Nova política</Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Nome</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Prioridade</th>
                <th className="p-3">Resposta (h)</th>
                <th className="p-3">Resolução (h)</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Nenhuma política cadastrada. Cadastre ao menos uma por prioridade para tracking automático de SLA nos chamados.
                </td></tr>
              )}
              {rows.map((p: any) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 capitalize">{p.category ? labelize(p.category) : <span className="text-muted-foreground italic">(qualquer)</span>}</td>
                  <td className="p-3"><Badge variant="outline">{labelize(p.priority)}</Badge></td>
                  <td className="p-3">{p.response_time_hours}h</td>
                  <td className="p-3">{p.resolution_time_hours}h</td>
                  <td className="p-3">
                    {p.active
                      ? <Badge className="bg-success/15 text-success">Ativa</Badge>
                      : <Badge variant="outline">Inativa</Badge>}
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setV({ ...p }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir política?")) remove.mutate(p.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      {v && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{v.id ? "Editar política" : "Nova política"} de SLA</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: SLA Crítica - Segurança" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prioridade *</Label>
                  <Select value={v.priority} onValueChange={(val) => set("priority", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIO.map((p) => <SelectItem key={p} value={p}>{labelize(p)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria (opcional)</Label>
                  <Select value={v.category ?? "__none__"} onValueChange={(val) => set("category", val === "__none__" ? null : val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Qualquer —</SelectItem>
                      {CATS.map((c) => <SelectItem key={c} value={c}>{labelize(c)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tempo de resposta (h)</Label>
                  <Input type="number" value={v.response_time_hours ?? 0} onChange={(e) => set("response_time_hours", parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Tempo de resolução (h)</Label>
                  <Input type="number" value={v.resolution_time_hours ?? 0} onChange={(e) => set("resolution_time_hours", parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={!!v.business_hours_only} onCheckedChange={(c) => set("business_hours_only", c)} />
                  <Label className="cursor-pointer">Apenas horário comercial</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={!!v.active} onCheckedChange={(c) => set("active", c)} />
                  <Label className="cursor-pointer">Ativa</Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Quando um chamado é criado, o sistema busca a política mais específica (mesma categoria + prioridade) e calcula automaticamente os prazos de resposta e resolução.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={!v.name} onClick={() => { upsert.mutate(v, { onSuccess: () => setOpen(false) }); }}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
