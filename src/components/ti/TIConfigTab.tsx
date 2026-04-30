import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useITConfig } from "@/hooks/useITConfig";

export function TIConfigTab() {
  const { config, save } = useITConfig();
  const [v, setV] = useState<any>({ sla_baixa_hours: 72, sla_media_hours: 24, sla_alta_hours: 8, sla_critica_hours: 2, default_useful_life_notebook: 60, default_useful_life_desktop: 60, default_useful_life_monitor: 60, default_useful_life_celular: 36, default_useful_life_servidor: 84, default_useful_life_outro: 60 });

  useEffect(() => { if (config.data) setV(config.data); }, [config.data]);
  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader><CardTitle className="text-base">SLA por prioridade (horas)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label>Baixa</Label><Input type="number" value={v.sla_baixa_hours ?? 72} onChange={(e) => set("sla_baixa_hours", parseInt(e.target.value) || 0)} /></div>
          <div><Label>Média</Label><Input type="number" value={v.sla_media_hours ?? 24} onChange={(e) => set("sla_media_hours", parseInt(e.target.value) || 0)} /></div>
          <div><Label>Alta</Label><Input type="number" value={v.sla_alta_hours ?? 8} onChange={(e) => set("sla_alta_hours", parseInt(e.target.value) || 0)} /></div>
          <div><Label>Crítica</Label><Input type="number" value={v.sla_critica_hours ?? 2} onChange={(e) => set("sla_critica_hours", parseInt(e.target.value) || 0)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Vida útil padrão (meses)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label>Notebook</Label><Input type="number" value={v.default_useful_life_notebook ?? 60} onChange={(e) => set("default_useful_life_notebook", parseInt(e.target.value) || 0)} /></div>
          <div><Label>Desktop</Label><Input type="number" value={v.default_useful_life_desktop ?? 60} onChange={(e) => set("default_useful_life_desktop", parseInt(e.target.value) || 0)} /></div>
          <div><Label>Monitor</Label><Input type="number" value={v.default_useful_life_monitor ?? 60} onChange={(e) => set("default_useful_life_monitor", parseInt(e.target.value) || 0)} /></div>
          <div><Label>Celular</Label><Input type="number" value={v.default_useful_life_celular ?? 36} onChange={(e) => set("default_useful_life_celular", parseInt(e.target.value) || 0)} /></div>
          <div><Label>Servidor</Label><Input type="number" value={v.default_useful_life_servidor ?? 84} onChange={(e) => set("default_useful_life_servidor", parseInt(e.target.value) || 0)} /></div>
          <div><Label>Outro</Label><Input type="number" value={v.default_useful_life_outro ?? 60} onChange={(e) => set("default_useful_life_outro", parseInt(e.target.value) || 0)} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate(v)}>Salvar configurações</Button>
      </div>
    </div>
  );
}
