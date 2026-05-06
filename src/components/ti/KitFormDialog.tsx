import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useITKits } from "@/hooks/useITKits";

const EQUIP_TYPES = [
  "notebook", "desktop", "monitor", "celular", "tablet", "impressora",
  "roteador", "servidor", "nobreak", "periferico", "eletrico_energia",
  "seguranca_controle", "apoio_operacional", "outro",
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: any;
}

export function KitFormDialog({ open, onOpenChange, initial }: Props) {
  const { upsertKit } = useITKits();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setItems(initial?.items ?? []);
    }
  }, [open, initial]);

  const addItem = () =>
    setItems((prev) => [...prev, { equipment_type: "notebook", equipment_subtype: "", quantity: 1, suggested_specs: {}, notes: "" }]);
  const updItem = (idx: number, patch: any) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const rmItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    if (!name.trim()) return;
    await upsertKit.mutateAsync({
      id: initial?.id,
      name: name.trim(),
      description: description.trim() || null,
      items,
    } as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar kit" : "Novo kit"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Nome do kit *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Kit Dev Sênior" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Itens do kit</Label>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />Adicionar item
              </Button>
            </div>

            {items.length === 0 && (
              <p className="text-xs text-muted-foreground py-3">Nenhum item. Clique em adicionar.</p>
            )}

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 border rounded">
                  <div className="col-span-4">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={it.equipment_type} onValueChange={(v) => updItem(idx, { equipment_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EQUIP_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs">Subtipo</Label>
                    <Input
                      value={it.equipment_subtype ?? ""}
                      onChange={(e) => updItem(idx, { equipment_subtype: e.target.value })}
                      placeholder="opcional"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Qtd</Label>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => updItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="sm" onClick={() => rmItem(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!name.trim() || upsertKit.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
