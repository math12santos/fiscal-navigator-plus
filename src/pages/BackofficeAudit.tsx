import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { useBackofficeAuditLog, useBackofficeOrgs } from "@/hooks/useBackoffice";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function BackofficeAudit() {
  const { data: auditLogs = [], isLoading } = useBackofficeAuditLog();
  const { data: orgs = [] } = useBackofficeOrgs();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("__all__");

  const orgMap = useMemo(() => {
    const map: Record<string, string> = {};
    orgs.forEach((o) => { map[o.id] = o.name; });
    return map;
  }, [orgs]);

  const actions = useMemo(() => [...new Set(auditLogs.map((l: any) => l.action))], [auditLogs]);

  const filtered = useMemo(() => {
    return auditLogs.filter((log: any) => {
      const matchSearch = !search || log.entity_type.includes(search) || log.action.includes(search);
      const matchAction = actionFilter === "__all__" || log.action === actionFilter;
      return matchSearch && matchAction;
    });
  }, [auditLogs, search, actionFilter]);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Registro global de ações na plataforma
        </p>
      </div>

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
