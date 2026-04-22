import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import PlanningLiquidity from "@/components/planning/PlanningLiquidity";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PlanningSettingsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações de Planejamento</DialogTitle>
          <DialogDescription>
            Parâmetros de liquidez e alertas. Estes valores alimentam KPIs e alertas em todo o módulo.
          </DialogDescription>
        </DialogHeader>
        <PlanningLiquidity />
      </DialogContent>
    </Dialog>
  );
}
