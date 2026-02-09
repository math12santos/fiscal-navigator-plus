import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CostCenter } from "@/hooks/useCostCenters";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter: CostCenter | null;
  costCenters: CostCenter[];
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

export default function CostCenterFormDialog({ open, onOpenChange, costCenter, costCenters, onSubmit, isLoading }: Props) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    parent_id: null as string | null,
    business_unit: "",
    responsible: "",
    description: "",
    active: true,
  });

  useEffect(() => {
    if (costCenter) {
      setForm({
        code: costCenter.code,
        name: costCenter.name,
        parent_id: costCenter.parent_id,
        business_unit: costCenter.business_unit ?? "",
        responsible: costCenter.responsible ?? "",
        description: costCenter.description ?? "",
        active: costCenter.active,
      });
    } else {
      setForm({ code: "", name: "", parent_id: null, business_unit: "", responsible: "", description: "", active: true });
    }
  }, [costCenter, open]);

  const parentOptions = costCenters.filter((cc) => cc.active && cc.id !== costCenter?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      parent_id: form.parent_id || null,
      business_unit: form.business_unit || null,
      responsible: form.responsible || null,
      description: form.description || null,
    };
    if (costCenter) {
      onSubmit({ id: costCenter.id, ...payload });
    } else {
      onSubmit(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{costCenter ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="CC-001" />
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Centro Pai</Label>
            <Select value={form.parent_id ?? "__none__"} onValueChange={(v) => setForm({ ...form, parent_id: v === "__none__" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Nenhum (raiz)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum (raiz)</SelectItem>
                {parentOptions.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.code} - {cc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unidade de Negócio</Label>
              <Input value={form.business_unit} onChange={(e) => setForm({ ...form, business_unit: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            <Label className="text-sm">Ativo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{costCenter ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
