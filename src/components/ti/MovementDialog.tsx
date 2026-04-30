import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useITMovements } from "@/hooks/useITMovements";
import { useEmployees } from "@/hooks/useDP";

const TYPES = [
  { v: "entrega", l: "Entrega ao colaborador", to_status: "em_uso" },
  { v: "devolucao", l: "Devolução", to_status: "disponivel" },
  { v: "transferencia", l: "Transferência", to_status: "em_uso" },
  { v: "manutencao_envio", l: "Envio para manutenção", to_status: "em_manutencao" },
  { v: "manutencao_retorno", l: "Retorno de manutenção", to_status: "disponivel" },
  { v: "baixa", l: "Baixa do ativo", to_status: "baixado" },
  { v: "venda", l: "Venda", to_status: "vendido" },
  { v: "extravio", l: "Extravio / Perda", to_status: "extraviado" },
  { v: "reativacao", l: "Reativação", to_status: "ativo" },
  { v: "outro", l: "Outro", to_status: null as any },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipment: any;
}

export function MovementDialog({ open, onOpenChange, equipment }: Props) {
  const { create } = useITMovements();
  const { data: employees = [] } = useEmployees();
  const [v, setV] = useState<any>({});

  useEffect(() => {
    if (open && equipment) {
      setV({
        equipment_id: equipment.id,
        movement_type: "entrega",
        movement_date: new Date().toISOString().slice(0, 10),
        to_status: "em_uso",
      });
    }
  }, [open, equipment]);

  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  const handleType = (t: string) => {
    const tdef = TYPES.find((x) => x.v === t);
    set("movement_type", t);
    if (tdef?.to_status) set("to_status", tdef.to_status);
  };

  if (!equipment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova movimentação</DialogTitle>
          <p className="text-xs text-muted-foreground">{equipment.patrimonial_code} — {equipment.name}</p>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo *</Label>
            <Select value={v.movement_type} onValueChange={handleType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="date" value={v.movement_date ?? ""} onChange={(e) => set("movement_date", e.target.value)} />
          </div>
          <div>
            <Label>Para colaborador</Label>
            <Select value={v.to_employee_id ?? "__none__"} onValueChange={(val) => set("to_employee_id", val === "__none__" ? null : val)}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhum —</SelectItem>
                {employees.map((emp: any) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Para local</Label>
            <Input value={v.to_location ?? ""} onChange={(e) => set("to_location", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Motivo</Label>
            <Input value={v.reason ?? ""} onChange={(e) => set("reason", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { create.mutate(v, { onSuccess: () => onOpenChange(false) }); }}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
