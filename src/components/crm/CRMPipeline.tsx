import { useState, useMemo } from "react";
import { CRMOpportunity, PipelineStage, CRMClient } from "@/hooks/useCRM";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, ArrowRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  stages: PipelineStage[];
  opportunities: CRMOpportunity[];
  clients: CRMClient[];
  onMove: (oppId: string, stageId: string, extras?: { won_at?: string | null; lost_at?: string | null; lost_reason?: string | null }) => void;
  onAddOpportunity: () => void;
  onEditOpportunity: (opp: CRMOpportunity) => void;
  onWonOpportunity?: (opp: CRMOpportunity) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export function CRMPipeline({ stages, opportunities, clients, onMove, onAddOpportunity, onEditOpportunity, onWonOpportunity }: Props) {
  const [lostDialog, setLostDialog] = useState<{ oppId: string; stageId: string } | null>(null);
  const [lostReason, setLostReason] = useState("");

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.order_index - b.order_index),
    [stages]
  );

  const oppsByStage = useMemo(() => {
    const map: Record<string, CRMOpportunity[]> = {};
    for (const s of stages) map[s.id] = [];
    for (const o of opportunities) {
      if (map[o.stage_id]) map[o.stage_id].push(o);
    }
    return map;
  }, [stages, opportunities]);

  const handleMoveClick = (opp: CRMOpportunity, stage: PipelineStage) => {
    if (stage.is_lost) {
      setLostDialog({ oppId: opp.id, stageId: stage.id });
      setLostReason("");
      return;
    }
    const extras: any = {};
    if (stage.is_won) {
      extras.won_at = new Date().toISOString();
      onMove(opp.id, stage.id, extras);
      // Trigger contract creation flow
      if (onWonOpportunity) onWonOpportunity(opp);
      return;
    }
    onMove(opp.id, stage.id, extras);
  };

  const confirmLost = () => {
    if (!lostDialog) return;
    onMove(lostDialog.oppId, lostDialog.stageId, { lost_at: new Date().toISOString(), lost_reason: lostReason || null });
    setLostDialog(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-foreground">Pipeline de Vendas</h3>
        <Button onClick={onAddOpportunity} size="sm">
          <Plus size={16} className="mr-1" /> Nova Oportunidade
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {sortedStages.map((stage) => {
          const opps = oppsByStage[stage.id] ?? [];
          const totalValue = opps.reduce((s, o) => s + Number(o.estimated_value), 0);

          return (
            <div key={stage.id} className="flex-shrink-0 w-72 glass-card p-0 overflow-hidden">
              {/* Stage header */}
              <div className="p-3 border-b border-border/50" style={{ borderTopColor: stage.color, borderTopWidth: 3 }}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">{stage.name}</span>
                  <Badge variant="outline" className="text-xs">{stage.probability}%</Badge>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{opps.length} oportunidade(s)</span>
                  <span>{formatCurrency(totalValue)}</span>
                </div>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[120px] max-h-[400px] overflow-y-auto">
                {opps.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6">Nenhuma oportunidade</div>
                )}
                {opps.map((opp) => {
                  const client = clientMap.get(opp.client_id);
                  // Find next and prev stages for quick navigation
                  const currentIdx = sortedStages.findIndex((s) => s.id === opp.stage_id);
                  const nextStage = sortedStages[currentIdx + 1];

                  return (
                    <div
                      key={opp.id}
                      className="bg-card border border-border/50 rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors"
                      onClick={() => onEditOpportunity(opp)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{opp.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{client?.name ?? "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold text-primary">{formatCurrency(Number(opp.estimated_value))}</span>
                        {nextStage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveClick(opp, nextStage);
                            }}
                            title={`Mover para ${nextStage.name}`}
                          >
                            <ArrowRight size={14} />
                          </Button>
                        )}
                      </div>
                      {opp.responsible && (
                        <p className="text-xs text-muted-foreground mt-1">{opp.responsible}</p>
                      )}
                      {opp.estimated_close_date && (
                        <p className="text-xs text-muted-foreground">Prev: {new Date(opp.estimated_close_date).toLocaleDateString("pt-BR")}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lost reason dialog */}
      <Dialog open={!!lostDialog} onOpenChange={() => setLostDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da Perda</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Informe o motivo</Label>
            <Textarea value={lostReason} onChange={(e) => setLostReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmLost}>Confirmar Perda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
