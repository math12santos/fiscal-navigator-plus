import { useState, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Plus, Edit2, Trash2, Layers, Check, X, Sparkles, GripVertical } from "lucide-react";
import { useGroupingMacrogroups, DEFAULT_SEED, type GroupingMacrogroup, type GroupingGroup } from "@/hooks/useGroupingMacrogroups";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type DragContext = { type: "macrogroup"; id: string } | { type: "group"; id: string; macrogroupId: string };

export default function GroupingMacrogroupManager({ ruleCountByGroup }: { ruleCountByGroup?: Map<string, number> }) {
  const {
    macrogroups, groups, isLoading,
    getGroupsForMacrogroup,
    createMacrogroup, updateMacrogroup, deleteMacrogroup, toggleMacrogroup,
    createGroup, updateGroup, deleteGroup, toggleGroup,
    seedDefaults, seedSingleMacrogroup,
  } = useGroupingMacrogroups();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [ignoredSeeds, setIgnoredSeeds] = useState<Set<number>>(new Set());
  const [mgDialog, setMgDialog] = useState<{ open: boolean; editing: GroupingMacrogroup | null }>({ open: false, editing: null });
  const [gDialog, setGDialog] = useState<{ open: boolean; macrogroupId: string; editing: GroupingGroup | null }>({ open: false, macrogroupId: "", editing: null });

  const [mgName, setMgName] = useState("");
  const [mgIcon, setMgIcon] = useState("Layers");
  const [mgColor, setMgColor] = useState("#6366f1");
  const [gName, setGName] = useState("");

  // Drag state
  const dragItem = useRef<DragContext | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Seeds not yet activated or ignored
  const pendingSeeds = useMemo(() => {
    const existingNames = new Set(macrogroups.map((m) => m.name));
    return DEFAULT_SEED.map((s, i) => ({ ...s, index: i }))
      .filter((s) => !existingNames.has(s.name) && !ignoredSeeds.has(s.index));
  }, [macrogroups, ignoredSeeds]);

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

  const handleActivateAll = () => {
    const existingNames = new Set(macrogroups.map((m) => m.name));
    const toActivate = DEFAULT_SEED.map((s, i) => ({ ...s, index: i }))
      .filter((s) => !existingNames.has(s.name) && !ignoredSeeds.has(s.index));
    if (toActivate.length > 0) {
      seedDefaults.mutate();
    }
  };

  // ── Drag & Drop handlers for macrogroups ──
  const handleMgDragStart = useCallback((e: React.DragEvent, mg: GroupingMacrogroup) => {
    dragItem.current = { type: "macrogroup", id: mg.id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", mg.id);
  }, []);

  const handleMgDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (dragItem.current?.type !== "macrogroup" || dragItem.current.id === targetId) return;
    e.dataTransfer.dropEffect = "move";
    setDragOverId(targetId);
  }, []);

  const handleMgDrop = useCallback((e: React.DragEvent, targetMg: GroupingMacrogroup) => {
    e.preventDefault();
    setDragOverId(null);
    if (dragItem.current?.type !== "macrogroup") return;
    const draggedId = dragItem.current.id;
    if (draggedId === targetMg.id) return;

    const sorted = [...macrogroups].sort((a, b) => a.order_index - b.order_index);
    const draggedIdx = sorted.findIndex((m) => m.id === draggedId);
    const targetIdx = sorted.findIndex((m) => m.id === targetMg.id);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    reordered.forEach((m, i) => {
      if (m.order_index !== i) {
        updateMacrogroup.mutate({ id: m.id, order_index: i });
      }
    });
    dragItem.current = null;
  }, [macrogroups, updateMacrogroup]);

  // ── Drag & Drop handlers for groups ──
  const handleGDragStart = useCallback((e: React.DragEvent, g: GroupingGroup, macrogroupId: string) => {
    dragItem.current = { type: "group", id: g.id, macrogroupId };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", g.id);
  }, []);

  const handleGDragOver = useCallback((e: React.DragEvent, targetId: string, macrogroupId: string) => {
    e.preventDefault();
    if (dragItem.current?.type !== "group") return;
    if ((dragItem.current as any).macrogroupId !== macrogroupId) return;
    if (dragItem.current.id === targetId) return;
    e.dataTransfer.dropEffect = "move";
    setDragOverId(targetId);
  }, []);

  const handleGDrop = useCallback((e: React.DragEvent, targetG: GroupingGroup, macrogroupId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (dragItem.current?.type !== "group") return;
    if ((dragItem.current as any).macrogroupId !== macrogroupId) return;
    const draggedId = dragItem.current.id;
    if (draggedId === targetG.id) return;

    const mgGroups = getGroupsForMacrogroup(macrogroupId).sort((a, b) => a.order_index - b.order_index);
    const draggedIdx = mgGroups.findIndex((g) => g.id === draggedId);
    const targetIdx = mgGroups.findIndex((g) => g.id === targetG.id);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const reordered = [...mgGroups];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    reordered.forEach((g, i) => {
      if (g.order_index !== i) {
        updateGroup.mutate({ id: g.id, order_index: i });
      }
    });
    dragItem.current = null;
  }, [getGroupsForMacrogroup, updateGroup]);

  const handleDragEnd = useCallback(() => {
    dragItem.current = null;
    setDragOverId(null);
  }, []);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Macrogrupos e Grupos</h3>
        <Button size="sm" onClick={() => openMgDialog(null)}>
          <Plus size={14} /> Macrogrupo
        </Button>
      </div>

      {/* ── Active macrogroups tree ── */}
      {macrogroups.length > 0 && (
        <div className="space-y-1">
          {[...macrogroups].sort((a, b) => a.order_index - b.order_index).map((mg) => {
            const mgGroups = getGroupsForMacrogroup(mg.id).sort((a, b) => a.order_index - b.order_index);
            const isExpanded = expandedIds.has(mg.id);
            const isDragOver = dragOverId === mg.id;

            return (
              <Collapsible key={mg.id} open={isExpanded} onOpenChange={() => toggleExpanded(mg.id)}>
                <div
                  draggable
                  onDragStart={(e) => handleMgDragStart(e, mg)}
                  onDragOver={(e) => handleMgDragOver(e, mg.id)}
                  onDrop={(e) => handleMgDrop(e, mg)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border bg-card hover:bg-muted/50 transition-colors ${
                    isDragOver ? "ring-2 ring-primary border-primary" : ""
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: mg.color }} />
                  <span className="font-medium text-sm flex-1">{mg.name}</span>
                  <Badge variant="secondary" className="text-xs">{mgGroups.length} grupo(s)</Badge>
                  {ruleCountByGroup && (
                    <Badge variant="outline" className="text-xs">
                      {mgGroups.reduce((s, g) => s + (ruleCountByGroup.get(g.id) ?? 0), 0)} regra(s)
                    </Badge>
                  )}
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
                    {mgGroups.map((g) => {
                      const isGDragOver = dragOverId === g.id;
                      return (
                        <div
                          key={g.id}
                          draggable
                          onDragStart={(e) => handleGDragStart(e, g, mg.id)}
                          onDragOver={(e) => handleGDragOver(e, g.id, mg.id)}
                          onDrop={(e) => handleGDrop(e, g, mg.id)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded border border-dashed bg-muted/30 transition-colors ${
                            isGDragOver ? "ring-2 ring-primary border-primary" : ""
                          }`}
                        >
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
                          <span className="text-sm flex-1">{g.name}</span>
                          {ruleCountByGroup && (
                            <Badge variant="outline" className="text-[10px]">{ruleCountByGroup.get(g.id) ?? 0} regra(s)</Badge>
                          )}
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
                      );
                    })}
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

      {/* ── Seed suggestions (selective activation) ── */}
      {pendingSeeds.length > 0 && (
        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                {macrogroups.length === 0 ? "Sugestões de macrogrupos para começar" : "Macrogrupos sugeridos disponíveis"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleActivateAll}
              disabled={seedDefaults.isPending}
            >
              <Check size={12} /> Ativar Todos ({pendingSeeds.length})
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {pendingSeeds.map((seed) => (
              <Card key={seed.index} className="border-dashed">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: seed.color + "18" }}>
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: seed.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{seed.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {seed.groups.map((g) => (
                          <Badge key={g} variant="secondary" className="text-[10px] font-normal">{g}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        onClick={() => seedSingleMacrogroup.mutate(seed.index)}
                        disabled={seedSingleMacrogroup.isPending}
                      >
                        <Check size={12} /> Ativar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => setIgnoredSeeds((prev) => new Set(prev).add(seed.index))}
                      >
                        <X size={12} /> Ignorar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {macrogroups.length === 0 && pendingSeeds.length === 0 && (
        <div className="text-center py-8 text-muted-foreground space-y-2">
          <Layers className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p>Nenhum macrogrupo configurado.</p>
          <p className="text-xs">Clique em "+ Macrogrupo" para criar manualmente.</p>
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
