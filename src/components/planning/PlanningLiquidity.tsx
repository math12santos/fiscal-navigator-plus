import { useState } from "react";
import { usePlanningConfig } from "@/hooks/usePlanningConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Shield, Wallet, AlertTriangle } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export default function PlanningLiquidity() {
  const { config, isLoading, upsert } = usePlanningConfig();

  const [saldoMinimo, setSaldoMinimo] = useState<number>(config?.saldo_minimo ?? 0);
  const [colchao, setColchao] = useState<number>(config?.colchao_liquidez ?? 0);
  const [runwayAlerta, setRunwayAlerta] = useState<number>(config?.runway_alerta_meses ?? 3);
  const [initialized, setInitialized] = useState(false);

  // Sync from config when loaded
  if (config && !initialized) {
    setSaldoMinimo(config.saldo_minimo);
    setColchao(config.colchao_liquidez);
    setRunwayAlerta(config.runway_alerta_meses);
    setInitialized(true);
  }

  const handleSave = () => {
    upsert.mutate({
      saldo_minimo: saldoMinimo,
      colchao_liquidez: colchao,
      runway_alerta_meses: runwayAlerta,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Saldo Mínimo Desejado</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Valor mínimo que a empresa deve manter em caixa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                value={saldoMinimo}
                onChange={(e) => setSaldoMinimo(Number(e.target.value))}
                placeholder="0"
              />
              {saldoMinimo > 0 && (
                <p className="text-xs text-muted-foreground">{fmt(saldoMinimo)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Colchão de Liquidez</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Reserva adicional para imprevistos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                value={colchao}
                onChange={(e) => setColchao(Number(e.target.value))}
                placeholder="0"
              />
              {colchao > 0 && (
                <p className="text-xs text-muted-foreground">{fmt(colchao)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <CardTitle className="text-sm">Alerta de Runway</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Emitir alerta quando runway estiver abaixo de X meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-xs">Meses</Label>
              <Input
                type="number"
                value={runwayAlerta}
                onChange={(e) => setRunwayAlerta(Number(e.target.value))}
                min={1}
                max={24}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
