import { useState } from "react";
import { CRMClient } from "@/hooks/useCRM";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";

interface Props {
  clients: CRMClient[];
  onAdd: () => void;
  onEdit: (client: CRMClient) => void;
  onDelete: (id: string) => void;
  onView: (client: CRMClient) => void;
}

const statusColors: Record<string, string> = {
  prospect: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ativo: "bg-green-500/10 text-green-400 border-green-500/20",
  inativo: "bg-muted text-muted-foreground border-border",
  churn: "bg-destructive/10 text-destructive border-destructive/20",
  em_risco: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const statusLabels: Record<string, string> = {
  prospect: "Prospect",
  ativo: "Ativo",
  inativo: "Inativo",
  churn: "Churn",
  em_risco: "Em Risco",
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

export function CRMClientTable({ clients, onAdd, onEdit, onDelete, onView }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = clients.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !(c.segment ?? "").toLowerCase().includes(search.toLowerCase()) &&
        !(c.responsible ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="em_risco">Em Risco</SelectItem>
              <SelectItem value="churn">Churn</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onAdd} size="sm">
          <Plus size={16} className="mr-1" /> Novo Cliente
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-3 text-muted-foreground font-medium">Nome</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Segmento</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Responsável</th>
                <th className="text-right p-3 text-muted-foreground font-medium">MRR</th>
                <th className="text-center p-3 text-muted-foreground font-medium">Score</th>
                <th className="text-center p-3 text-muted-foreground font-medium">Saúde</th>
                <th className="text-center p-3 text-muted-foreground font-medium">Churn</th>
                <th className="text-right p-3 text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center p-8 text-muted-foreground">Nenhum cliente encontrado</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium text-foreground">{c.name}</td>
                  <td className="p-3 text-muted-foreground">{c.segment ?? "—"}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={statusColors[c.status] ?? ""}>
                      {statusLabels[c.status] ?? c.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{c.responsible ?? "—"}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(Number(c.mrr))}</td>
                  <td className="p-3 text-center">
                    <span className={`font-medium ${c.score >= 70 ? "text-green-400" : c.score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                      {c.score}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`font-medium ${c.health_score >= 70 ? "text-green-400" : c.health_score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                      {c.health_score}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant="outline" className={
                      c.churn_risk === "alto" ? "bg-destructive/10 text-destructive border-destructive/20" :
                      c.churn_risk === "medio" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                      "bg-green-500/10 text-green-400 border-green-500/20"
                    }>
                      {c.churn_risk}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView(c)}>
                        <Eye size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(c)}>
                        <Edit size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(c.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
