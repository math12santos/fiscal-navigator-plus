import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Plus, Trash2 } from "lucide-react";
import {
  usePurchaseRequests, useBudgetCheck,
  TIPOS_COMPRA, PRIORIDADES,
} from "@/hooks/useCompras";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: any;
  onSaved?: () => void;
}

const NONE = "__none__";
const today = () => new Date().toISOString().slice(0, 10);
const competencia = (d?: string) => (d || today()).slice(0, 7);

const emptyItem = { nome: "", descricao: "", quantidade: 1, unidade: "un", valor_unitario: 0, categoria: "", observacao: "" };

const emptyForm = () => ({
  data_solicitacao: today(),
  data_desejada_entrega: "",
  tipo_compra: "produto",
  categoria: "",
  prioridade: "media",
  cost_center_id: null as string | null,
  account_id: null as string | null,
  descricao: "",
  justificativa: "",
  valor_estimado: 0,
  fora_orcamento: false,
  justificativa_orcamento: "",
  observacoes: "",
  status: "rascunho",
  items: [{ ...emptyItem }],
});

export function PurchaseRequestFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const { upsert } = usePurchaseRequests();
  const checkBudget = useBudgetCheck();
  const { costCenters } = useCostCenters();
  const { accounts } = useChartOfAccounts();

  const [form, setForm] = useState<any>(emptyForm());
  const [budget, setBudget] = useState<any>(null);
  const [checkingBudget, setCheckingBudget] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...emptyForm(), ...initial, items: initial.items?.length ? initial.items : [{ ...emptyItem }] } : emptyForm());
      setBudget(null);
    }
  }, [open, initial]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const totalItens = useMemo(
    () => (form.items || []).reduce((s: number, it: any) => s + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0), 0),
    [form.items],
  );

  useEffect(() => {
    set("valor_estimado", totalItens);
  }, [totalItens]);

  const setItem = (i: number, k: string, v: any) =>
    setForm((p: any) => {
      const items = [...p.items];
      items[i] = { ...items[i], [k]: v };
      return { ...p, items };
    });

  const addItem = () => setForm((p: any) => ({ ...p, items: [...(p.items || []), { ...emptyItem }] }));
  const removeItem = (i: number) =>
    setForm((p: any) => ({ ...p, items: (p.items || []).filter((_: any, idx: number) => idx !== i) }));

  const handleCheckBudget = async () => {
    setCheckingBudget(true);
    try {
      const result = await checkBudget({
        cost_center_id: form.cost_center_id,
        account_id: form.account_id,
        competencia: competencia(form.data_desejada_entrega || form.data_solicitacao),
        valor: totalItens,
      });
      setBudget(result);
      if (result?.situacao === "acima_orcamento" || result?.situacao === "sem_orcamento") {
        set("fora_orcamento", true);
      } else {
        set("fora_orcamento", false);
      }
    } finally {
      setCheckingBudget(false);
    }
  };

  const submit = (status: string) => {
    if (!form.descricao && !(form.items || []).some((it: any) => it.nome)) return;
    if (form.fora_orcamento && !form.justificativa_orcamento) {
      alert("Justificativa para compra fora do orçamento é obrigatória.");
      return;
    }
    const payload = { ...form, status, organization_id: undefined };
    Object.keys(payload).forEach((k) => {
      if (typeof payload[k] === "string" && payload[k] === "") {
        if (k.endsWith("_id")) payload[k] = null;
      }
    });
    upsert.mutate(payload, {
      onSuccess: () => {
        onOpenChange(false);
        onSaved?.();
      },
    });
  };

  const sitColor = (s?: string) =>
    s === "dentro_orcamento" ? "default"
    : s === "proximo_limite" ? "secondary"
    : s === "acima_orcamento" ? "destructive"
    : "outline";
  const sitLabel = (s?: string) =>
    s === "dentro_orcamento" ? "Dentro do orçamento"
    : s === "proximo_limite" ? "Próximo do limite"
    : s === "acima_orcamento" ? "Acima do orçamento"
    : s === "sem_orcamento" ? "Sem orçamento definido"
    : "—";
  const fmtBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar solicitação" : "Nova solicitação de compra"}</DialogTitle>
        </DialogHeader>

        {/* Identificação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Data solicitação</Label>
            <Input type="date" value={form.data_solicitacao} onChange={(e) => set("data_solicitacao", e.target.value)} />
          </div>
          <div>
            <Label>Data desejada</Label>
            <Input type="date" value={form.data_desejada_entrega || ""} onChange={(e) => set("data_desejada_entrega", e.target.value)} />
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={form.prioridade} onValueChange={(v) => set("prioridade", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de compra</Label>
            <Select value={form.tipo_compra} onValueChange={(v) => set("tipo_compra", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_COMPRA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Input value={form.categoria || ""} onChange={(e) => set("categoria", e.target.value)} />
          </div>
          <div>
            <Label>Departamento / Projeto</Label>
            <Input value={form.departamento || ""} onChange={(e) => set("departamento", e.target.value)} />
          </div>
          <div>
            <Label>Centro de custo</Label>
            <Select value={form.cost_center_id || NONE} onValueChange={(v) => set("cost_center_id", v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {(costCenters || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Plano de contas</Label>
            <Select value={form.account_id || NONE} onValueChange={(v) => set("account_id", v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {(accounts || []).filter((a: any) => a.nature === "saida" || a.nature === "despesa" || !a.nature)
                  .map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code ? `${a.code} — ` : ""}{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descrição da necessidade</Label>
          <Textarea rows={2} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Justificativa</Label>
          <Textarea rows={2} value={form.justificativa} onChange={(e) => set("justificativa", e.target.value)} />
        </div>

        {/* Itens */}
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium text-sm">Itens</div>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Adicionar item</Button>
          </div>
          {(form.items || []).map((it: any, i: number) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <Label className="text-xs">Nome</Label>
                <Input value={it.nome} onChange={(e) => setItem(i, "nome", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Qtd</Label>
                <Input type="number" step="0.001" value={it.quantidade} onChange={(e) => setItem(i, "quantidade", Number(e.target.value))} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs">Un</Label>
                <Input value={it.unidade} onChange={(e) => setItem(i, "unidade", e.target.value)} />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Valor unit.</Label>
                <CurrencyInput value={it.valor_unitario} onValueChange={(v) => setItem(i, "valor_unitario", v)} />
              </div>
              <div className="col-span-1 text-right">
                <Button size="icon" variant="ghost" onClick={() => removeItem(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <div className="text-right text-sm font-medium">Total estimado: {fmtBRL(totalItens)}</div>
        </div>

        {/* Validação orçamentária */}
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-medium text-sm">Validação orçamentária</div>
            <Button size="sm" variant="outline" onClick={handleCheckBudget} disabled={checkingBudget}>
              {checkingBudget ? "Verificando..." : "Verificar orçamento"}
            </Button>
          </div>
          {budget && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <div><div className="text-muted-foreground">Planejado</div><div>{fmtBRL(budget.planejado)}</div></div>
              <div><div className="text-muted-foreground">Realizado</div><div>{fmtBRL(budget.realizado)}</div></div>
              <div><div className="text-muted-foreground">Comprometido</div><div>{fmtBRL(budget.comprometido)}</div></div>
              <div><div className="text-muted-foreground">Saldo após</div><div>{fmtBRL(budget.saldo)}</div></div>
              <div><div className="text-muted-foreground">Situação</div><Badge variant={sitColor(budget.situacao) as any}>{sitLabel(budget.situacao)}</Badge></div>
            </div>
          )}
          {form.fora_orcamento && (
            <div>
              <Label>Justificativa (fora do orçamento)</Label>
              <Textarea
                rows={2}
                value={form.justificativa_orcamento}
                onChange={(e) => set("justificativa_orcamento", e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={() => submit("rascunho")} disabled={upsert.isPending}>Salvar rascunho</Button>
          <Button onClick={() => submit("enviada")} disabled={upsert.isPending}>Enviar para aprovação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
