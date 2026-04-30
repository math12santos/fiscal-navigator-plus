import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, KeyRound, Copy, Webhook, CheckCircle2, AlertCircle, Clock, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Endpoint = {
  id: string;
  organization_id: string;
  provider: string;
  name: string;
  active: boolean;
  last_received_at: string | null;
  events_count: number;
  created_at: string;
};

type Event = {
  id: string;
  endpoint_id: string;
  external_id: string;
  event_type: string | null;
  status: "received" | "processed" | "error" | "ignored";
  error_message: string | null;
  cashflow_entry_id: string | null;
  received_at: string;
  processed_at: string | null;
};

const PROVIDERS = [
  { value: "omie", label: "Omie" },
  { value: "conta_azul", label: "Conta Azul" },
  { value: "bling", label: "Bling" },
  { value: "granatum", label: "Granatum" },
  { value: "custom", label: "Customizado" },
];

const STATUS_META: Record<Event["status"], { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  processed: { label: "Processado", className: "bg-success/10 text-success", Icon: CheckCircle2 },
  received: { label: "Recebido", className: "bg-warning/10 text-warning", Icon: Clock },
  error: { label: "Erro", className: "bg-destructive/10 text-destructive", Icon: AlertCircle },
  ignored: { label: "Ignorado", className: "bg-muted text-muted-foreground", Icon: AlertCircle },
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function IntegracoesTab() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const orgId = currentOrg?.id;

  const [createOpen, setCreateOpen] = useState(false);
  const [tokenDialog, setTokenDialog] = useState<{ url: string; token: string } | null>(null);
  const [form, setForm] = useState({ name: "", provider: "omie" });

  const endpoints = useQuery({
    queryKey: ["integration-endpoints", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("integration_endpoints" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Endpoint[];
    },
    enabled: !!orgId,
  });

  const events = useQuery({
    queryKey: ["integration-events", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("integration_events" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("received_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as Event[];
    },
    enabled: !!orgId,
  });

  const createEndpoint = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Organização não selecionada");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const { data: ep, error } = await supabase
        .from("integration_endpoints" as any)
        .insert({
          organization_id: orgId,
          user_id: userId,
          name: form.name.trim(),
          provider: form.provider,
          secret_hash: "pending", // será sobrescrito pelo rotate
        } as any)
        .select()
        .single();
      if (error) throw error;

      const { data: token, error: rotErr } = await supabase.rpc("rotate_endpoint_secret" as any, {
        p_endpoint_id: (ep as any).id,
      });
      if (rotErr) throw rotErr;

      const url = `${SUPABASE_URL}/functions/v1/webhook-ingest?endpoint=${(ep as any).id}`;
      return { url, token: token as string };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["integration-endpoints", orgId] });
      setCreateOpen(false);
      setForm({ name: "", provider: "omie" });
      setTokenDialog(r);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const rotateSecret = useMutation({
    mutationFn: async (endpointId: string) => {
      const { data, error } = await supabase.rpc("rotate_endpoint_secret" as any, {
        p_endpoint_id: endpointId,
      });
      if (error) throw error;
      return {
        url: `${SUPABASE_URL}/functions/v1/webhook-ingest?endpoint=${endpointId}`,
        token: data as string,
      };
    },
    onSuccess: (r) => setTokenDialog(r),
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async (e: Endpoint) => {
      const { error } = await supabase
        .from("integration_endpoints" as any)
        .update({ active: !e.active })
        .eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration-endpoints", orgId] }),
  });

  const removeEndpoint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("integration_endpoints" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-endpoints", orgId] });
      toast({ title: "Endpoint removido" });
    },
  });

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado` });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-semibold">Webhooks de Integração</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receba lançamentos de outros ERPs (Omie, Conta Azul, etc.) automaticamente.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo Endpoint
        </Button>
      </div>

      <div className="glass-card p-4">
        {endpoints.isLoading ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : endpoints.data && endpoints.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Eventos</TableHead>
                <TableHead>Último recebimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm font-medium">{e.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{e.provider}</Badge></TableCell>
                  <TableCell className="text-xs tabular-nums text-right">{e.events_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.last_received_at ? new Date(e.last_received_at).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.active ? "default" : "secondary"} className="text-[10px]">
                      {e.active ? "Ativo" : "Pausado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => rotateSecret.mutate(e.id)}>
                      <KeyRound className="h-3 w-3 mr-1" /> Rotacionar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleActive.mutate(e)}>
                      {e.active ? "Pausar" : "Ativar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                      onClick={() => { if (confirm(`Remover endpoint "${e.name}"?`)) removeEndpoint.mutate(e.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-12 text-center space-y-2">
            <Webhook className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum endpoint configurado</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Crie um endpoint para receber lançamentos automaticamente do seu ERP via webhook.
            </p>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-3">Eventos recentes</h4>
        <div className="glass-card p-4">
          {events.isLoading ? (
            <div className="py-6 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : events.data && events.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recebido em</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.data.map((ev) => {
                  const meta = STATUS_META[ev.status];
                  const Icon = meta.Icon;
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="text-xs font-mono">{new Date(ev.received_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{ev.event_type ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono max-w-[200px] truncate">{ev.external_id}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", meta.className)}>
                          <Icon size={11} /> {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[280px] truncate">{ev.error_message ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento recebido ainda.</p>
          )}
        </div>
      </div>

      {/* Criar endpoint */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Endpoint de Webhook</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ep-name">Nome</Label>
              <Input id="ep-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Omie - Empresa Matriz" />
            </div>
            <div>
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => createEndpoint.mutate()} disabled={!form.name.trim() || createEndpoint.isPending}>
              {createEndpoint.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mostra token UMA vez */}
      <Dialog open={!!tokenDialog} onOpenChange={(o) => !o && setTokenDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Credenciais do Webhook</DialogTitle></DialogHeader>
          {tokenDialog && (
            <div className="space-y-4">
              <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-xs text-warning-foreground">
                ⚠️ Copie o token agora — ele <strong>não será exibido novamente</strong>. Configure-o no header <code>X-Webhook-Token</code> da chamada.
              </div>

              <div>
                <Label className="text-xs">URL</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={tokenDialog.url} className="font-mono text-xs" />
                  <Button size="sm" variant="outline" onClick={() => copy(tokenDialog.url, "URL")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs">Token (X-Webhook-Token)</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={tokenDialog.token} className="font-mono text-xs" />
                  <Button size="sm" variant="outline" onClick={() => copy(tokenDialog.token, "Token")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs font-medium mb-1.5">Exemplo de payload (POST JSON):</p>
                <pre className="text-[11px] font-mono overflow-auto bg-background/50 rounded p-2">
{`{
  "external_id": "fatura-123",
  "event_type": "cashflow.create",
  "data": {
    "descricao": "Fatura de venda #123",
    "valor": 1500.00,
    "tipo": "receber",
    "data_prevista": "2026-05-10",
    "status": "previsto",
    "favorecido": "Cliente XPTO"
  }
}`}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setTokenDialog(null)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
