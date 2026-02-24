import { CRMClient, CRMActivity } from "@/hooks/useCRM";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRMActivityTimeline } from "./CRMActivityTimeline";
import { useState } from "react";

interface Props {
  client: CRMClient | null;
  activities: CRMActivity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddActivity: (data: Partial<CRMActivity>) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export function CRMClientDetail({ client, activities, open, onOpenChange, onAddActivity }: Props) {
  const [actType, setActType] = useState("nota");
  const [actDesc, setActDesc] = useState("");

  if (!client) return null;

  const handleAddActivity = () => {
    if (!actDesc.trim()) return;
    onAddActivity({ client_id: client.id, type: actType, description: actDesc, status: "concluida", completed_at: new Date().toISOString() });
    setActDesc("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{client.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Status</span>
              <div className="mt-1">
                <Badge variant="outline">{client.status}</Badge>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Segmento</span>
              <p className="font-medium text-foreground">{client.segment ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">MRR</span>
              <p className="font-medium text-foreground">{formatCurrency(Number(client.mrr))}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Responsável</span>
              <p className="font-medium text-foreground">{client.responsible ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Score</span>
              <p className="font-medium text-foreground">{client.score}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Health Score</span>
              <p className="font-medium text-foreground">{client.health_score}</p>
            </div>
          </div>

          {client.notes && (
            <div className="text-sm">
              <span className="text-muted-foreground">Observações</span>
              <p className="text-foreground mt-1">{client.notes}</p>
            </div>
          )}

          <Tabs defaultValue="timeline">
            <TabsList className="w-full">
              <TabsTrigger value="timeline" className="flex-1">Atividades</TabsTrigger>
              <TabsTrigger value="new" className="flex-1">Nova Atividade</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <CRMActivityTimeline activities={activities} />
            </TabsContent>

            <TabsContent value="new" className="mt-4 space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={actType} onValueChange={setActType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ligacao">Ligação</SelectItem>
                    <SelectItem value="reuniao">Reunião</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="nota">Nota</SelectItem>
                    <SelectItem value="tarefa">Tarefa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={actDesc} onChange={(e) => setActDesc(e.target.value)} rows={3} />
              </div>
              <Button onClick={handleAddActivity} className="w-full">Registrar Atividade</Button>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
