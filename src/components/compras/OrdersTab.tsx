import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/SectionCard";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Plus, Trash2, FileText, Send } from "lucide-react";
import {
  usePurchaseOrders, usePurchaseRequests, useSuppliers, STATUS_ORDER,
} from "@/hooks/useCompras";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const NONE = "__none__";
const fmtBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);

const emptyItem = { nome: "", descricao: "", quantidade: 1, unidade: "un", valor_unitario: 0, observacao: "" };

export function OrdersTab() {
  const { orders, isLoading, upsert, setStatus } = usePurchaseOrders();
  const { requests } = usePurchaseRequests();
  const { suppliers } = useSuppliers();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);

  const aprovadas = useMemo(
    () => requests.filter((r: any) => r.status === "aprovada" || r.status === "pedido_gerado"),
    [requests],
  );

  const newFromRequest = (r: any) => {
    setForm({
      request_id: r.id,
      supplier_id: null,
      cost_center_id: r.cost_center_id,
      account_id: r.account_id,
      contract_id: r.contract_id,
      data_emissao: today(),
      data_prevista_entrega: r.data_desejada_entrega || "",
      data_prevista_pagamento: r.data_desejada_entrega || "",
      condicao_pagamento: "",
      forma_pagamento: "",
      observacoes: r.descricao,
      status: "emitido",
      items: (r.items || []).map((it: any) => ({
        nome: it.nome, descricao: it.descricao, quantidade: it.quantidade,
        unidade: it.unidade, valor_unitario: it.valor_unitario, observacao: it.observacao,
      })),
    });
    setOpen(true);
  };

  const newBlank = () => {
    setForm({
      request_id: null, supplier_id: null, cost_center_id: null, account_id: null,
      data_emissao: today(), data_prevista_entrega: "", data_prevista_pagamento: "",
      condicao_pagamento: "", forma_pagamento: "", observacoes: "", status: "emitido",
      items: [{ ...emptyItem }],
    });
    setOpen(true);
  };

  const total = useMemo(
    () => (form?.items || []).reduce((s: number, it: any) => s + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0), 0),
    [form],
  );

  const setF = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const setItem = (i: number, k: string, v: any) =>
    setForm((p: any) => {
      const items = [...p.items];
      items[i] = { ...items[i], [k]: v };
      return { ...p, items };
    });

  const save = () => {
    if (!form.supplier_id) { alert("Selecione o fornecedor."); return; }
    upsert.mutate(
      { ...form, valor_total: total },
      {
        onSuccess: () => {
          setOpen(false);
          if (form.request_id) {
            // marca solicitação como pedido_gerado
            import("@/integrations/supabase/client").then(({ supabase }) =>
              supabase.from("purchase_requests" as any).update({ status: "pedido_gerado" }).eq("id", form.request_id),
            );
          }
        },
      },
    );
  };

  const exportPDF = (o: any) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Pedido de Compra ${o.codigo || ""}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Data: ${o.data_emissao || ""}`, 14, 26);
    doc.text(`Fornecedor: ${o.supplier?.razao_social || "—"}`, 14, 32);
    doc.text(`Status: ${STATUS_ORDER[o.status]?.label || o.status}`, 14, 38);
    doc.text(`Condição: ${o.condicao_pagamento || "—"}`, 14, 44);
    autoTable(doc, {
      startY: 50,
      head: [["Item", "Qtd", "Un", "Valor unit.", "Total"]],
      body: (o.items || []).map((it: any) => [
        it.nome, it.quantidade, it.unidade, fmtBRL(it.valor_unitario), fmtBRL(it.valor_total),
      ]),
    });
    const finalY = (doc as any).lastAutoTable?.finalY || 60;
    doc.text(`Total: ${fmtBRL(o.valor_total)}`, 14, finalY + 10);
    doc.save(`${o.codigo || "pedido"}.pdf`);
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Pedidos de Compra"
        description="Pedidos emitidos a partir de solicitações aprovadas. Ao enviar ao Financeiro, gera lançamento previsto em Contas a Pagar."
        actions={<Button size="sm" onClick={newBlank}><Plus className="mr-1 h-4 w-4" /> Novo pedido</Button>}
      >
        {aprovadas.length > 0 && (
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Solicitações aprovadas aguardando pedido:</div>
            <div className="flex flex-wrap gap-2">
              {aprovadas.map((r: any) => (
                <Button key={r.id} size="sm" variant="outline" onClick={() => newFromRequest(r)}>
                  {r.codigo} — {fmtBRL(Number(r.valor_estimado) || 0)}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-44">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum pedido emitido.</TableCell></TableRow>
              ) : (
                orders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.codigo}</TableCell>
                    <TableCell>{o.supplier?.razao_social || "—"}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(o.valor_total) || 0)}</TableCell>
                    <TableCell className="text-xs">{o.data_prevista_pagamento || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_ORDER[o.status]?.variant || "outline"}>
                        {STATUS_ORDER[o.status]?.label || o.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="PDF" onClick={() => exportPDF(o)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        {o.status !== "enviado_ap" && (
                          <Button size="icon" variant="ghost" title="Enviar ao Financeiro"
                            onClick={() => setStatus.mutate({ id: o.id, status: "enviado_ap" })}>
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo pedido de compra</DialogTitle></DialogHeader>
          {form && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label>Fornecedor *</Label>
                  <Select value={form.supplier_id || NONE} onValueChange={(v) => setF("supplier_id", v === NONE ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {suppliers.filter((s: any) => s.status === "ativo").map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data emissão</Label>
                  <Input type="date" value={form.data_emissao} onChange={(e) => setF("data_emissao", e.target.value)} />
                </div>
                <div>
                  <Label>Prev. entrega</Label>
                  <Input type="date" value={form.data_prevista_entrega || ""} onChange={(e) => setF("data_prevista_entrega", e.target.value)} />
                </div>
                <div>
                  <Label>Prev. pagamento</Label>
                  <Input type="date" value={form.data_prevista_pagamento || ""} onChange={(e) => setF("data_prevista_pagamento", e.target.value)} />
                </div>
                <div>
                  <Label>Condição pagamento</Label>
                  <Input value={form.condicao_pagamento} onChange={(e) => setF("condicao_pagamento", e.target.value)} placeholder="30/60/90" />
                </div>
                <div className="md:col-span-3">
                  <Label>Forma de pagamento</Label>
                  <Input value={form.forma_pagamento} onChange={(e) => setF("forma_pagamento", e.target.value)} placeholder="Boleto, PIX, Transferência..." />
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">Itens</div>
                  <Button size="sm" variant="outline" onClick={() => setF("items", [...(form.items || []), { ...emptyItem }])}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>
                {(form.items || []).map((it: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5"><Label className="text-xs">Nome</Label><Input value={it.nome} onChange={(e) => setItem(i, "nome", e.target.value)} /></div>
                    <div className="col-span-2"><Label className="text-xs">Qtd</Label><Input type="number" value={it.quantidade} onChange={(e) => setItem(i, "quantidade", Number(e.target.value))} /></div>
                    <div className="col-span-1"><Label className="text-xs">Un</Label><Input value={it.unidade} onChange={(e) => setItem(i, "unidade", e.target.value)} /></div>
                    <div className="col-span-3"><Label className="text-xs">Valor unit.</Label><CurrencyInput value={it.valor_unitario} onValueChange={(v) => setItem(i, "valor_unitario", v)} /></div>
                    <div className="col-span-1 text-right">
                      <Button size="icon" variant="ghost" onClick={() => setF("items", form.items.filter((_: any, idx: number) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                <div className="text-right text-sm font-medium">Total: {fmtBRL(total)}</div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={form.observacoes} onChange={(e) => setF("observacoes", e.target.value)} />
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>Emitir pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
