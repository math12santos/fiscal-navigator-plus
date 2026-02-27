import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useEntities } from "@/hooks/useEntities";
import { useCostCenters } from "@/hooks/useCostCenters";
import { Loader2 } from "lucide-react";
import type { FinanceiroInput } from "@/hooks/useFinanceiro";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "saida" | "entrada";
  onSave: (input: FinanceiroInput) => Promise<void>;
  isPending: boolean;
  initial?: Partial<FinanceiroInput>;
  editMode?: boolean;
}

const categorias = {
  saida: ["fixo", "variavel", "investimento", "pessoal", "impostos", "outros"],
  entrada: ["receita_servico", "receita_produto", "receita_financeira", "outros"],
};

const categoriaLabels: Record<string, string> = {
  fixo: "Custo Fixo",
  variavel: "Custo Variável",
  investimento: "Investimento",
  pessoal: "Pessoal",
  impostos: "Impostos",
  outros: "Outros",
  receita_servico: "Receita de Serviço",
  receita_produto: "Receita de Produto",
  receita_financeira: "Receita Financeira",
};

export function FinanceiroEntryDialog({ open, onOpenChange, tipo, onSave, isPending, initial, editMode }: Props) {
  const { entities } = useEntities();
  const { costCenters } = useCostCenters();

  const [form, setForm] = useState<FinanceiroInput>({
    tipo,
    categoria: initial?.categoria ?? null,
    descricao: initial?.descricao ?? "",
    valor_previsto: initial?.valor_previsto ?? 0,
    valor_realizado: initial?.valor_realizado ?? null,
    data_prevista: initial?.data_prevista ?? "",
    data_realizada: initial?.data_realizada ?? null,
    status: initial?.status ?? "previsto",
    account_id: initial?.account_id ?? null,
    cost_center_id: initial?.cost_center_id ?? null,
    entity_id: initial?.entity_id ?? null,
    notes: initial?.notes ?? null,
    source: "manual",
    contract_id: null,
    contract_installment_id: null,
  });

  const handleSave = async () => {
    await onSave(form);
    onOpenChange(false);
  };

  const title = editMode
    ? (tipo === "entrada" ? "Editar Receita" : "Editar Despesa")
    : (tipo === "entrada" ? "Nova Receita" : "Nova Despesa");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder={tipo === "entrada" ? "Ex: Pagamento cliente X" : "Ex: Aluguel escritório"}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor Previsto (R$)</Label>
              <Input
                type="number"
                value={form.valor_previsto}
                onChange={(e) => setForm({ ...form, valor_previsto: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={form.categoria ?? "outros"}
                onValueChange={(v) => setForm({ ...form, categoria: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias[tipo].map((c) => (
                    <SelectItem key={c} value={c}>{categoriaLabels[c] ?? c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data de Competência</Label>
              <Input
                type="date"
                value={form.data_prevista}
                onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="previsto">Previsto</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  {tipo === "saida" && <SelectItem value="pago">Pago</SelectItem>}
                  {tipo === "entrada" && <SelectItem value="recebido">Recebido</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(form.status === "pago" || form.status === "recebido") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor Realizado (R$)</Label>
                <Input
                  type="number"
                  value={form.valor_realizado ?? form.valor_previsto}
                  onChange={(e) => setForm({ ...form, valor_realizado: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>{tipo === "entrada" ? "Data Recebimento" : "Data Pagamento"}</Label>
                <Input
                  type="date"
                  value={form.data_realizada ?? ""}
                  onChange={(e) => setForm({ ...form, data_realizada: e.target.value || null })}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Entidade</Label>
            <Select
              value={form.entity_id ?? "none"}
              onValueChange={(v) => setForm({ ...form, entity_id: v === "none" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {entities.filter((e) => e.active).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Centro de Custo</Label>
            <Select
              value={form.cost_center_id ?? "none"}
              onValueChange={(v) => setForm({ ...form, cost_center_id: v === "none" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {costCenters.filter((c) => c.active).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.descricao || !form.data_prevista || isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editMode ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
