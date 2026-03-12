import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Plus, Edit2, Trash2, Wand2, Layers } from "lucide-react";
import { useGroupingMacrogroups, type GroupingMacrogroup, type GroupingGroup } from "@/hooks/useGroupingMacrogroups";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function GroupingMacrogroupManager({ ruleCountByGroup }: { ruleCountByGroup?: Map<string, number> }) {
  const {
    macrogroups, groups, isLoading,
    getGroupsForMacrogroup,
    createMacrogroup, updateMacrogroup, deleteMacrogroup, toggleMacrogroup,
    createGroup, updateGroup, deleteGroup, toggleGroup,
    seedDefaults,
  } = useGroupingMacrogroups();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [mgDialog, setMgDialog] = useState<{ open: boolean; editing: GroupingMacrogroup | null }>({ open: false, editing: null });
  const [gDialog, setGDialog] = useState<{ open: boolean; macrogroupId: string; editing: GroupingGroup | null }>({ open: false, macrogroupId: "", editing: null });

  // MG form state
  const [mgName, setMgName] = useState("");
  const [mgIcon, setMgIcon] = useState("Layers");
  const [mgColor, setMgColor] = useState("#6366f1");

  // G form state
  const [gName, setGName] = useState("");

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openMgDialog = (mg: GroupingMacrogroup | null) => {
    setMgName(mg?.name ?? "");
    setMgIcon(mg?.icon ?? "Layers");
    setMgColor(mg?.color ?? "#6366f1");
    setMgDialog({ open: true, editing: mg });
  };

  const handleMgSubmit = () => {
    const data = { name: mgName, icon: mgIcon, color: mgColor, order_index: macrogroups.length, enabled: true };
    if (mgDialog.editing) {
      updateMacrogroup.mutate({ id: mgDialog.editing.id, ...data }, { onSuccess: () => setMgDialog({ open: false, editing: null }) });
    } else {
      createMacrogroup.mutate(data, { onSuccess: () => setMgDialog({ open: false, editing: null }) });
    }
  };

  const openGDialog = (macrogroupId: string, g: GroupingGroup | null) => {
    setGName(g?.name ?? "");
    setGDialog({ open: true, macrogroupId, editing: g });
  };

  const handleGSubmit = () => {
    const data = { macrogroup_id: gDialog.macrogroupId, name: gName, order_index: 0, enabled: true };
    if (gDialog.editing) {
      updateGroup.mutate({ id: gDialog.editing.id, name: gName }, { onSuccess: () => setGDialog({ open: false, macrogroupId: "", editing: null }) });
    } else {
      createGroup.mutate(data, { onSuccess: () => setGDialog({ open: false, macrogroupId: "", editing: null }) });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Macrogrupos e Grupos</h3>
        <div className="flex items-center gap-2">
          {macrogroups.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
              <Wand2 size={14} /> Gerar Padrão
            </Button>
          )}
          <Button size="sm" onClick={() => openMgDialog(null)}>
            <Plus size={14} /> Macrogrupo
          </Button>
        </div>
      </div>

      {macrogroups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground space-y-2">
          <Layers className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p>Nenhum macrogrupo configurado.</p>
          <p className="text-xs">Clique em "Gerar Padrão" para criar a estrutura inicial.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {macrogroups.map((mg) => {
            const mgGroups = getGroupsForMacrogroup(mg.id);
            const isExpanded = expandedIds.has(mg.id);

            return (
              <Collapsible key={mg.id} open={isExpanded} onOpenChange={() => toggleExpanded(mg.id)}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card hover:bg-muted/50 transition-colors">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: mg.color }} />
                  <span className="font-medium text-sm flex-1">{mg.name}</span>
                  <Badge variant="secondary" className="text-xs">{mgGroups.length} grupo(s)</Badge>
                  <Switch
                    checked={mg.enabled}
                    onCheckedChange={(checked) => toggleMacrogroup.mutate({ id: mg.id, enabled: checked })}
                    className="scale-75"
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openMgDialog(mg); }}>
                    <Edit2 size={12} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteMacrogroup.mutate(mg.id); }}>
                    <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
                <CollapsibleContent>
                  <div className="ml-8 mt-1 space-y-1">
                    {mgGroups.map((g) => (
                      <div key={g.id} className="flex items-center gap-2 px-3 py-1.5 rounded border border-dashed bg-muted/30">
                        <span className="text-sm flex-1">{g.name}</span>
                        <Switch
                          checked={g.enabled}
                          onCheckedChange={(checked) => toggleGroup.mutate({ id: g.id, enabled: checked })}
                          className="scale-75"
                        />
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openGDialog(mg.id, g)}>
                          <Edit2 size={11} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteGroup.mutate(g.id)}>
                          <Trash2 size={11} className="text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openGDialog(mg.id, null)}>
                      <Plus size={12} /> Adicionar Grupo
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Macrogroup Dialog */}
      <Dialog open={mgDialog.open} onOpenChange={(o) => setMgDialog({ open: o, editing: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{mgDialog.editing ? "Editar Macrogrupo" : "Novo Macrogrupo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={mgName} onChange={(e) => setMgName(e.target.value)} placeholder="Ex: Pessoal e RH" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Input value={mgIcon} onChange={(e) => setMgIcon(e.target.value)} placeholder="Layers" />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input type="color" value={mgColor} onChange={(e) => setMgColor(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMgDialog({ open: false, editing: null })}>Cancelar</Button>
            <Button onClick={handleMgSubmit} disabled={!mgName}>
              {mgDialog.editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={gDialog.open} onOpenChange={(o) => setGDialog({ open: o, macrogroupId: "", editing: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{gDialog.editing ? "Editar Grupo" : "Novo Grupo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Ex: Folha, Aluguel" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGDialog({ open: false, macrogroupId: "", editing: null })}>Cancelar</Button>
            <Button onClick={handleGSubmit} disabled={!gName}>
              {gDialog.editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
