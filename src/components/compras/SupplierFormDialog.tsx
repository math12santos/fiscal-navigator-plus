import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSuppliers } from "@/hooks/useCompras";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: any;
}

const empty = {
  razao_social: "",
  nome_fantasia: "",
  documento: "",
  tipo: "pj",
  contato_nome: "",
  email: "",
  telefone: "",
  status: "ativo",
  avaliacao: null as number | null,
  prazo_medio_entrega_dias: null as number | null,
  condicoes_comerciais: "",
  observacoes: "",
};

export function SupplierFormDialog({ open, onOpenChange, initial }: Props) {
  const { upsert } = useSuppliers();
  const [form, setForm] = useState<any>(empty);

  useEffect(() => {
    if (open) setForm(initial ? { ...empty, ...initial } : empty);
  }, [open, initial]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.razao_social) return;
    upsert.mutate(form, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Razão social *</Label>
            <Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} />
          </div>
          <div>
            <Label>Nome fantasia</Label>
            <Input value={form.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                <SelectItem value="pf">Pessoa Física</SelectItem>
                <SelectItem value="mei">MEI</SelectItem>
                <SelectItem value="estrangeiro">Estrangeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>CNPJ / CPF</Label>
            <Input value={form.documento} onChange={(e) => set("documento", e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="em_homologacao">Em homologação</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contato</Label>
            <Input value={form.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
          </div>
          <div>
            <Label>Prazo médio entrega (dias)</Label>
            <Input
              type="number"
              value={form.prazo_medio_entrega_dias ?? ""}
              onChange={(e) => set("prazo_medio_entrega_dias", e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Avaliação (1-5)</Label>
            <Input
              type="number" min={1} max={5}
              value={form.avaliacao ?? ""}
              onChange={(e) => set("avaliacao", e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Condições comerciais</Label>
            <Input value={form.condicoes_comerciais} onChange={(e) => set("condicoes_comerciais", e.target.value)} placeholder="Ex.: 30/60/90 dias" />
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
