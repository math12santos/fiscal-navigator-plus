import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Pause } from "lucide-react";
import { useInvoices, useSubscriptions, useSaveSubscription } from "@/hooks/useBilling";
import { useBackofficeOrgs } from "@/hooks/useBackoffice";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export function DelinquencyTab() {
  const { data: invoices = [] } = useInvoices();
  const { data: subs = [] } = useSubscriptions();
  const { data: orgs = [] } = useBackofficeOrgs();
  const saveSub = useSaveSubscription();
  const { toast } = useToast();

  const orgMap = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);
  const subByOrg = useMemo(() => new Map(subs.map((s) => [s.organization_id, s])), [subs]);

  const today = new Date();
  const overdue = useMemo(() => {
    return invoices
      .filter((i) => (i.status === "open" || i.status === "overdue") && new Date(i.due_at) < today)
      .map((i) => ({
        invoice: i,
        org: orgMap.get(i.organization_id),
        sub: subByOrg.get(i.organization_id),
        daysLate: differenceInDays(today, new Date(i.due_at)),
      }))
      .sort((a, b) => b.daysLate - a.daysLate);
  }, [invoices, orgMap, subByOrg]);

  const totalOverdue = overdue.reduce((s, x) => s + Number(x.invoice.amount), 0);
  const orgsAtRisk = new Set(overdue.map((x) => x.invoice.organization_id)).size;

  const handleSuspend = (orgId: string) => {
    const sub = subByOrg.get(orgId);
    if (!sub) { toast({ title: "Empresa sem assinatura", variant: "destructive" }); return; }
    saveSub.mutate({ id: sub.id, status: "past_due" } as any, {
      onSuccess: () => toast({ title: "Assinatura marcada como atrasada" }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-destructive" />
          <div><p className="text-xl font-bold text-destructive">{fmt(totalOverdue)}</p><p className="text-xs text-muted-foreground">Total vencido</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xl font-bold">{orgsAtRisk}</p><p className="text-xs text-muted-foreground">Empresas em atraso</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xl font-bold">{overdue.length}</p><p className="text-xs text-muted-foreground">Faturas em atraso</p>
        </CardContent></Card>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Fatura</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Dias em atraso</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status assinatura</TableHead>
              <TableHead className="w-44">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overdue.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma inadimplência. Tudo em dia! 🎉</TableCell></TableRow>
            ) : overdue.map(({ invoice, org, sub, daysLate }) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{org?.name ?? invoice.organization_id.slice(0, 8)}</TableCell>
                <TableCell className="font-mono text-xs">{invoice.number}</TableCell>
                <TableCell className="text-xs">{format(new Date(invoice.due_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                <TableCell>
                  <Badge variant={daysLate > 30 ? "destructive" : daysLate > 7 ? "secondary" : "outline"}>{daysLate}d</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(Number(invoice.amount))}</TableCell>
                <TableCell>
                  {sub ? <Badge variant="outline" className="capitalize">{sub.status}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {sub && sub.status !== "past_due" && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleSuspend(invoice.organization_id)}>
                      <Pause size={12} className="mr-1" /> Marcar atrasada
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
