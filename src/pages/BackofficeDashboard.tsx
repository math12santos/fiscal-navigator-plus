import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Building2, Users, LayoutGrid, List, Settings, LogIn, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBackofficeOrgs, useBackofficeOrgMemberCounts } from "@/hooks/useBackoffice";
import { useQueryClient } from "@tanstack/react-query";
import { CreateOrgDialog } from "@/components/CreateOrgDialog";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  const { setCurrentOrg, refetch: refetchOrgs } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [entering, setEntering] = useState<string | null>(null);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<typeof orgs[0] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteOrg = async () => {
    if (!deleteOrgTarget || !user) return;
    setDeleting(true);
    try {
      const orgId = deleteOrgTarget.id;

      // Ensure master is owner so RLS allows deletes
      const { data: existing } = await supabase
        .from("organization_members")
        .select("id, role")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("organization_members").insert({
          organization_id: orgId,
          user_id: user.id,
          role: "owner",
        });
      } else if (existing.role !== "owner") {
        await supabase.from("organization_members").update({ role: "owner" }).eq("id", existing.id);
      }

      // Delete related data in correct order (children before parents)
      await supabase.from("organization_modules" as any).delete().eq("organization_id", orgId);
      await supabase.from("user_permissions").delete().eq("organization_id", orgId);
      await supabase.from("audit_log").delete().eq("organization_id", orgId);
      // DP data (children first)
      await supabase.from("payroll_items").delete().eq("organization_id", orgId);
      await supabase.from("payroll_runs").delete().eq("organization_id", orgId);
      await supabase.from("employee_benefits").delete().eq("organization_id", orgId);
      await supabase.from("employee_compensations").delete().eq("organization_id", orgId);
      await supabase.from("employee_terminations").delete().eq("organization_id", orgId);
      await supabase.from("employee_vacations").delete().eq("organization_id", orgId);
      await supabase.from("position_routines").delete().eq("organization_id", orgId);
      await supabase.from("employees").delete().eq("organization_id", orgId);
      await supabase.from("positions").delete().eq("organization_id", orgId);
      await supabase.from("dp_benefits").delete().eq("organization_id", orgId);
      await supabase.from("dp_config").delete().eq("organization_id", orgId);
      // Financial data
      await supabase.from("cashflow_entries").delete().eq("organization_id", orgId);
      await supabase.from("contract_installments").delete().eq("organization_id", orgId);
      await supabase.from("contract_adjustments").delete().eq("organization_id", orgId);
      await supabase.from("contract_documents").delete().eq("organization_id", orgId);
      await supabase.from("contracts").delete().eq("organization_id", orgId);
      await supabase.from("budget_lines").delete().eq("organization_id", orgId);
      await supabase.from("budget_versions").delete().eq("organization_id", orgId);
      // Planning & commercial
      await supabase.from("scenario_overrides").delete().eq("organization_id", orgId);
      await supabase.from("planning_scenarios").delete().eq("organization_id", orgId);
      await supabase.from("planning_config").delete().eq("organization_id", orgId);
      await supabase.from("commercial_budget_lines").delete().eq("organization_id", orgId);
      await supabase.from("commercial_channels").delete().eq("organization_id", orgId);
      await supabase.from("commercial_scenarios").delete().eq("organization_id", orgId);
      await supabase.from("commercial_plans").delete().eq("organization_id", orgId);
      await supabase.from("hr_planning_items").delete().eq("organization_id", orgId);
      // Config data
      await supabase.from("chart_of_accounts").delete().eq("organization_id", orgId);
      await supabase.from("cost_centers").delete().eq("organization_id", orgId);
      await supabase.from("entities").delete().eq("organization_id", orgId);
      await supabase.from("products" as any).delete().eq("organization_id", orgId);
      await supabase.from("fiscal_groups").delete().eq("organization_id", orgId);
      await supabase.from("liabilities").delete().eq("organization_id", orgId);
      await supabase.from("plan_migrations").delete().eq("organization_id", orgId);
      await supabase.from("organization_holdings").delete().eq("holding_id", orgId);
      await supabase.from("organization_holdings").delete().eq("subsidiary_id", orgId);
      // Members last (we need to be member to delete above)
      await supabase.from("organization_members").delete().eq("organization_id", orgId);
      // Delete org
      const { error } = await supabase.from("organizations").delete().eq("id", orgId);
      if (error) throw error;
      toast({ title: "Empresa excluída permanentemente" });
      setDeleteOrgTarget(null);
      queryClient.invalidateQueries({ queryKey: ["backoffice_orgs"] });
      queryClient.invalidateQueries({ queryKey: ["backoffice_org_member_counts"] });
    } catch (err: any) {
      toast({ title: "Erro ao excluir empresa", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleEnterCompany = async (org: typeof orgs[0]) => {
    if (!user) return;
    setEntering(org.id);
    try {
      // Ensure master is a member (owner) of this org
      const { data: existing } = await supabase
        .from("organization_members")
        .select("id, role")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("organization_members").insert({
          organization_id: org.id,
          user_id: user.id,
          role: "owner",
        });
      } else if (existing.role !== "owner") {
        await supabase.from("organization_members").update({ role: "owner" }).eq("id", existing.id);
      }

      await refetchOrgs();
      setCurrentOrg({
        id: org.id,
        name: org.name,
        document_type: org.document_type,
        document_number: org.document_number,
        logo_url: org.logo_url,
        created_by: org.created_by,
        created_at: org.created_at,
        updated_at: org.updated_at,
        onboarding_completed: org.onboarding_completed ?? true,
      });
      navigate("/");
    } catch (err) {
      toast({ title: "Erro ao acessar empresa", variant: "destructive" });
    } finally {
      setEntering(null);
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas Cadastradas</h1>
          <p className="text-sm text-muted-foreground">
            {orgs.length} empresa{orgs.length !== 1 ? "s" : ""} na plataforma
          </p>
        </div>
        <Button onClick={() => setCreateOrgOpen(true)}>
          <Plus size={14} className="mr-1" /> Criar Empresa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
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
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os planos</SelectItem>
            {planos.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-card">
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
        <div className="text-center py-16 text-muted-foreground">Carregando empresas...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nenhuma empresa encontrada.</div>
      ) : viewMode === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((org) => {
            const st = STATUS_MAP[org.status] || STATUS_MAP.ativa;
            return (
              <Card
                key={org.id}
                className="hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => navigate(`/backoffice/empresa/${org.id}`)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 size={18} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">{org.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{org.document_number}</p>
                      </div>
                    </div>
                    <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users size={12} />
                      <span>{memberCounts[org.id] ?? 0} usuários</span>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{org.plano}</Badge>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">
                      Última atualização: {format(new Date(org.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleEnterCompany(org); }}
                        disabled={entering === org.id}
                      >
                        <LogIn size={12} className="mr-1" />
                        {entering === org.id ? "Entrando..." : "Acessar"}
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/backoffice/empresa/${org.id}`); }}>
                        <Settings size={12} className="mr-1" /> Gerenciar
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteOrgTarget(org); }} title="Excluir empresa">
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usuários</TableHead>
                <TableHead>Última Atividade</TableHead>
                <TableHead className="w-48">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((org) => {
                const st = STATUS_MAP[org.status] || STATUS_MAP.ativa;
                return (
                  <TableRow key={org.id} className="hover:bg-secondary/50">
                    <TableCell className="font-medium text-foreground">{org.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{org.document_number}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{org.plano}</Badge></TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{memberCounts[org.id] ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(org.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleEnterCompany(org)}
                          disabled={entering === org.id}
                        >
                          <LogIn size={12} className="mr-1" />
                          {entering === org.id ? "Entrando..." : "Acessar"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => navigate(`/backoffice/empresa/${org.id}`)}
                        >
                          Gerenciar
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteOrgTarget(org)} title="Excluir empresa">
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <CreateOrgDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />

      {/* Delete Org Confirmation */}
      <AlertDialog open={!!deleteOrgTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteOrgTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os dados da empresa <strong>{deleteOrgTarget?.name}</strong> serão excluídos permanentemente, incluindo contratos, fluxo de caixa, colaboradores e demais registros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteOrg}
              disabled={deleting}
            >
              {deleting ? "Excluindo..." : "Excluir Permanentemente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
