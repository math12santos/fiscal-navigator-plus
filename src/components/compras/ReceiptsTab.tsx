import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePurchaseReceipts, usePurchaseOrders, STATUS_RECEIPT } from "@/hooks/useCompras";

export function ReceiptsTab() {
  const { receipts, isLoading, upsert, remove } = usePurchaseReceipts();
  const { orders } = usePurchaseOrders();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return receipts;
    return receipts.filter((r: any) =>
      [r.codigo, r.numero_nf, r.order?.codigo, r.order?.supplier?.razao_social].some((v) =>
        (v || "").toLowerCase().includes(t),
      ),
    );
  }, [receipts, q]);

  // Quando seleciona pedido, carregar itens base
  useEffect(() => {
    if (!form.order_id) return;
    const ord = orders.find((o: any) => o.id === form.order_id);
    if (ord) {
      setItems(
        (ord.items || []).map((it: any) => ({
          order_item_id: it.id,
          nome: it.nome,
          quantidade_pedida: Number(it.quantidade) || 0,
          quantidade_recebida: Number(it.quantidade) || 0,
          unidade: it.unidade,
          valor_unitario: Number(it.valor_unitario) || 0,
          status_item: "ok",
        })),
      );
    }
  }, [form.order_id, orders]);

  const inferStatus = () => {
    if (!items.length) return "parcial";
    const hasDiv = items.some((it) => it.status_item === "divergente" || it.status_item === "rejeitado");
    if (hasDiv) return "divergente";
    const allFull = items.every((it) => Number(it.quantidade_recebida) >= Number(it.quantidade_pedida));
    return allFull ? "total" : "parcial";
  };

  return (
    <SectionCard
      title="Recebimentos"
      description="Registre o recebimento físico de pedidos: NF, quantidades e divergências por item."
      actions={
        <Button size="sm" onClick={() => { setForm({ data_recebimento: new Date().toISOString().split("T")[0] }); setItems([]); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Novo recebimento
        </Button>
      }
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por código, NF, pedido..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>NF</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum recebimento.</TableCell></TableRow>
            ) : (
              filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                  <TableCell className="font-mono text-xs">{r.order?.codigo}</TableCell>
                  <TableCell className="text-sm">{r.order?.supplier?.razao_social || "—"}</TableCell>
                  <TableCell className="text-xs">{r.numero_nf || "—"}</TableCell>
                  <TableCell className="text-xs">{r.data_recebimento ? new Date(r.data_recebimento).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_RECEIPT[r.status]?.variant || "outline"}>
                      {STATUS_RECEIPT[r.status]?.label || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir recebimento?")) remove.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo recebimento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Pedido *</Label>
              <Select value={form.order_id || ""} onValueChange={(v) => setForm({ ...form, order_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {orders
                    .filter((o: any) => !["cancelado", "concluido"].includes(o.status))
                    .map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.codigo} — {o.supplier?.razao_social || ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data recebimento *</Label>
              <Input type="date" value={form.data_recebimento || ""} onChange={(e) => setForm({ ...form, data_recebimento: e.target.value })} />
            </div>
            <div>
              <Label>NF nº</Label>
              <Input value={form.numero_nf || ""} onChange={(e) => setForm({ ...form, numero_nf: e.target.value })} />
            </div>
            <div>
              <Label>Série NF</Label>
              <Input value={form.serie_nf || ""} onChange={(e) => setForm({ ...form, serie_nf: e.target.value })} />
            </div>
            <div>
              <Label>Data emissão NF</Label>
              <Input type="date" value={form.data_emissao_nf || ""} onChange={(e) => setForm({ ...form, data_emissao_nf: e.target.value || null })} />
            </div>
            <div className="col-span-2">
              <Label>Chave NF-e (44 dígitos)</Label>
              <Input
                value={form.nf_chave || ""}
                onChange={(e) => setForm({ ...form, nf_chave: e.target.value })}
                maxLength={54}
                placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Validação automática (DV módulo 11). Divergência é aberta se a chave for inválida.
              </p>
            </div>
            <div>
              <Label>CNPJ emissor (NF)</Label>
              <Input value={form.nf_cnpj || ""} onChange={(e) => setForm({ ...form, nf_cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>Valor total NF (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.nf_valor ?? ""}
                onChange={(e) => setForm({ ...form, nf_valor: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2">
              <Label>Observação</Label>
              <Textarea value={form.observacao || ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={2} />
            </div>
          </div>

          {items.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Pedido</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{it.nome}</TableCell>
                      <TableCell className="text-right text-xs">{it.quantidade_pedida} {it.unidade}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 w-24 ml-auto"
                          value={it.quantidade_recebida}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setItems(items.map((x, i) => i === idx ? { ...x, quantidade_recebida: v } : x));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={it.status_item} onValueChange={(v) => setItems(items.map((x, i) => i === idx ? { ...x, status_item: v } : x))}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ok">OK</SelectItem>
                            <SelectItem value="parcial">Parcial</SelectItem>
                            <SelectItem value="divergente">Divergente</SelectItem>
                            <SelectItem value="rejeitado">Rejeitado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!form.order_id || !form.data_recebimento) return;
                await upsert.mutateAsync({ ...form, status: inferStatus(), items });
                setOpen(false);
              }}
            >Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
