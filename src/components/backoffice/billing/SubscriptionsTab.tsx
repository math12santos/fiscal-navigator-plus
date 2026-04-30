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
import { Plus, Edit2, Search, DollarSign, Users, Pause, Play } from "lucide-react";
import { useBillingPlans, useSubscriptions, useSaveSubscription, computeMRR, type Subscription } from "@/hooks/useBilling";
import { useBackofficeOrgs } from "@/hooks/useBackoffice";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const STATUS_COLORS: Record<string, string> = {
  trialing: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  past_due: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  canceled: "bg-destructive/10 text-destructive border-destructive/30",
  paused: "bg-slate-500/10 text-slate-600 border-slate-500/30",
};
const STATUS_LABEL: Record<string, string> = {
  trialing: "Trial", active: "Ativa", past_due: "Atrasada", canceled: "Cancelada", paused: "Pausada",
};

export function SubscriptionsTab() {
  const { data: subs = [], isLoading } = useSubscriptions();
  const { data: plans = [] } = useBillingPlans();
  const { data: orgs = [] } = useBackofficeOrgs();
  const save = useSaveSubscription();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<Subscription> | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  const orgMap = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);
  const planMap = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const subByOrg = useMemo(() => new Map(subs.map((s) => [s.organization_id, s])), [subs]);

  const mrr = useMemo(() => computeMRR(subs, plans), [subs, plans]);
  const activeCount = subs.filter((s) => s.status === "active").length;
  const trialingCount = subs.filter((s) => s.status === "trialing").length;
  const pastDueCount = subs.filter((s) => s.status === "past_due").length;

  // Empresas SEM assinatura
  const orgsWithoutSub = orgs.filter((o) => !subByOrg.has(o.id));

  const filtered = useMemo(() => {
    return subs.filter((s) => {
      const org = orgMap.get(s.organization_id);
      const matchSearch = !search || (org?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchStatus = statusFilter === "__all__" || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [subs, orgMap, search, statusFilter]);

  const newSub = (orgId: string): Partial<Subscription> => ({
    organization_id: orgId,
    plan_id: plans[0]?.id,
    status: "trialing",
    billing_cycle: "monthly",
    current_period_start: new Date().toISOString(),
    current_period_end: addDays(new Date(), 30).toISOString(),
    trial_ends_at: addDays(new Date(), plans[0]?.trial_days ?? 14).toISOString(),
    seats: 1,
    discount_pct: 0,
    payment_method: "manual",
  });

  const handleSave = () => {
    if (!editing?.organization_id || !editing?.plan_id) {
      toast({ title: "Empresa e plano são obrigatórios", variant: "destructive" });
      return;
    }
    save.mutate(editing as any, {
      onSuccess: () => { toast({ title: "Assinatura salva" }); setEditing(null); },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });
  };

  const handleQuickAction = (sub: Subscription, action: "pause" | "resume" | "cancel") => {
    const patch: Partial<Subscription> = { id: sub.id };
    if (action === "pause") { patch.status = "paused"; patch.paused_at = new Date().toISOString(); }
    if (action === "resume") { patch.status = "active"; patch.paused_at = null; }
    if (action === "cancel") { patch.status = "canceled"; patch.canceled_at = new Date().toISOString(); }
    save.mutate(patch as any, { onSuccess: () => toast({ title: "Atualizado" }) });
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando assinaturas...</div>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <DollarSign size={20} className="text-primary" />
          <div><p className="text-xl font-bold">{fmt(mrr)}</p><p className="text-xs text-muted-foreground">MRR</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users size={20} className="text-emerald-600" />
          <div><p className="text-xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">Ativas</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users size={20} className="text-blue-600" />
          <div><p className="text-xl font-bold">{trialingCount}</p><p className="text-xs text-muted-foreground">Em trial</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users size={20} className="text-amber-600" />
          <div><p className="text-xl font-bold">{pastDueCount}</p><p className="text-xs text-muted-foreground">Atrasadas</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input className="pl-9" placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {orgsWithoutSub.length > 0 && (
          <Select onValueChange={(orgId) => setEditing(newSub(orgId))}>
            <SelectTrigger className="w-72"><SelectValue placeholder={`+ Criar assinatura (${orgsWithoutSub.length} sem)`} /></SelectTrigger>
            <SelectContent>
              {orgsWithoutSub.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ciclo</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead>Próximo venc.</TableHead>
              <TableHead>Trial</TableHead>
              <TableHead className="w-44">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma assinatura.</TableCell></TableRow>
            ) : filtered.map((s) => {
              const org = orgMap.get(s.organization_id);
              const plan = planMap.get(s.plan_id);
              const monthly = s.custom_price ?? (s.billing_cycle === "yearly" ? (plan?.price_yearly ?? 0) / 12 : plan?.price_monthly ?? 0);
              const effective = monthly * (1 - (s.discount_pct ?? 0) / 100);
              const trialDaysLeft = s.trial_ends_at && s.status === "trialing" ? differenceInDays(new Date(s.trial_ends_at), new Date()) : null;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{org?.name ?? s.organization_id.slice(0, 8)}</TableCell>
                  <TableCell><Badge variant="outline">{plan?.name ?? "—"}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_COLORS[s.status]}>{STATUS_LABEL[s.status]}</Badge></TableCell>
                  <TableCell className="text-xs capitalize">{s.billing_cycle === "yearly" ? "Anual" : "Mensal"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(effective)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(s.current_period_end), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                  <TableCell className="text-xs">{trialDaysLeft !== null ? <Badge variant={trialDaysLeft < 3 ? "destructive" : "outline"}>{trialDaysLeft}d</Badge> : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(s)}><Edit2 size={12} /></Button>
                      {s.status === "active" && <Button variant="ghost" size="icon" className="h-7 w-7" title="Pausar" onClick={() => handleQuickAction(s, "pause")}><Pause size={12} /></Button>}
                      {s.status === "paused" && <Button variant="ghost" size="icon" className="h-7 w-7" title="Retomar" onClick={() => handleQuickAction(s, "resume")}><Play size={12} /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar assinatura" : "Nova assinatura"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div>
                <Label>Empresa</Label>
                <Select value={editing.organization_id ?? ""} onValueChange={(v) => setEditing({ ...editing, organization_id: v })} disabled={!!editing.id}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Plano</Label>
                  <Select value={editing.plan_id ?? ""} onValueChange={(v) => setEditing({ ...editing, plan_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {fmt(p.price_monthly)}/mês</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={editing.status ?? "trialing"} onValueChange={(v) => setEditing({ ...editing, status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Ciclo</Label>
                  <Select value={editing.billing_cycle ?? "monthly"} onValueChange={(v) => setEditing({ ...editing, billing_cycle: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Desconto (%)</Label><Input type="number" step="0.01" value={editing.discount_pct ?? 0} onChange={(e) => setEditing({ ...editing, discount_pct: Number(e.target.value) })} /></div>
                <div><Label>Preço custom (R$)</Label><Input type="number" step="0.01" value={editing.custom_price ?? ""} onChange={(e) => setEditing({ ...editing, custom_price: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Início período</Label><Input type="date" value={editing.current_period_start?.split("T")[0] ?? ""} onChange={(e) => setEditing({ ...editing, current_period_start: new Date(e.target.value).toISOString() })} /></div>
                <div><Label>Fim período</Label><Input type="date" value={editing.current_period_end?.split("T")[0] ?? ""} onChange={(e) => setEditing({ ...editing, current_period_end: new Date(e.target.value).toISOString() })} /></div>
                <div><Label>Trial até</Label><Input type="date" value={editing.trial_ends_at?.split("T")[0] ?? ""} onChange={(e) => setEditing({ ...editing, trial_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Pagamento</Label>
                  <Select value={editing.payment_method ?? "manual"} onValueChange={(v) => setEditing({ ...editing, payment_method: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Seats</Label><Input type="number" value={editing.seats ?? 1} onChange={(e) => setEditing({ ...editing, seats: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Notas internas</Label><Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
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
