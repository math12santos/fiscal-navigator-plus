import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJuridicoConfig } from "@/hooks/useJuridico";

export function JuridicoConfigTab() {
  const { get, upsert } = useJuridicoConfig();
  const [form, setForm] = useState({
    pct_provisao_remota: 0,
    pct_provisao_possivel: 25,
    pct_provisao_provavel: 100,
    alert_days_before_audiencia: 7,
    alert_days_before_prazo: 5,
  });

  useEffect(() => {
    if (get.data) setForm({ ...form, ...get.data });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [get.data]);

  const set = (k: string, v: any) => setForm({ ...form, [k]: Number(v) });

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Provisão por Probabilidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Defina o percentual do valor estimado de perda que será provisionado automaticamente conforme
            o risco classificado em cada processo.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Probabilidade Remota (%)</Label>
              <Input type="number" min={0} max={100} value={form.pct_provisao_remota} onChange={(e) => set("pct_provisao_remota", e.target.value)} />
            </div>
            <div>
              <Label>Probabilidade Possível (%)</Label>
              <Input type="number" min={0} max={100} value={form.pct_provisao_possivel} onChange={(e) => set("pct_provisao_possivel", e.target.value)} />
            </div>
            <div>
              <Label>Probabilidade Provável (%)</Label>
              <Input type="number" min={0} max={100} value={form.pct_provisao_provavel} onChange={(e) => set("pct_provisao_provavel", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Dias antes de audiência</Label>
            <Input type="number" min={0} value={form.alert_days_before_audiencia} onChange={(e) => set("alert_days_before_audiencia", e.target.value)} />
          </div>
          <div>
            <Label>Dias antes de prazo</Label>
            <Input type="number" min={0} value={form.alert_days_before_prazo} onChange={(e) => set("alert_days_before_prazo", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => upsert.mutate(form)} disabled={upsert.isPending}>
          {upsert.isPending ? "Salvando..." : "Salvar Configuração"}
        </Button>
      </div>
    </div>
  );
}
