import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, Plus } from "lucide-react";
import { EquipmentTimeline } from "./EquipmentTimeline";
import { useEmployees } from "@/hooks/useDP";
import { useITMovements } from "@/hooks/useITMovements";
import { useOrganization } from "@/contexts/OrganizationContext";
import { generateResponsibilityTermPDF } from "@/lib/itResponsibilityTermPDF";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipment: any;
  onNewMovement: () => void;
}

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function EquipmentDetailDialog({ open, onOpenChange, equipment, onNewMovement }: Props) {
  const { data: employees = [] } = useEmployees();
  const { list } = useITMovements(equipment?.id);
  const { currentOrg } = useOrganization();

  if (!equipment) return null;

  const responsible = employees.find((e: any) => e.id === equipment.responsible_employee_id);
  const lastDelivery = (list.data ?? []).find((m: any) => m.movement_type === "entrega");

  const handlePDF = async () => {
    const empId = lastDelivery?.to_employee_id ?? equipment.responsible_employee_id;
    const emp = employees.find((e: any) => e.id === empId);
    await generateResponsibilityTermPDF({
      equipment,
      employee: emp ? { name: emp.name, cpf: emp.cpf } : null,
      movement: lastDelivery,
      organizationName: currentOrg?.name,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{equipment.patrimonial_code} — {equipment.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Tipo:</span> <span className="capitalize">{equipment.equipment_type?.replace(/_/g, " ")}</span></div>
          <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{equipment.status?.replace(/_/g, " ")}</Badge></div>
          <div><span className="text-muted-foreground">Marca/Modelo:</span> {[equipment.brand, equipment.model].filter(Boolean).join(" ") || "—"}</div>
          <div><span className="text-muted-foreground">Série:</span> {equipment.serial_number ?? "—"}</div>
          <div><span className="text-muted-foreground">Valor aquisição:</span> {fmt(equipment.acquisition_value)}</div>
          <div><span className="text-muted-foreground">Local:</span> {equipment.location ?? "—"}</div>
          <div className="col-span-2"><span className="text-muted-foreground">Responsável atual:</span> {responsible?.name ?? "—"}</div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Histórico de movimentações</h3>
            <Button size="sm" variant="outline" onClick={onNewMovement}>
              <Plus className="h-4 w-4 mr-2" /> Nova movimentação
            </Button>
          </div>
          <EquipmentTimeline equipmentId={equipment.id} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handlePDF}>
            <FileDown className="h-4 w-4 mr-2" /> Termo de responsabilidade (PDF)
          </Button>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
