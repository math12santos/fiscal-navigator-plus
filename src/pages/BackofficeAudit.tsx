import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Shield, ScrollText } from "lucide-react";
import { useBackofficeAuditLog, useBackofficeOrgs } from "@/hooks/useBackoffice";
import { useSecurityEvents } from "@/hooks/useSecurityEvents";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SECURITY_EVENT_LABEL: Record<string, { label: string; tone: "default" | "destructive" | "warning" | "success" }> = {
  password_reset_requested: { label: "Reset solicitado", tone: "default" },
  password_reset_link_invalid: { label: "Link inválido", tone: "warning" },
  password_reset_link_expired: { label: "Link expirado", tone: "warning" },
  password_changed: { label: "Senha alterada", tone: "success" },
  password_change_reauth_failed: { label: "Reauth falhou", tone: "destructive" },
  session_revoked_global: { label: "Sessões encerradas", tone: "default" },
  login_success: { label: "Login OK", tone: "success" },
  login_failed: { label: "Login falhou", tone: "destructive" },
  rate_limit_blocked: { label: "Bloqueio por limite", tone: "warning" },
};

function shortDevice(ua: string | null): string {
  if (!ua) return "—";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return ua.slice(0, 24);
}

function AuditTab() {
  const { data: auditLogs = [], isLoading } = useBackofficeAuditLog();
  const { data: orgs = [] } = useBackofficeOrgs();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("__all__");

  const orgMap = useMemo(() => {
    const map: Record<string, string> = {};
    orgs.forEach((o) => { map[o.id] = o.name; });
    return map;
  }, [orgs]);

  const actions = useMemo(
    () => [...new Set(auditLogs.map((l: any) => l.action))],
    [auditLogs]
  );

  const filtered = useMemo(() => {
    return auditLogs.filter((log: any) => {
      const matchSearch = !search || log.entity_type.includes(search) || log.action.includes(search);
      const matchAction = actionFilter === "__all__" || log.action === actionFilter;
      return matchSearch && matchAction;
    });
  }, [auditLogs, search, actionFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Buscar por tipo ou ação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as ações</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Empresa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.entity_type}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {log.organization_id ? orgMap[log.organization_id] || log.organization_id.substring(0, 8) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function SecurityTab() {
  const { data: events = [], isLoading } = useSecurityEvents();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("__all__");

  const types = useMemo(
    () => [...new Set(events.map((e) => e.event_type))],
    [events]
  );

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchSearch =
        !search ||
        (e.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
        e.event_type.includes(search.toLowerCase());
      const matchType = typeFilter === "__all__" || e.event_type === typeFilter;
      return matchSearch && matchType;
    });
  }, [events, search, typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Buscar por e-mail ou tipo de evento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Tipo de evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os eventos</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {SECURITY_EVENT_LABEL[t]?.label ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum evento de segurança registrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((ev) => {
                  const meta = SECURITY_EVENT_LABEL[ev.event_type] ?? { label: ev.event_type, tone: "default" as const };
                  const variant =
                    meta.tone === "destructive" ? "destructive"
                    : meta.tone === "warning" ? "secondary"
                    : meta.tone === "success" ? "default"
                    : "outline";
                  const extra = ev.metadata && Object.keys(ev.metadata).length
                    ? Object.entries(ev.metadata).map(([k, v]) => `${k}: ${String(v)}`).join(" • ")
                    : "—";
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(ev.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={variant as any}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {ev.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs" title={ev.user_agent ?? undefined}>
                        {shortDevice(ev.user_agent)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-md truncate" title={extra}>
                        {extra}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

export default function BackofficeAudit() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Registro global de ações na plataforma e eventos de segurança.
        </p>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit" className="gap-2">
            <ScrollText className="h-4 w-4" /> Auditoria geral
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" /> Segurança
          </TabsTrigger>
        </TabsList>
        <TabsContent value="audit" className="mt-6">
          <AuditTab />
        </TabsContent>
        <TabsContent value="security" className="mt-6">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
