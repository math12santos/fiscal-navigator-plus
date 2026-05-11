import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, CheckCircle2 } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyInput } from "@/components/ui/currency-input";
import { usePurchaseQuotations, usePurchaseRequests, STATUS_QUOTATION } from "@/hooks/useCompras";
import { useSuppliers } from "@/hooks/useCompras";

const fmtBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function QuotationsTab() {
  const { quotations, isLoading, upsert, choose, remove } = usePurchaseQuotations();
  const { requests } = usePurchaseRequests();
  const { suppliers } = useSuppliers();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return quotations;
    return quotations.filter((x: any) =>
      [x.codigo, x.supplier?.razao_social, x.request?.codigo].some((v) => (v || "").toLowerCase().includes(t)),
    );
  }, [quotations, q]);

  const reset = () => setForm({ status: "em_analise", valor_total: 0, frete: 0, desconto: 0 });

  return (
    <SectionCard
      title="Cotações"
      description="Compare propostas de fornecedores para uma solicitação aprovada e escolha a vencedora."
      actions={
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Nova cotação
        </Button>
      }
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por código, fornecedor..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Solicitação</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Prazo (d)</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhuma cotação registrada.</TableCell></TableRow>
            ) : (
              filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                  <TableCell className="font-mono text-xs">{c.request?.codigo || "—"}</TableCell>
                  <TableCell>{c.supplier?.razao_social || "—"}</TableCell>
                  <TableCell className="text-right">{fmtBRL(Number(c.valor_total) || 0)}</TableCell>
                  <TableCell className="text-xs">{c.prazo_entrega_dias ?? "—"}</TableCell>
                  <TableCell className="text-xs">{c.validade_proposta ? new Date(c.validade_proposta).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_QUOTATION[c.status]?.variant || "outline"}>
                      {STATUS_QUOTATION[c.status]?.label || c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {c.status !== "escolhida" && c.status !== "descartada" && (
                        <Button size="icon" variant="ghost" title="Escolher" onClick={() => choose.mutate(c.id)}>
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => { if (confirm("Excluir cotação?")) remove.mutate(c.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nova cotação</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Solicitação *</Label>
              <Select value={form.request_id || ""} onValueChange={(v) => setForm({ ...form, request_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {requests
                    .filter((r: any) => ["aprovada", "em_cotacao"].includes(r.status))
                    .map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.codigo} — {r.descricao || r.titulo || ""}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Fornecedor *</Label>
              <Select value={form.supplier_id || ""} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor total *</Label>
              <CurrencyInput value={form.valor_total ?? 0} onValueChange={(n) => setForm({ ...form, valor_total: n })} />
            </div>
            <div>
              <Label>Prazo (dias)</Label>
              <Input type="number" value={form.prazo_entrega_dias || ""} onChange={(e) => setForm({ ...form, prazo_entrega_dias: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <Label>Validade da proposta</Label>
              <Input type="date" value={form.validade_proposta || ""} onChange={(e) => setForm({ ...form, validade_proposta: e.target.value || null })} />
            </div>
            <div>
              <Label>Condição de pagamento</Label>
              <Input value={form.condicao_pagamento || ""} onChange={(e) => setForm({ ...form, condicao_pagamento: e.target.value })} placeholder="Ex.: 30/60/90" />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacao || ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!form.request_id || !form.supplier_id || !form.valor_total) return;
                await upsert.mutateAsync({ ...form, status: form.status || "recebida" });
                setOpen(false);
              }}
            >Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
