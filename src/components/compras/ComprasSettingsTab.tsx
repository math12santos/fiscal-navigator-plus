import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/SectionCard";
import { usePurchaseSettings } from "@/hooks/useCompras";

const DEFAULTS = {
  alerta_aprovacao_pendente_dias: 2,
  alerta_divergencia_aberta_dias: 3,
  alerta_recorrencia_antecedencia_dias: 7,
  auto_criar_ativo_imobilizado: false,
  vida_util_contabil_meses: 60,
  vida_util_economica_meses: 48,
  auto_criar_contrato_recorrente: false,
  recorrencia_horizonte_meses: 3,
};

export function ComprasSettingsTab() {
  const { settings, isLoading, save } = usePurchaseSettings();
  const [form, setForm] = useState<any>(DEFAULTS);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <SectionCard title="Alertas e janelas" description="Quando o sistema deve notificar pendências.">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Aprovação pendente (dias)</Label>
            <Input type="number" min={1} value={form.alerta_aprovacao_pendente_dias ?? 2}
              onChange={(e) => setForm({ ...form, alerta_aprovacao_pendente_dias: Number(e.target.value) || 1 })} />
          </div>
          <div>
            <Label>Divergência aberta (dias)</Label>
            <Input type="number" min={1} value={form.alerta_divergencia_aberta_dias ?? 3}
              onChange={(e) => setForm({ ...form, alerta_divergencia_aberta_dias: Number(e.target.value) || 1 })} />
          </div>
          <div>
            <Label>Recorrência antecedência (dias)</Label>
            <Input type="number" min={1} value={form.alerta_recorrencia_antecedencia_dias ?? 7}
              onChange={(e) => setForm({ ...form, alerta_recorrencia_antecedencia_dias: Number(e.target.value) || 1 })} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Ativo imobilizado" description="Pedidos do tipo 'ativo' podem virar equipamento patrimonial automaticamente.">
        <div className="flex items-center gap-2">
          <Switch checked={!!form.auto_criar_ativo_imobilizado}
            onCheckedChange={(v) => setForm({ ...form, auto_criar_ativo_imobilizado: v })} />
          <Label>Criar ativo automaticamente ao confirmar pedido</Label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vida útil contábil (meses)</Label>
            <Input type="number" value={form.vida_util_contabil_meses ?? 60}
              onChange={(e) => setForm({ ...form, vida_util_contabil_meses: Number(e.target.value) || 60 })} />
          </div>
          <div>
            <Label>Vida útil econômica (meses)</Label>
            <Input type="number" value={form.vida_util_economica_meses ?? 48}
              onChange={(e) => setForm({ ...form, vida_util_economica_meses: Number(e.target.value) || 48 })} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Contratos" description="Pedidos recorrentes / SaaS podem virar contratos automaticamente.">
        <div className="flex items-center gap-2">
          <Switch checked={!!form.auto_criar_contrato_recorrente}
            onCheckedChange={(v) => setForm({ ...form, auto_criar_contrato_recorrente: v })} />
          <Label>Criar contrato automaticamente ao confirmar pedido recorrente / SaaS</Label>
        </div>
      </SectionCard>

      <SectionCard title="Recorrências" description="Janela de geração antecipada de solicitações.">
        <div>
          <Label>Horizonte (meses)</Label>
          <Input type="number" min={1} max={12} value={form.recorrencia_horizonte_meses ?? 3}
            onChange={(e) => setForm({ ...form, recorrencia_horizonte_meses: Number(e.target.value) || 3 })} />
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate(form)} disabled={save.isPending}>Salvar configurações</Button>
      </div>
    </div>
  );
}
