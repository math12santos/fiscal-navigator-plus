import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { usePositions, useMutatePosition, useRoutines, useMutateRoutine } from "@/hooks/useDP";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useToast } from "@/hooks/use-toast";

const PERIODICITIES = ["diaria", "semanal", "quinzenal", "mensal", "trimestral", "anual"];

export default function DPCargos() {
  const { data: positions = [] } = usePositions();
  const { costCenters = [] } = useCostCenters();
  const { create: createPos, update: updatePos, remove: removePos } = useMutatePosition();
  const { toast } = useToast();

  const [posDialogOpen, setPosDialogOpen] = useState(false);
  const [editingPos, setEditingPos] = useState<any>(null);
  const [posForm, setPosForm] = useState({ name: "", level_hierarchy: "1", parent_id: "", cost_center_id: "", salary_min: "", salary_max: "", responsibilities: "" });
  const [expandedPos, setExpandedPos] = useState<string | null>(null);

  const posTree = useMemo(() => {
    const roots = positions.filter((p: any) => !p.parent_id);
    const children = (parentId: string): any[] => positions.filter((p: any) => p.parent_id === parentId);
    const buildTree = (items: any[], level: number = 0): any[] => {
      return items.flatMap((item) => [{ ...item, _level: level }, ...buildTree(children(item.id), level + 1)]);
    };
    return buildTree(roots);
  }, [positions]);

  const openNewPos = () => {
    setEditingPos(null);
    setPosForm({ name: "", level_hierarchy: "1", parent_id: "", cost_center_id: "", salary_min: "", salary_max: "", responsibilities: "" });
    setPosDialogOpen(true);
  };

  const openEditPos = (p: any) => {
    setEditingPos(p);
    setPosForm({
      name: p.name, level_hierarchy: String(p.level_hierarchy),
      parent_id: p.parent_id || "", cost_center_id: p.cost_center_id || "",
      salary_min: String(p.salary_min || ""), salary_max: String(p.salary_max || ""),
      responsibilities: p.responsibilities || "",
    });
    setPosDialogOpen(true);
  };

  const handleSavePos = () => {
    const payload = {
      name: posForm.name,
      level_hierarchy: Number(posForm.level_hierarchy) || 1,
      parent_id: posForm.parent_id || null,
      cost_center_id: posForm.cost_center_id || null,
      salary_min: Number(posForm.salary_min) || 0,
      salary_max: Number(posForm.salary_max) || 0,
      responsibilities: posForm.responsibilities || null,
    };
    if (editingPos) {
      updatePos.mutate({ id: editingPos.id, ...payload }, { onSuccess: () => { toast({ title: "Cargo atualizado" }); setPosDialogOpen(false); } });
    } else {
      createPos.mutate(payload, { onSuccess: () => { toast({ title: "Cargo criado" }); setPosDialogOpen(false); } });
    }
  };

  return (
    <div className="space-y-6">
      {/* Organograma / Lista */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Organograma de Cargos</CardTitle>
          <Button size="sm" onClick={openNewPos}><Plus size={14} className="mr-1" /> Novo Cargo</Button>
        </CardHeader>
        <CardContent>
          {posTree.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum cargo cadastrado</div>
          ) : (
            <div className="space-y-1">
              {posTree.map((p: any) => (
                <div key={p.id}>
                  <div
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    style={{ paddingLeft: `${p._level * 24 + 8}px` }}
                    onClick={() => setExpandedPos(expandedPos === p.id ? null : p.id)}
                  >
                    {expandedPos === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="font-medium text-sm text-foreground">{p.name}</span>
                    <Badge variant="outline" className="text-[10px] ml-1">Nível {p.level_hierarchy}</Badge>
                    <div className="ml-auto flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEditPos(p); }}><Edit2 size={11} /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); removePos.mutate(p.id); }}><Trash2 size={11} /></Button>
                    </div>
                  </div>
                  {expandedPos === p.id && <RoutinesPanel positionId={p.id} />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Position Dialog */}
      <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingPos ? "Editar Cargo" : "Novo Cargo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nome do Cargo</Label><Input value={posForm.name} onChange={(e) => setPosForm({ ...posForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Nível Hierárquico</Label><Input type="number" value={posForm.level_hierarchy} onChange={(e) => setPosForm({ ...posForm, level_hierarchy: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Superior</Label>
                <Select value={posForm.parent_id} onValueChange={(v) => setPosForm({ ...posForm, parent_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {positions.filter((p: any) => p.id !== editingPos?.id).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Centro de Custo</Label>
                <Select value={posForm.cost_center_id} onValueChange={(v) => setPosForm({ ...posForm, cost_center_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {costCenters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Salário Mín.</Label><Input type="number" value={posForm.salary_min} onChange={(e) => setPosForm({ ...posForm, salary_min: e.target.value })} /></div>
              <div className="space-y-1"><Label>Salário Máx.</Label><Input type="number" value={posForm.salary_max} onChange={(e) => setPosForm({ ...posForm, salary_max: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Responsabilidades</Label><Textarea value={posForm.responsibilities} onChange={(e) => setPosForm({ ...posForm, responsibilities: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPosDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePos} disabled={!posForm.name}>{editingPos ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoutinesPanel({ positionId }: { positionId: string }) {
  const { data: routines = [] } = useRoutines(positionId);
  const { create, remove } = useMutateRoutine();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", objective: "", periodicity: "mensal", sla_days: "1", checklist: "" });

  const handleAdd = () => {
    create.mutate({ ...form, sla_days: Number(form.sla_days), position_id: positionId }, {
      onSuccess: () => { toast({ title: "Rotina adicionada" }); setAddOpen(false); setForm({ name: "", objective: "", periodicity: "mensal", sla_days: "1", checklist: "" }); },
    });
  };

  return (
    <div className="ml-8 mb-3 border-l-2 border-border pl-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Rotinas</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setAddOpen(true)}><Plus size={10} className="mr-1" /> Adicionar</Button>
      </div>
      {routines.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma rotina cadastrada</p>
      ) : (
        routines.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
            <div>
              <span className="font-medium text-foreground">{r.name}</span>
              <Badge variant="outline" className="ml-2 text-[9px]">{r.periodicity}</Badge>
              {r.sla_days && <span className="text-muted-foreground ml-2">SLA: {r.sla_days}d</span>}
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => remove.mutate(r.id)}><Trash2 size={10} /></Button>
          </div>
        ))
      )}
      {addOpen && (
        <div className="border border-border rounded p-3 space-y-2 bg-card">
          <Input placeholder="Nome da rotina" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-xs" />
          <Input placeholder="Objetivo" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="h-8 text-xs" />
          <div className="flex gap-2">
            <Select value={form.periodicity} onValueChange={(v) => setForm({ ...form, periodicity: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODICITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="SLA (dias)" value={form.sla_days} onChange={(e) => setForm({ ...form, sla_days: e.target.value })} className="h-8 text-xs w-24" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!form.name}>Salvar</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddOpen(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
