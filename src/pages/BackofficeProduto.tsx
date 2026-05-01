import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Flag, Megaphone, Plus, Trash2, Pencil, Info, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import {
  useFeatureFlags,
  useUpsertFeatureFlag,
  useDeleteFeatureFlag,
  type FeatureFlag,
} from "@/hooks/useFeatureFlags";
import {
  useAllAnnouncements,
  useUpsertAnnouncement,
  useDeleteAnnouncement,
  type PlatformAnnouncement,
} from "@/hooks/useAnnouncements";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SEVERITY_META: Record<string, { label: string; icon: any; cls: string }> = {
  info: { label: "Info", icon: Info, cls: "text-primary" },
  success: { label: "Sucesso", icon: CheckCircle2, cls: "text-emerald-500" },
  warning: { label: "Atenção", icon: AlertTriangle, cls: "text-amber-500" },
  critical: { label: "Crítico", icon: AlertCircle, cls: "text-destructive" },
};

export default function BackofficeProduto() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Produto</h1>
        <p className="text-sm text-muted-foreground">
          Controle features experimentais e comunique novidades para todos os tenants.
        </p>
      </div>

      <Tabs defaultValue="flags">
        <TabsList>
          <TabsTrigger value="flags"><Flag size={14} className="mr-1" /> Feature Flags</TabsTrigger>
          <TabsTrigger value="announcements"><Megaphone size={14} className="mr-1" /> Anúncios</TabsTrigger>
        </TabsList>
        <TabsContent value="flags" className="mt-4">
          <FeatureFlagsTab />
        </TabsContent>
        <TabsContent value="announcements" className="mt-4">
          <AnnouncementsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// FEATURE FLAGS
// ============================================================

function FeatureFlagsTab() {
  const { data: flags = [], isLoading } = useFeatureFlags();
  const upsert = useUpsertFeatureFlag();
  const remove = useDeleteFeatureFlag();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<FeatureFlag> | null>(null);

  const handleSave = async () => {
    if (!editing?.flag_key) return toast({ title: "Chave obrigatória", variant: "destructive" });
    try {
      await upsert.mutateAsync(editing as any);
      toast({ title: "Flag salva" });
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta feature flag?")) return;
    try {
      await remove.mutateAsync(id);
      toast({ title: "Flag removida" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Feature Flags</CardTitle>
        <Button size="sm" onClick={() => setEditing({ flag_key: "", scope: "global", enabled: false, rollout_pct: 0 })}>
          <Plus size={14} className="mr-1" /> Nova flag
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : flags.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma flag criada. Use flags para liberar funcionalidades de forma controlada (rollout %, por plano ou por org).
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chave</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rollout</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">{f.flag_key}</TableCell>
                  <TableCell><Badge variant="outline">{f.scope}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={f.enabled ? "default" : "secondary"}>
                      {f.enabled ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">{f.rollout_pct}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{f.description}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(f)}>
                        <Pencil size={12} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(f.id)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar flag" : "Nova flag"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Chave (ex: new_dashboard_v2)</Label>
                <Input
                  value={editing.flag_key ?? ""}
                  onChange={(e) => setEditing({ ...editing, flag_key: e.target.value })}
                  className="mt-1 font-mono text-sm"
                  disabled={!!editing.id}
                />
              </div>
              <div>
                <Label className="text-xs">Escopo</Label>
                <Select value={editing.scope} onValueChange={(v) => setEditing({ ...editing, scope: v as any })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (todos)</SelectItem>
                    <SelectItem value="plan">Por plano</SelectItem>
                    <SelectItem value="org">Por organização</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Ativa</Label>
                <Switch
                  checked={editing.enabled ?? false}
                  onCheckedChange={(v) => setEditing({ ...editing, enabled: v })}
                />
              </div>
              <div>
                <Label className="text-xs">Rollout gradual (% dos usuários elegíveis)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editing.rollout_pct ?? 0}
                  onChange={(e) => setEditing({ ...editing, rollout_pct: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// ANNOUNCEMENTS
// ============================================================

function AnnouncementsTab() {
  const { data: list = [], isLoading } = useAllAnnouncements();
  const upsert = useUpsertAnnouncement();
  const remove = useDeleteAnnouncement();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<PlatformAnnouncement> | null>(null);

  const handleSave = async () => {
    if (!editing?.title) return toast({ title: "Título obrigatório", variant: "destructive" });
    try {
      await upsert.mutateAsync(editing as any);
      toast({ title: "Anúncio salvo" });
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este anúncio?")) return;
    try {
      await remove.mutateAsync(id);
      toast({ title: "Anúncio removido" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Anúncios da plataforma</CardTitle>
        <Button
          size="sm"
          onClick={() =>
            setEditing({ title: "", severity: "info", audience: "all", dismissible: true, starts_at: new Date().toISOString() })
          }
        >
          <Plus size={14} className="mr-1" /> Novo anúncio
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum anúncio criado. Anúncios aparecem como banner no topo do app dos clientes elegíveis.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((a) => {
              const meta = SEVERITY_META[a.severity];
              const Icon = meta.icon;
              const isActive =
                new Date(a.starts_at) <= new Date() && (!a.ends_at || new Date(a.ends_at) > new Date());
              return (
                <Card key={a.id} className="border-l-4" style={{ borderLeftColor: `hsl(var(--${a.severity === "info" ? "primary" : a.severity === "critical" ? "destructive" : "border"}))` }}>
                  <CardContent className="p-3 flex items-start justify-between gap-3">
                    <div className="flex gap-2 flex-1 min-w-0">
                      <Icon size={16} className={`${meta.cls} mt-0.5 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm text-foreground truncate">{a.title}</p>
                          <Badge variant="outline" className="text-[10px]">{a.audience}</Badge>
                          <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
                            {isActive ? "Ativo" : "Agendado/Expirado"}
                          </Badge>
                        </div>
                        {a.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{a.body}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(a.starts_at), "dd/MM/yyyy", { locale: ptBR })}
                          {a.ends_at && ` → ${format(new Date(a.ends_at), "dd/MM/yyyy", { locale: ptBR })}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(a)}>
                        <Pencil size={12} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(a.id)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar anúncio" : "Novo anúncio"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Título</Label>
                <Input
                  value={editing.title ?? ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Mensagem</Label>
                <Textarea
                  value={editing.body ?? ""}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Severidade</Label>
                  <Select value={editing.severity} onValueChange={(v) => setEditing({ ...editing, severity: v as any })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SEVERITY_META).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Audiência</Label>
                  <Select value={editing.audience} onValueChange={(v) => setEditing({ ...editing, audience: v as any })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os clientes</SelectItem>
                      <SelectItem value="plan">Por plano</SelectItem>
                      <SelectItem value="org">Organização específica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="datetime-local"
                    value={editing.starts_at ? editing.starts_at.slice(0, 16) : ""}
                    onChange={(e) =>
                      setEditing({ ...editing, starts_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Término (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={editing.ends_at ? editing.ends_at.slice(0, 16) : ""}
                    onChange={(e) =>
                      setEditing({ ...editing, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Rótulo do botão (CTA)</Label>
                  <Input
                    value={editing.cta_label ?? ""}
                    onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })}
                    className="mt-1"
                    placeholder="Saiba mais"
                  />
                </div>
                <div>
                  <Label className="text-xs">URL do CTA</Label>
                  <Input
                    value={editing.cta_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, cta_url: e.target.value })}
                    className="mt-1"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Permitir dispensar</Label>
                <Switch
                  checked={editing.dismissible ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, dismissible: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
