import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Package } from "lucide-react";
import { useBillingPlans, useSavePlan, useDeletePlan, type BillingPlan } from "@/hooks/useBilling";
import { useToast } from "@/hooks/use-toast";

const ALL_MODULES = [
  "dashboard","financeiro","fluxo-caixa","contratos","planejamento","dp",
  "conciliacao","tarefas","integracoes","ia-financeira","configuracoes",
  "documentos","crm","ti","juridico",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export function PlansTab() {
  const { data: plans = [], isLoading } = useBillingPlans();
  const save = useSavePlan();
  const del = useDeletePlan();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<BillingPlan> | null>(null);
  const [delTarget, setDelTarget] = useState<BillingPlan | null>(null);

  const newPlan = (): Partial<BillingPlan> => ({
    code: "", name: "", description: "", price_monthly: 0, price_yearly: 0,
    currency: "BRL", trial_days: 14, is_public: true, is_active: true, sort_order: 0,
    limits: { max_users: 5, max_employees: 20, max_contracts: 50, ai_credits_month: 100, max_orgs_holding: 1, storage_mb: 1024 },
    modules: ["dashboard","fluxo-caixa","contratos","dp"],
  });

  const handleSave = () => {
    if (!editing?.code || !editing?.name) {
      toast({ title: "Código e nome são obrigatórios", variant: "destructive" });
      return;
    }
    save.mutate(editing as any, {
      onSuccess: () => { toast({ title: "Plano salvo" }); setEditing(null); },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });
  };

  const toggleModule = (mod: string) => {
    if (!editing) return;
    const list = editing.modules ?? [];
    setEditing({ ...editing, modules: list.includes(mod) ? list.filter((m) => m !== mod) : [...list, mod] });
  };

  const updateLimit = (key: string, value: number) => {
    if (!editing) return;
    setEditing({ ...editing, limits: { ...(editing.limits ?? {}), [key]: value } });
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando planos...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{plans.length} plano{plans.length !== 1 ? "s" : ""} cadastrado{plans.length !== 1 ? "s" : ""}</p>
        <Button onClick={() => setEditing(newPlan())}><Plus size={14} className="mr-1" /> Novo Plano</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className={!p.is_active ? "opacity-60" : ""}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{p.code}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={p.is_active ? "default" : "outline"}>{p.is_active ? "Ativo" : "Inativo"}</Badge>
                  {p.is_public && <Badge variant="outline" className="text-[10px]">Público</Badge>}
                </div>
              </div>
              <div className="space-y-1 pt-2">
                <p className="text-2xl font-bold text-foreground">{fmt(p.price_monthly)}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
                <p className="text-xs text-muted-foreground">{fmt(p.price_yearly)}/ano · {p.trial_days}d trial</p>
              </div>
              {p.description && <p className="text-xs text-muted-foreground border-t border-border pt-2">{p.description}</p>}
              <div className="flex flex-wrap gap-1 pt-2">
                {(p.modules ?? []).slice(0, 6).map((m) => (
                  <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                ))}
                {(p.modules ?? []).length > 6 && <Badge variant="outline" className="text-[10px]">+{(p.modules ?? []).length - 6}</Badge>}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Edit2 size={12} className="mr-1" /> Editar</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDelTarget(p)}><Trash2 size={12} /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Código *</Label><Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="starter" /></div>
                <div><Label>Nome *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Starter" /></div>
              </div>
              <div><Label>Descrição</Label><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Preço mensal (R$)</Label><Input type="number" step="0.01" value={editing.price_monthly ?? 0} onChange={(e) => setEditing({ ...editing, price_monthly: Number(e.target.value) })} /></div>
                <div><Label>Preço anual (R$)</Label><Input type="number" step="0.01" value={editing.price_yearly ?? 0} onChange={(e) => setEditing({ ...editing, price_yearly: Number(e.target.value) })} /></div>
                <div><Label>Trial (dias)</Label><Input type="number" value={editing.trial_days ?? 14} onChange={(e) => setEditing({ ...editing, trial_days: Number(e.target.value) })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Limites <span className="text-xs text-muted-foreground">(-1 = ilimitado)</span></Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["max_users","Usuários"],
                    ["max_employees","Funcionários"],
                    ["max_contracts","Contratos"],
                    ["ai_credits_month","Créditos IA/mês"],
                    ["max_orgs_holding","Empresas (Holding)"],
                    ["storage_mb","Storage (MB)"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <Label className="text-xs">{label}</Label>
                      <Input type="number" value={editing.limits?.[key] ?? 0} onChange={(e) => updateLimit(key, Number(e.target.value))} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Módulos inclusos</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_MODULES.map((m) => {
                    const on = (editing.modules ?? []).includes(m);
                    return (
                      <Badge key={m} variant={on ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleModule(m)}>
                        {m}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-6 pt-2">
                <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Ativo</Label></div>
                <div className="flex items-center gap-2"><Switch checked={editing.is_public ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_public: v })} /><Label>Público</Label></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir plano "{delTarget?.name}"?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita. Não será possível excluir se houver assinaturas usando este plano.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => delTarget && del.mutate(delTarget.id, {
              onSuccess: () => { toast({ title: "Plano excluído" }); setDelTarget(null); },
              onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
            })}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
