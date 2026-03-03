import { useState } from "react";
import { useRequests, type Request } from "@/hooks/useRequests";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RequestFormDialog } from "./RequestFormDialog";
import { RequestDetail } from "./RequestDetail";

const priorityColors: Record<string, string> = {
  urgente: "bg-destructive/10 text-destructive",
  alta: "bg-destructive/10 text-destructive",
  media: "bg-warning/10 text-warning",
  baixa: "bg-muted text-muted-foreground",
};

const statusColors: Record<string, string> = {
  aberta: "bg-primary/10 text-primary",
  em_analise: "bg-warning/10 text-warning",
  em_execucao: "bg-accent/10 text-accent-foreground",
  aguardando_aprovacao: "bg-warning/10 text-warning",
  concluida: "bg-success/10 text-success",
  rejeitada: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em Análise",
  em_execucao: "Em Execução",
  aguardando_aprovacao: "Aguard. Aprovação",
  concluida: "Concluída",
  rejeitada: "Rejeitada",
};

export function SolicitacoesTab() {
  const [filterType, setFilterType] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [filterPriority, setFilterPriority] = useState("__all__");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<Request | null>(null);

  const { data: requests = [], isLoading } = useRequests({
    type: filterType !== "__all__" ? filterType : undefined,
    status: filterStatus !== "__all__" ? filterStatus : undefined,
    priority: filterPriority !== "__all__" ? filterPriority : undefined,
  });

  const filtered = requests.filter(
    (r) => !search || r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar solicitações..."
            className="pl-9 h-9"
          />
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="financeiro">Financeiro</SelectItem>
            <SelectItem value="compras">Compras</SelectItem>
            <SelectItem value="contratos">Contratos</SelectItem>
            <SelectItem value="juridico">Jurídico</SelectItem>
            <SelectItem value="rh">RH</SelectItem>
            <SelectItem value="ti">TI</SelectItem>
            <SelectItem value="operacional">Operacional</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={() => setFormOpen(true)} className="ml-auto">
          <Plus size={16} className="mr-1" /> Nova Solicitação
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Criação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma solicitação encontrada</TableCell></TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailRequest(r)}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{r.type}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={priorityColors[r.priority]}>{r.priority}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={statusColors[r.status]}>{STATUS_LABELS[r.status] ?? r.status}</Badge></TableCell>
                  <TableCell className="text-xs">{r.due_date ? format(new Date(r.due_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                  <TableCell className="text-xs">{format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RequestFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <RequestDetail open={!!detailRequest} onOpenChange={(open) => !open && setDetailRequest(null)} request={detailRequest} />
    </div>
  );
}
