import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, FileText, CheckCircle2, Trash2, Download } from "lucide-react";
import {
  useInvoices, useSaveInvoice, useMarkInvoicePaid, useDeleteInvoice, useInvoiceItems,
  useSubscriptions, useBillingPlans, generateInvoiceNumber,
  type Invoice, type InvoiceItem,
} from "@/hooks/useBilling";
import { useBackofficeOrgs } from "@/hooks/useBackoffice";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateInvoicePdf } from "@/lib/invoicePdf";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  open: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  overdue: "bg-destructive/10 text-destructive border-destructive/30",
  void: "bg-muted text-muted-foreground border-border",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", open: "Em aberto", paid: "Paga", overdue: "Vencida", void: "Cancelada",
};

interface EditingState {
  invoice: Partial<Invoice>;
  items: Array<Partial<InvoiceItem>>;
}

export function InvoicesTab() {
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: subs = [] } = useSubscriptions();
  const { data: plans = [] } = useBillingPlans();
  const { data: orgs = [] } = useBackofficeOrgs();
  const save = useSaveInvoice();
  const markPaid = useMarkInvoicePaid();
  const del = useDeleteInvoice();
  const { toast } = useToast();
  const { user } = useAuth();
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [viewItemsId, setViewItemsId] = useState<string | null>(null);
  const { data: viewItems = [] } = useInvoiceItems(viewItemsId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");

  const orgMap = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);
  const planMap = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);

  // Auto-update overdue badges (UI-only — não persiste)
  const today = new Date();
  const enriched = invoices.map((inv) => {
    if (inv.status === "open" && new Date(inv.due_at) < today) {
      return { ...inv, status: "overdue" as const };
    }
    return inv;
  });

  const filtered = useMemo(() => enriched.filter((i) => {
    const org = orgMap.get(i.organization_id);
    const matchSearch = !search || i.number.toLowerCase().includes(search.toLowerCase()) || (org?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchStatus = statusFilter === "__all__" || i.status === statusFilter;
    return matchSearch && matchStatus;
  }), [enriched, orgMap, search, statusFilter]);

  const totals = useMemo(() => {
    const open = enriched.filter((i) => i.status === "open").reduce((s, i) => s + Number(i.amount), 0);
    const overdue = enriched.filter((i) => i.status === "overdue").reduce((s, i) => s + Number(i.amount), 0);
    const paid30d = enriched.filter((i) => i.status === "paid" && i.paid_at && new Date(i.paid_at) > addDays(today, -30)).reduce((s, i) => s + Number(i.amount), 0);
    return { open, overdue, paid30d };
  }, [enriched]);

  const newInvoiceFromSub = (orgId?: string): EditingState => {
    const sub = orgId ? subs.find((s) => s.organization_id === orgId) : undefined;
    const plan = sub ? planMap.get(sub.plan_id) : undefined;
    const monthly = sub?.custom_price ?? (sub?.billing_cycle === "yearly" ? (plan?.price_yearly ?? 0) / 12 : plan?.price_monthly ?? 0);
    const amount = monthly * (1 - (sub?.discount_pct ?? 0) / 100);
    return {
      invoice: {
        organization_id: orgId,
        subscription_id: sub?.id ?? null,
        number: generateInvoiceNumber(),
        period_start: format(new Date(), "yyyy-MM-dd"),
        period_end: format(addDays(new Date(), 30), "yyyy-MM-dd"),
        due_at: format(addDays(new Date(), 7), "yyyy-MM-dd"),
        status: "open",
        amount,
        notes: "",
      },
      items: sub && plan ? [{
        description: `Assinatura ${plan.name} (${sub.billing_cycle === "yearly" ? "anual" : "mensal"})`,
        kind: "subscription",
        quantity: 1,
        unit_price: amount,
        amount,
      }] : [],
    };
  };

  const recalcTotal = (st: EditingState): EditingState => {
    const total = st.items.reduce((s, it) => s + Number(it.amount ?? 0), 0);
    return { ...st, invoice: { ...st.invoice, amount: total } };
  };

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    if (!editing) return;
    const items = [...editing.items];
    const merged = { ...items[idx], ...patch };
    if ("quantity" in patch || "unit_price" in patch) {
      merged.amount = Number(merged.quantity ?? 0) * Number(merged.unit_price ?? 0);
    }
    items[idx] = merged;
    setEditing(recalcTotal({ ...editing, items }));
  };

  const handleSave = () => {
    if (!editing?.invoice.organization_id) {
      toast({ title: "Selecione a empresa", variant: "destructive" });
      return;
    }
    save.mutate({ invoice: editing.invoice, items: editing.items }, {
      onSuccess: () => { toast({ title: "Fatura salva" }); setEditing(null); },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });
  };

  const handlePdf = async (inv: Invoice) => {
    const { data } = await import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.from("invoice_items" as any).select("*").eq("invoice_id", inv.id)
    );
    const items = ((data ?? []) as unknown) as InvoiceItem[];
    const org = orgMap.get(inv.organization_id);
    generateInvoicePdf({
      invoice: inv,
      items,
      orgName: org?.name ?? "—",
      orgDocument: org?.document_number ?? null,
      issuerName: user?.email ?? "Backoffice",
    });
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando faturas...</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Em aberto</p><p className="text-xl font-bold text-blue-600">{fmt(totals.open)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Vencidas</p><p className="text-xl font-bold text-destructive">{fmt(totals.overdue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Recebido (30d)</p><p className="text-xl font-bold text-emerald-600">{fmt(totals.paid30d)}</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input className="pl-9" placeholder="Buscar nº ou empresa..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setEditing(newInvoiceFromSub())}><Plus size={14} className="mr-1" /> Nova Fatura</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-44">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma fatura.</TableCell></TableRow>
            ) : filtered.map((inv) => {
              const org = orgMap.get(inv.organization_id);
              return (
                <TableRow key={inv.id} className="cursor-pointer" onClick={() => setViewItemsId(inv.id)}>
                  <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                  <TableCell className="font-medium">{org?.name ?? inv.organization_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(inv.period_start), "dd/MM", { locale: ptBR })}–{format(new Date(inv.period_end), "dd/MM/yy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-xs">{format(new Date(inv.due_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(Number(inv.amount))}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_COLORS[inv.status]}>{STATUS_LABEL[inv.status]}</Badge></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="PDF" onClick={() => handlePdf(inv)}><Download size={12} /></Button>
                      {inv.status !== "paid" && inv.status !== "void" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Marcar como paga"
                          onClick={() => markPaid.mutate(inv.id, { onSuccess: () => toast({ title: "Fatura paga" }) })}>
                          <CheckCircle2 size={12} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir"
                        onClick={() => del.mutate(inv.id, { onSuccess: () => toast({ title: "Excluída" }) })}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Items viewer */}
      <Dialog open={!!viewItemsId} onOpenChange={(o) => !o && setViewItemsId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Itens da fatura</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Unit.</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {viewItems.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Sem itens detalhados.</TableCell></TableRow>
              ) : viewItems.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.description}</TableCell>
                  <TableCell className="text-right text-xs">{it.quantity}</TableCell>
                  <TableCell className="text-right text-xs font-mono">{fmt(Number(it.unit_price))}</TableCell>
                  <TableCell className="text-right text-xs font-mono">{fmt(Number(it.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.invoice.id ? "Editar fatura" : "Nova fatura"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Empresa</Label>
                  <Select value={editing.invoice.organization_id ?? ""} onValueChange={(v) => {
                    const fresh = newInvoiceFromSub(v);
                    setEditing({ invoice: { ...editing.invoice, organization_id: v, subscription_id: fresh.invoice.subscription_id, amount: fresh.invoice.amount }, items: fresh.items.length ? fresh.items : editing.items });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Número</Label><Input value={editing.invoice.number ?? ""} onChange={(e) => setEditing({ ...editing, invoice: { ...editing.invoice, number: e.target.value } })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Início período</Label><Input type="date" value={editing.invoice.period_start ?? ""} onChange={(e) => setEditing({ ...editing, invoice: { ...editing.invoice, period_start: e.target.value } })} /></div>
                <div><Label>Fim período</Label><Input type="date" value={editing.invoice.period_end ?? ""} onChange={(e) => setEditing({ ...editing, invoice: { ...editing.invoice, period_end: e.target.value } })} /></div>
                <div><Label>Vencimento</Label><Input type="date" value={editing.invoice.due_at ?? ""} onChange={(e) => setEditing({ ...editing, invoice: { ...editing.invoice, due_at: e.target.value } })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Status</Label>
                  <Select value={editing.invoice.status ?? "open"} onValueChange={(v) => setEditing({ ...editing, invoice: { ...editing.invoice, status: v as any } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Link de pagamento</Label><Input value={editing.invoice.payment_link ?? ""} onChange={(e) => setEditing({ ...editing, invoice: { ...editing.invoice, payment_link: e.target.value } })} placeholder="https://..." /></div>
              </div>

              {/* Items */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <Label>Itens</Label>
                  <Button variant="outline" size="sm" onClick={() => setEditing(recalcTotal({ ...editing, items: [...editing.items, { description: "", kind: "subscription", quantity: 1, unit_price: 0, amount: 0 }] }))}>
                    <Plus size={12} className="mr-1" /> Linha
                  </Button>
                </div>
                {editing.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6"><Input placeholder="Descrição" value={it.description ?? ""} onChange={(e) => updateItem(idx, { description: e.target.value })} /></div>
                    <div className="col-span-1"><Input type="number" step="0.01" value={it.quantity ?? 1} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} /></div>
                    <div className="col-span-2"><Input type="number" step="0.01" value={it.unit_price ?? 0} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} /></div>
                    <div className="col-span-2"><Input type="number" step="0.01" value={it.amount ?? 0} readOnly className="bg-muted" /></div>
                    <Button variant="ghost" size="icon" className="col-span-1 text-destructive" onClick={() => setEditing(recalcTotal({ ...editing, items: editing.items.filter((_, i) => i !== idx) }))}><Trash2 size={12} /></Button>
                  </div>
                ))}
                {editing.items.length === 0 && <p className="text-xs text-muted-foreground italic">Sem itens — informe o valor total abaixo.</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                <div><Label>Total (R$)</Label><Input type="number" step="0.01" value={editing.invoice.amount ?? 0} onChange={(e) => setEditing({ ...editing, invoice: { ...editing.invoice, amount: Number(e.target.value) } })} /></div>
                <div><Label>Notas</Label><Textarea rows={2} value={editing.invoice.notes ?? ""} onChange={(e) => setEditing({ ...editing, invoice: { ...editing.invoice, notes: e.target.value } })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
