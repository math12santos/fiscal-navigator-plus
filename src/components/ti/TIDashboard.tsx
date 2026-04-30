import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useITEquipment } from "@/hooks/useITEquipment";
import { useITSystems } from "@/hooks/useITSystems";
import { useITTelecom } from "@/hooks/useITTelecom";
import { useITTickets } from "@/hooks/useITTickets";
import { useITIncidents } from "@/hooks/useITIncidents";
import { useITDepreciation } from "@/hooks/useITDepreciation";
import {
  Laptop, CheckCircle2, AlertTriangle, Wrench, UserCheck, DollarSign,
  TrendingDown, Cloud, Wifi, Inbox, AlertOctagon, CalendarClock,
} from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

function KpiCard({ icon: Icon, label, value, hint, tone = "default" }: any) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-destructive" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${toneClass}`} />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function TIDashboard() {
  const eq = useITEquipment().list.data ?? [];
  const sys = useITSystems().list.data ?? [];
  const tel = useITTelecom().list.data ?? [];
  const tk = useITTickets().list.data ?? [];
  const inc = useITIncidents().list.data ?? [];
  const depr = useITDepreciation().list.data ?? [];

  const stats = useMemo(() => {
    const total = eq.length;
    const ativos = eq.filter((e: any) => ["ativo", "em_uso"].includes(e.status)).length;
    const inativos = eq.filter((e: any) => ["inativo", "baixado", "vendido", "extraviado"].includes(e.status)).length;
    const manut = eq.filter((e: any) => e.status === "em_manutencao").length;
    const disp = eq.filter((e: any) => e.status === "disponivel").length;
    const vinc = eq.filter((e: any) => !!e.responsible_employee_id).length;
    const valorAquisicao = eq.reduce((a: number, e: any) => a + Number(e.acquisition_value || 0), 0);

    const sysAtivos = sys.filter((s: any) => s.status === "ativo");
    const custoMensalSys = sysAtivos.reduce((a: number, s: any) => a + Number(s.monthly_value || 0), 0);
    const telAtivos = tel.filter((t: any) => t.status === "ativo");
    const custoMensalTel = telAtivos.reduce((a: number, t: any) => a + Number(t.monthly_value || 0), 0);

    const tkAbertos = tk.filter((t: any) => !["resolvido", "cancelado"].includes(t.status)).length;
    const tkVencidos = tk.filter((t: any) => t.due_at && new Date(t.due_at) < new Date() && !["resolvido", "cancelado"].includes(t.status)).length;

    const incidentes = inc.length;
    const valorContabil = depr.reduce((a: number, d: any) => a + Number(d.accounting_value || 0), 0);

    // Renovações próximas em 90 dias
    const today = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 90);
    const renovacoes = [
      ...sys.filter((s: any) => s.renewal_date && new Date(s.renewal_date) <= horizon && new Date(s.renewal_date) >= today).map((s: any) => ({ ...s, _kind: "Sistema" })),
      ...tel.filter((t: any) => t.renewal_date && new Date(t.renewal_date) <= horizon && new Date(t.renewal_date) >= today).map((t: any) => ({ ...t, _kind: "Link" })),
    ].sort((a, b) => +new Date(a.renewal_date) - +new Date(b.renewal_date));

    return { total, ativos, inativos, manut, disp, vinc, valorAquisicao, sysAtivos: sysAtivos.length, custoMensalSys, telAtivos: telAtivos.length, custoMensalTel, tkAbertos, tkVencidos, incidentes, valorContabil, renovacoes };
  }, [eq, sys, tel, tk, inc, depr]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard icon={Laptop} label="Equipamentos" value={stats.total} hint={`${stats.ativos} ativos`} />
        <KpiCard icon={CheckCircle2} label="Disponíveis" value={stats.disp} tone="success" />
        <KpiCard icon={Wrench} label="Em manutenção" value={stats.manut} tone="warning" />
        <KpiCard icon={AlertTriangle} label="Inativos" value={stats.inativos} tone="danger" />
        <KpiCard icon={UserCheck} label="Vinculados" value={stats.vinc} hint="a colaboradores" />
        <KpiCard icon={DollarSign} label="Valor aquisição" value={fmt(stats.valorAquisicao)} />
        <KpiCard icon={TrendingDown} label="Valor contábil" value={fmt(stats.valorContabil)} />
        <KpiCard icon={Cloud} label="Sistemas ativos" value={stats.sysAtivos} hint={`${fmt(stats.custoMensalSys)}/mês`} />
        <KpiCard icon={Wifi} label="Links ativos" value={stats.telAtivos} hint={`${fmt(stats.custoMensalTel)}/mês`} />
        <KpiCard icon={Inbox} label="Chamados abertos" value={stats.tkAbertos} hint={stats.tkVencidos ? `${stats.tkVencidos} vencidos` : "no prazo"} tone={stats.tkVencidos ? "danger" : "default"} />
        <KpiCard icon={AlertOctagon} label="Incidentes" value={stats.incidentes} tone={stats.incidentes ? "warning" : "default"} />
        <KpiCard icon={CalendarClock} label="Renovações 90d" value={stats.renovacoes.length} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Próximas renovações</CardTitle></CardHeader>
        <CardContent>
          {stats.renovacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma renovação nos próximos 90 dias.</p>
          ) : (
            <div className="divide-y">
              {stats.renovacoes.slice(0, 8).map((r: any) => (
                <div key={r.id} className="flex justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground ml-2">[{r._kind}]</span>
                  </div>
                  <div className="text-muted-foreground">{new Date(r.renewal_date).toLocaleDateString("pt-BR")}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
