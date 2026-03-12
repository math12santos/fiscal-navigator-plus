import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, ChevronDown, ChevronUp, Inbox } from "lucide-react";
import { useState } from "react";
import { useRequests, useUpdateRequest } from "@/hooks/useRequests";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const priorityColors: Record<string, string> = {
  urgente: "destructive",
  alta: "destructive",
  media: "secondary",
  baixa: "outline",
};

interface Props {
  onApprove?: (request: any) => void;
}

export function PendingExpenseRequests({ onApprove }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const { data: requests } = useRequests({ type: "expense_request", status: "aberta" });
  const updateRequest = useUpdateRequest();
  const { toast } = useToast();

  const pendingRequests = requests ?? [];

  if (pendingRequests.length === 0) return null;

  const parseDescription = (desc: string | null) => {
    if (!desc) return { text: "", estimated_value: null };
    try {
      return JSON.parse(desc);
    } catch {
      return { text: desc, estimated_value: null };
    }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

  const handleReject = async (id: string) => {
    try {
      await updateRequest.mutateAsync({ id, status: "rejeitada" });
      toast({ title: "Solicitação rejeitada" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Solicitações de Despesa Pendentes
              <Badge variant="secondary">{pendingRequests.length}</Badge>
            </CardTitle>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {pendingRequests.map((req: any) => {
              const parsed = parseDescription(req.description);
              return (
                <div key={req.id} className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{req.title}</span>
                      <Badge variant={priorityColors[req.priority] as any ?? "secondary"}>
                        {req.priority}
                      </Badge>
                    </div>
                    {parsed.text && <p className="text-xs text-muted-foreground truncate mt-0.5">{parsed.text}</p>}
                    {parsed.estimated_value && (
                      <p className="text-xs text-muted-foreground mt-0.5">Valor estimado: {fmt(parsed.estimated_value)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => onApprove?.(req)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleReject(req.id)}
                      disabled={updateRequest.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
