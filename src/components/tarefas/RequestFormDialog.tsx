import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateRequest, useUpdateRequest, type Request } from "@/hooks/useRequests";
import { useToast } from "@/hooks/use-toast";

const TYPES = [
  { value: "financeiro", label: "Financeiro" },
  { value: "compras", label: "Compras" },
  { value: "contratos", label: "Contratos" },
  { value: "juridico", label: "Jurídico" },
  { value: "rh", label: "RH" },
  { value: "ti", label: "TI" },
  { value: "operacional", label: "Operacional" },
];

const PRIORITIES = [
  { value: "urgente", label: "Urgente" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

const AREAS = [
  "Financeiro", "Administrativo", "Comercial", "Jurídico", "RH", "TI", "Operações",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editRequest?: Request | null;
}

export function RequestFormDialog({ open, onOpenChange, editRequest }: Props) {
  const { toast } = useToast();
  const createRequest = useCreateRequest();
  const updateRequest = useUpdateRequest();

  const [title, setTitle] = useState(editRequest?.title ?? "");
  const [type, setType] = useState(editRequest?.type ?? "operacional");
  const [area, setArea] = useState(editRequest?.area_responsavel ?? "");
  const [description, setDescription] = useState(editRequest?.description ?? "");
  const [priority, setPriority] = useState(editRequest?.priority ?? "media");
  const [dueDate, setDueDate] = useState(editRequest?.due_date ?? "");

  const isEditing = !!editRequest;

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Título é obrigatório", variant: "destructive" });
      return;
    }

    try {
      if (isEditing) {
        await updateRequest.mutateAsync({
          id: editRequest.id,
          title,
          type,
          area_responsavel: area || null,
          description: description || null,
          priority,
          due_date: dueDate || null,
        });
        toast({ title: "Solicitação atualizada" });
      } else {
        await createRequest.mutateAsync({
          title,
          type,
          area_responsavel: area || null,
          description: description || null,
          priority,
          due_date: dueDate || null,
        });
        toast({ title: "Solicitação criada" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Solicitação" : "Nova Solicitação"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Descreva brevemente a solicitação" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Área Responsável</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Limite</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes da solicitação..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createRequest.isPending || updateRequest.isPending}>
            {isEditing ? "Salvar" : "Criar Solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
