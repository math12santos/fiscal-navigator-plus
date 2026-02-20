import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Building2, Users, LayoutGrid, List, Settings } from "lucide-react";
import { useBackofficeOrgs, useBackofficeOrgMemberCounts } from "@/hooks/useBackoffice";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativa: { label: "Ativa", variant: "default" },
  suspensa: { label: "Suspensa", variant: "destructive" },
  onboarding: { label: "Onboarding", variant: "outline" },
};

export default function BackofficeDashboard() {
  const { data: orgs = [], isLoading } = useBackofficeOrgs();
  const { data: memberCounts = {} } = useBackofficeOrgMemberCounts();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [planoFilter, setPlanoFilter] = useState("__all__");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  const planos = useMemo(() => [...new Set(orgs.map((o) => o.plano))], [orgs]);

  const filtered = useMemo(() => {
    return orgs.filter((o) => {
      const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.document_number.includes(search);
      const matchStatus = statusFilter === "__all__" || o.status === statusFilter;
      const matchPlano = planoFilter === "__all__" || o.plano === planoFilter;
      return matchSearch && matchStatus && matchPlano;
    });
  }, [orgs, search, statusFilter, planoFilter]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[hsl(222_47%_11%)]">Empresas Cadastradas</h1>
        <p className="text-sm text-[hsl(215_16%_47%)]">
          {orgs.length} empresa{orgs.length !== 1 ? "s" : ""} na plataforma
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215_16%_47%)]" size={16} />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[hsl(0_0%_100%)] border-[hsl(220_13%_90%)] text-[hsl(222_47%_11%)]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-[hsl(0_0%_100%)] border-[hsl(220_13%_90%)] text-[hsl(222_47%_11%)]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="suspensa">Suspensa</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planoFilter} onValueChange={setPlanoFilter}>
          <SelectTrigger className="w-40 bg-[hsl(0_0%_100%)] border-[hsl(220_13%_90%)] text-[hsl(222_47%_11%)]">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os planos</SelectItem>
            {planos.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 border border-[hsl(220_13%_90%)] rounded-lg p-0.5 bg-[hsl(0_0%_100%)]">
          <Button
            variant={viewMode === "cards" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("cards")}
          >
            <LayoutGrid size={14} />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
          >
            <List size={14} />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-16 text-[hsl(215_16%_47%)]">Carregando empresas...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[hsl(215_16%_47%)]">Nenhuma empresa encontrada.</div>
      ) : viewMode === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((org) => {
            const st = STATUS_MAP[org.status] || STATUS_MAP.ativa;
            return (
              <Card
                key={org.id}
                className="bg-[hsl(0_0%_100%)] border-[hsl(220_13%_90%)] hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => navigate(`/backoffice/empresa/${org.id}`)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 size={18} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[hsl(222_47%_11%)] text-sm">{org.name}</h3>
                        <p className="text-xs text-[hsl(215_16%_47%)] font-mono">{org.document_number}</p>
                      </div>
                    </div>
                    <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[hsl(215_16%_47%)]">
                    <div className="flex items-center gap-1">
                      <Users size={12} />
                      <span>{memberCounts[org.id] ?? 0} usuários</span>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{org.plano}</Badge>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-[hsl(215_16%_47%)]">
                      Última atualização: {format(new Date(org.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <Settings size={12} className="mr-1" /> Gerenciar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="bg-[hsl(0_0%_100%)] border border-[hsl(220_13%_90%)] rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-[hsl(220_13%_90%)]">
                <TableHead className="text-[hsl(215_16%_47%)]">Empresa</TableHead>
                <TableHead className="text-[hsl(215_16%_47%)]">CNPJ</TableHead>
                <TableHead className="text-[hsl(215_16%_47%)]">Plano</TableHead>
                <TableHead className="text-[hsl(215_16%_47%)]">Status</TableHead>
                <TableHead className="text-[hsl(215_16%_47%)]">Usuários</TableHead>
                <TableHead className="text-[hsl(215_16%_47%)]">Última Atividade</TableHead>
                <TableHead className="text-[hsl(215_16%_47%)] w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((org) => {
                const st = STATUS_MAP[org.status] || STATUS_MAP.ativa;
                return (
                  <TableRow key={org.id} className="border-[hsl(220_13%_90%)] hover:bg-[hsl(220_14%_96%)]">
                    <TableCell className="font-medium text-[hsl(222_47%_11%)]">{org.name}</TableCell>
                    <TableCell className="font-mono text-xs text-[hsl(215_16%_47%)]">{org.document_number}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{org.plano}</Badge></TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell className="text-[hsl(215_16%_47%)]">{memberCounts[org.id] ?? 0}</TableCell>
                    <TableCell className="text-[hsl(215_16%_47%)] text-xs">
                      {format(new Date(org.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => navigate(`/backoffice/empresa/${org.id}`)}
                      >
                        Gerenciar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
