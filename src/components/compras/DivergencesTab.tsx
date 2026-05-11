import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, CheckCircle2 } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  usePurchaseDivergences, usePurchaseReceipts, TIPOS_DIVERGENCIA, STATUS_DIVERGENCIA,
} from "@/hooks/useCompras";

export function DivergencesTab() {
  const { divergences, isLoading, upsert, resolve } = usePurchaseDivergences();
  const { receipts } = usePurchaseReceipts();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ severidade: "media", tipo: "quantidade" });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return divergences;
    return divergences.filter((d: any) =>
      [d.descricao, d.tipo, d.receipt?.codigo, d.order?.codigo].some((v) => (v || "").toLowerCase().includes(t)),
    );
  }, [divergences, q]);

  return (
    <SectionCard
      title="Divergências"
      description="Acompanhe e resolva divergências entre pedido e recebimento (quantidade, preço, qualidade, atraso)."
      actions={
        <Button size="sm" onClick={() => { setForm({ severidade: "media", tipo: "quantidade", status: "aberta" }); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Nova divergência
        </Button>
      }
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recebimento</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Severidade</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem divergências.</TableCell></TableRow>
            ) : (
              filtered.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.receipt?.codigo}</TableCell>
                  <TableCell className="font-mono text-xs">{d.order?.codigo}</TableCell>
                  <TableCell className="text-xs capitalize">{d.tipo}</TableCell>
                  <TableCell className="text-xs capitalize">{d.severidade}</TableCell>
                  <TableCell className="text-sm max-w-md truncate" title={d.descricao}>{d.descricao}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_DIVERGENCIA[d.status]?.variant || "outline"}>
                      {STATUS_DIVERGENCIA[d.status]?.label || d.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {d.status !== "resolvida" && (
                      <Button size="icon" variant="ghost" title="Resolver"
                        onClick={() => {
                          const acao = prompt("Ação corretiva:");
                          if (acao !== null) resolve.mutate({ id: d.id, acao_corretiva: acao });
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova divergência</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Recebimento *</Label>
              <Select
                value={form.receipt_id || ""}
                onValueChange={(v) => {
                  const r = receipts.find((x: any) => x.id === v);
                  setForm({ ...form, receipt_id: v, order_id: r?.order_id });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {receipts.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.codigo} — {r.order?.codigo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DIVERGENCIA.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severidade</Label>
              <Select value={form.severidade} onValueChange={(v) => setForm({ ...form, severidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Descrição *</Label>
              <Textarea value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!form.receipt_id || !form.descricao) return;
                await upsert.mutateAsync({ ...form, status: form.status || "aberta" });
                setOpen(false);
              }}
            >Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
