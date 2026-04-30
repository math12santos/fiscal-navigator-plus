import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useITAuditLog } from "@/hooks/useITAuditLog";
import { ChevronDown, ChevronRight, Shield } from "lucide-react";

const TABLES = [
  { v: "__all__", label: "Todas" },
  { v: "it_systems", label: "Sistemas" },
  { v: "it_equipment", label: "Equipamentos" },
  { v: "it_telecom_links", label: "Telecom" },
  { v: "it_tickets", label: "Chamados" },
  { v: "it_sla_policies", label: "Políticas SLA" },
  { v: "it_equipment_movements", label: "Movimentações" },
];

const ACTIONS = [
  { v: "__all__", label: "Todas" },
  { v: "insert", label: "Criação" },
  { v: "update", label: "Alteração" },
  { v: "delete", label: "Exclusão" },
  { v: "status_change", label: "Mudança de status" },
];

function actionBadge(a: string) {
  const map: Record<string, string> = {
    insert: "bg-success/15 text-success",
    update: "bg-warning/15 text-warning",
    delete: "bg-destructive/15 text-destructive",
    status_change: "bg-primary/15 text-primary",
  };
  return <Badge variant="outline" className={map[a] ?? ""}>{a}</Badge>;
}

export function AuditLogSection() {
  const { currentOrg } = useOrganization();
  const [table, setTable] = useState<string>("__all__");
  const [action, setAction] = useState<string>("__all__");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useITAuditLog({
    orgId: currentOrg?.id,
    table: table === "__all__" ? null : table,
    action: action === "__all__" ? null : action,
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(to + "T23:59:59").toISOString() : null,
    limit: 200,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" /> Trilha de auditoria — TI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Entidade</Label>
            <Select value={table} onValueChange={setTable}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TABLES.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ação</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => <SelectItem key={a.v} value={a.v}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento auditado.</p>
        ) : (
          <div className="border rounded-md max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Campos alterados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((row) => {
                  const open = expanded === row.id;
                  return (
                    <>
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setExpanded(open ? null : row.id)}
                      >
                        <TableCell>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="text-xs">{new Date(row.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-xs">{row.table_name}</TableCell>
                        <TableCell>{actionBadge(row.action)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.changed_fields?.slice(0, 5).join(", ")}
                          {(row.changed_fields?.length ?? 0) > 5 ? "…" : ""}
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow key={`${row.id}-d`}>
                          <TableCell colSpan={5} className="bg-muted/20">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="font-semibold mb-1">Antes</p>
                                <pre className="bg-background p-2 rounded border overflow-auto max-h-60">{JSON.stringify(row.before_data, null, 2)}</pre>
                              </div>
                              <div>
                                <p className="font-semibold mb-1">Depois</p>
                                <pre className="bg-background p-2 rounded border overflow-auto max-h-60">{JSON.stringify(row.after_data, null, 2)}</pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
