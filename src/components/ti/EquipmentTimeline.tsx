import { useITMovements } from "@/hooks/useITMovements";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Package } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  entrega: "Entrega",
  devolucao: "Devolução",
  transferencia: "Transferência",
  manutencao_envio: "Envio à manutenção",
  manutencao_retorno: "Retorno de manutenção",
  baixa: "Baixa",
  venda: "Venda",
  extravio: "Extravio",
  reativacao: "Reativação",
  outro: "Outro",
};

export function EquipmentTimeline({ equipmentId }: { equipmentId: string }) {
  const { list } = useITMovements(equipmentId);
  const rows = list.data ?? [];

  if (list.isLoading) return <p className="text-sm text-muted-foreground">Carregando histórico...</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">Sem movimentações registradas.</p>;

  return (
    <div className="space-y-3">
      {rows.map((m: any) => (
        <div key={m.id} className="flex gap-3 text-sm border-l-2 border-primary/40 pl-3 py-1">
          <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{TYPE_LABELS[m.movement_type] ?? m.movement_type}</Badge>
              <span className="text-xs text-muted-foreground">{new Date(m.movement_date).toLocaleDateString("pt-BR")}</span>
            </div>
            {(m.from_status || m.to_status) && (
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span>{m.from_status?.replace(/_/g, " ") ?? "—"}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{m.to_status?.replace(/_/g, " ") ?? "—"}</span>
              </div>
            )}
            {m.to_location && <div className="text-xs">Local: {m.to_location}</div>}
            {m.reason && <div className="text-xs italic mt-1">{m.reason}</div>}
            {m.notes && <div className="text-xs text-muted-foreground mt-1">{m.notes}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
