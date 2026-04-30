import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useJuridicoProcesses } from "@/hooks/useJuridico";
import { Scale, AlertTriangle, FileText, DollarSign } from "lucide-react";
import { useMemo } from "react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

export function JuridicoDashboard() {
  const { list } = useJuridicoProcesses();
  const processes = list.data ?? [];

  const kpis = useMemo(() => {
    const ativos = processes.filter((p) => p.status === "ativo").length;
    const provavel = processes.filter((p) => p.probabilidade === "provavel").length;
    const totalProvisao = processes.reduce((s, p) => s + Number(p.valor_provisionado || 0), 0);
    const totalCausa = processes.reduce((s, p) => s + Number(p.valor_causa || 0), 0);
    return { total: processes.length, ativos, provavel, totalProvisao, totalCausa };
  }, [processes]);

  const proximasAudiencias = useMemo(
    () =>
      processes
        .filter((p) => p.data_proxima_audiencia && new Date(p.data_proxima_audiencia) >= new Date())
        .sort(
          (a, b) =>
            new Date(a.data_proxima_audiencia).getTime() -
            new Date(b.data_proxima_audiencia).getTime(),
        )
        .slice(0, 5),
    [processes],
  );

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Processos Ativos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.ativos}</div>
            <p className="text-xs text-muted-foreground">de {kpis.total} totais</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Risco Provável</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{kpis.provavel}</div>
            <p className="text-xs text-muted-foreground">processos com perda provável</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Provisão Total</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(kpis.totalProvisao)}</div>
            <p className="text-xs text-muted-foreground">valor provisionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Valor de Causa</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(kpis.totalCausa)}</div>
            <p className="text-xs text-muted-foreground">soma dos valores</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximas Audiências</CardTitle>
        </CardHeader>
        <CardContent>
          {proximasAudiencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma audiência agendada.</p>
          ) : (
            <div className="space-y-2">
              {proximasAudiencias.map((p) => (
                <div key={p.id} className="flex justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{p.numero_cnj || p.numero_interno || "Sem nº"}</p>
                    <p className="text-xs text-muted-foreground">{p.parte_contraria}</p>
                  </div>
                  <p className="text-sm">
                    {new Date(p.data_proxima_audiencia).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
