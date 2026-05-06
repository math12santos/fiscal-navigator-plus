import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployees } from "@/hooks/useDP";
import { useITKits } from "@/hooks/useITKits";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kit?: any;
}

export function AssignKitDialog({ open, onOpenChange, kit }: Props) {
  const { data: employees = [] } = useEmployees();
  const { assign } = useITKits();
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => { if (open) { setEmployeeId(""); setNotes(""); } }, [open]);

  const onSubmit = async () => {
    if (!kit?.id || !employeeId) return;
    await assign.mutateAsync({ kit_id: kit.id, employee_id: employeeId, notes });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir kit: {kit?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Colaborador *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {(employees ?? []).map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            O sistema alocará automaticamente equipamentos disponíveis do tipo correto. Itens não disponíveis ficarão pendentes.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={!employeeId || assign.isPending}>Atribuir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
