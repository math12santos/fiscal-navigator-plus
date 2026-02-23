import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Building2,
  Users,
  Shield,
  Plug,
  CreditCard,
  Activity,
  Search,
  Plus,
  Edit2,
  Power,
  Copy,
  Eye,
  Link2,
  Unlink,
} from "lucide-react";
import {
  useBackofficeOrgs,
  useBackofficeOrgMembers,
  useBackofficePermissions,
  useUpdateOrg,
  useManagePermissions,
  useBackofficeAuditLog,
} from "@/hooks/useBackoffice";
import { CreateUserDialog } from "@/components/CreateUserDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "fluxo-caixa", label: "Fluxo de Caixa" },
  { key: "contratos", label: "Contratos" },
  { key: "planejamento", label: "Planejamento" },
  { key: "conciliacao", label: "Conciliação" },
  { key: "dp", label: "Departamento Pessoal", placeholder: true },
  { key: "documentos", label: "Documentos da Empresa", placeholder: true },
];

const SCOPES = [
  { key: "empresa", label: "Empresa (consolidado)" },
  { key: "filial", label: "Filial / Unidade" },
  { key: "centro_custo", label: "Centro de Custo" },
  { key: "projeto", label: "Projeto / Contrato" },
  { key: "conta_bancaria", label: "Conta Bancária" },
  { key: "entidade", label: "Entidade (cliente/fornecedor)" },
];

const SENSITIVE_ACTIONS = [
  { key: "exportar", label: "Pode exportar dados" },
  { key: "editar_plano_contas", label: "Pode editar plano de contas" },
  { key: "aprovar_pagamentos", label: "Pode aprovar pagamentos" },
  { key: "integrar_bancos", label: "Pode integrar bancos" },
  { key: "convidar_usuarios", label: "Pode convidar usuários" },
  { key: "ver_dados_sensiveis", label: "Pode visualizar dados sensíveis" },
];

const ROLES = [
  { value: "owner", label: "Admin da Empresa" },
  { value: "admin", label: "CFO / Gestor Financeiro" },
  { value: "member", label: "Analista Financeiro" },
  { value: "viewer", label: "Visualizador" },
];

export default function BackofficeCompany() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: orgs = [] } = useBackofficeOrgs();
  const org = orgs.find((o) => o.id === orgId);
  const { data: members = [], isLoading: loadingMembers } = useBackofficeOrgMembers(orgId);
  const { data: permissions = [] } = useBackofficePermissions(orgId!);
  const { data: auditLogs = [] } = useBackofficeAuditLog(orgId);
  const updateOrg = useUpdateOrg();
  const { upsertPermission, clonePermissions } = useManagePermissions();

  // Fetch profiles for members
  const memberUserIds = useMemo(() => members.map((m: any) => m.user_id), [members]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["backoffice_profiles", memberUserIds],
    queryFn: async () => {
      if (memberUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", memberUserIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: memberUserIds.length > 0,
  });

  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("member");
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState<string>("");
  const [cloneTargetId, setCloneTargetId] = useState<string>("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("__all__");

  const profileMap = useMemo(() => {
    const map: Record<string, any> = {};
    profiles.forEach((p: any) => { map[p.id] = p; });
    return map;
  }, [profiles]);

  const filteredMembers = useMemo(() => {
    return members.filter((m: any) => {
      const profile = profileMap[m.user_id];
      const name = profile?.full_name || "";
      return !userSearch || name.toLowerCase().includes(userSearch.toLowerCase()) || m.user_id.includes(userSearch);
    });
  }, [members, userSearch, profileMap]);

  const filteredAudit = useMemo(() => {
    return auditLogs.filter((log: any) => {
      const matchSearch = !auditSearch || log.entity_type.includes(auditSearch) || log.action.includes(auditSearch);
      const matchAction = auditActionFilter === "__all__" || log.action === auditActionFilter;
      return matchSearch && matchAction;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  const handleUpdateOrgStatus = (status: string) => {
    if (!orgId) return;
    updateOrg.mutate({ id: orgId, status: status as any });
    toast({ title: `Status alterado para ${status}` });
  };

  const handleToggleModule = (userId: string, module: string, currentlyAllowed: boolean) => {
    if (!orgId) return;
    upsertPermission.mutate({
      user_id: userId,
      organization_id: orgId,
      module,
      allowed: !currentlyAllowed,
    });
  };

  const handleClone = () => {
    if (!orgId || !cloneSourceId || !cloneTargetId) return;
    clonePermissions.mutate(
      { sourceUserId: cloneSourceId, targetUserId: cloneTargetId, orgId },
      {
        onSuccess: () => {
          toast({ title: "Permissões clonadas com sucesso" });
          setCloneDialogOpen(false);
        },
      }
    );
  };

  if (!org) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Empresa não encontrada</p>
        <Button variant="outline" onClick={() => navigate("/backoffice")} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const selectedUserPerms = selectedUserId
    ? permissions.filter((p: any) => p.user_id === selectedUserId)
    : [];
  const permMap: Record<string, boolean> = {};
  selectedUserPerms.forEach((p: any) => {
    const key = p.tab ? `${p.module}:${p.tab}` : p.module;
    permMap[key] = p.allowed;
  });

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/backoffice")}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{org.name}</h1>
            <p className="text-xs text-muted-foreground font-mono">{org.document_number}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={org.status} onValueChange={handleUpdateOrgStatus}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativa">Ativa</SelectItem>
              <SelectItem value="suspensa">Suspensa</SelectItem>
              <SelectItem value="onboarding">Onboarding</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          <TabsTrigger value="modulos">Módulos</TabsTrigger>
          <TabsTrigger value="holding">Holding</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="plano">Plano & Cobrança</TabsTrigger>
        </TabsList>

        {/* ===== RESUMO ===== */}
        <TabsContent value="resumo" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard icon={Users} label="Usuários" value={String(members.length)} />
            <SummaryCard icon={Shield} label="Módulos Ativos" value={String(new Set(permissions.filter((p: any) => p.allowed).map((p: any) => p.module)).size)} />
            <SummaryCard icon={CreditCard} label="Plano" value={org.plano} />
            <SummaryCard icon={Activity} label="Última Atividade" value={format(new Date(org.updated_at), "dd/MM/yy")} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Informações da Empresa</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              <div><span className="text-muted-foreground">Nome:</span> <span className="text-foreground font-medium ml-1">{org.name}</span></div>
              <div><span className="text-muted-foreground">Documento:</span> <span className="font-mono ml-1 text-foreground">{org.document_type} {org.document_number}</span></div>
              <div><span className="text-muted-foreground">Criada em:</span> <span className="ml-1 text-foreground">{format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="ml-1 capitalize">{org.status}</Badge></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== USUÁRIOS ===== */}
        <TabsContent value="usuarios" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="Buscar usuário..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={() => setCreateUserOpen(true)} size="sm">
              <Plus size={14} className="mr-1" /> Criar Usuário
            </Button>
            <Button onClick={() => setCloneDialogOpen(true)} variant="outline" size="sm">
              <Copy size={14} className="mr-1" /> Clonar Permissões
            </Button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loadingMembers ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((m: any) => {
                    const profile = profileMap[m.user_id];
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <span className="font-medium text-foreground">{profile?.full_name || "Sem nome"}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{profile?.cargo || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{m.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={profile?.active !== false ? "default" : "secondary"}>
                            {profile?.active !== false ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setSelectedUserId(m.user_id)}
                              title="Ver permissões"
                            >
                              <Eye size={13} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar">
                              <Edit2 size={13} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ===== PERMISSÕES & GRANULARIDADE ===== */}
        <TabsContent value="permissoes" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={selectedUserId || ""} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m: any) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {profileMap[m.user_id]?.full_name || m.user_id.substring(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUserId ? (
            <div className="space-y-6">
              {/* Camada A — Módulos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Camada A — Acesso ao Módulo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {MODULES.map((mod) => (
                    <div key={mod.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground">{mod.label}</span>
                        {mod.placeholder && <Badge variant="outline" className="text-[10px]">Em breve</Badge>}
                      </div>
                      <Switch
                        checked={permMap[mod.key] ?? false}
                        onCheckedChange={() => handleToggleModule(selectedUserId, mod.key, permMap[mod.key] ?? false)}
                        disabled={mod.placeholder}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Camada B — Escopos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Camada B — Granularidade de Visualização</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {SCOPES.map((scope) => (
                    <div key={scope.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-foreground">{scope.label}</span>
                      <Switch
                        checked={permMap[`scope:${scope.key}`] ?? false}
                        onCheckedChange={() => handleToggleModule(selectedUserId, `scope`, permMap[`scope:${scope.key}`] ?? false)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Ações Sensíveis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Controle de Ações Sensíveis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {SENSITIVE_ACTIONS.map((action) => (
                    <div key={action.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-foreground">{action.label}</span>
                      <Switch
                        checked={permMap[`action:${action.key}`] ?? false}
                        onCheckedChange={() => handleToggleModule(selectedUserId, `action`, permMap[`action:${action.key}`] ?? false)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Selecione um usuário para gerenciar suas permissões.
            </div>
          )}
        </TabsContent>

        {/* ===== MÓDULOS ===== */}
        <TabsContent value="modulos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Módulos Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {MODULES.map((mod) => {
                  const activeUsers = permissions.filter((p: any) => p.module === mod.key && p.allowed).length;
                  return (
                    <div key={mod.key} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-foreground">{mod.label}</span>
                        {mod.placeholder && <Badge variant="outline" className="ml-2 text-[10px]">Placeholder</Badge>}
                        <p className="text-xs text-muted-foreground">{activeUsers} usuário(s) com acesso</p>
                      </div>
                      <Badge variant={activeUsers > 0 ? "default" : "secondary"}>
                        {activeUsers > 0 ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== HOLDING ===== */}
        <TabsContent value="holding" className="space-y-4">
          <HoldingTab orgId={orgId!} orgs={orgs} orgName={org.name} />
        </TabsContent>

        {/* ===== AUDITORIA ===== */}
        <TabsContent value="auditoria" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="Buscar nos logs..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as ações</SelectItem>
                <SelectItem value="INSERT">Criação</SelectItem>
                <SelectItem value="UPDATE">Alteração</SelectItem>
                <SelectItem value="DELETE">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudit.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum log encontrado</TableCell></TableRow>
                ) : (
                  filteredAudit.slice(0, 50).map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{log.entity_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{log.user_id.substring(0, 8)}...</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ===== INTEGRAÇÕES ===== */}
        <TabsContent value="integracoes" className="space-y-4">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Plug size={32} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm">Gerenciamento de integrações bancárias e APIs externas.</p>
              <p className="text-xs mt-1">Em desenvolvimento — será habilitado em breve.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PLANO & COBRANÇA ===== */}
        <TabsContent value="plano" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Plano Atual</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge className="text-sm capitalize px-3 py-1">{org.plano}</Badge>
                <Select
                  value={org.plano}
                  onValueChange={(v) => {
                    updateOrg.mutate({ id: orgId!, plano: v as any });
                    toast({ title: `Plano alterado para ${v}` });
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="básico">Básico</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  Sistema de cobrança será integrado em versão futura.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Clone Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clonar Permissões</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Copiar de:</Label>
              <Select value={cloneSourceId} onValueChange={setCloneSourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o usuário fonte" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m: any) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {profileMap[m.user_id]?.full_name || m.user_id.substring(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground">Aplicar em:</Label>
              <Select value={cloneTargetId} onValueChange={setCloneTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o usuário destino" />
                </SelectTrigger>
                <SelectContent>
                  {members.filter((m: any) => m.user_id !== cloneSourceId).map((m: any) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {profileMap[m.user_id]?.full_name || m.user_id.substring(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleClone} disabled={!cloneSourceId || !cloneTargetId}>Clonar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Create User Dialog */}
      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        currentOrgId={orgId}
        currentOrgName={org.name}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["backoffice_org_members"] })}
      />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon size={16} className="text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground capitalize">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HoldingTab({ orgId, orgs, orgName }: { orgId: string; orgs: any[]; orgName: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [linkAs, setLinkAs] = useState<"holding" | "subsidiary">("subsidiary");
  const [loading, setLoading] = useState(false);

  // Fetch holdings where this org is the holding (subsidiaries)
  const { data: subsidiaries = [] } = useQuery({
    queryKey: ["org_holdings_subsidiaries", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_holdings")
        .select("*")
        .eq("holding_id", orgId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch holdings where this org is a subsidiary
  const { data: parents = [] } = useQuery({
    queryKey: ["org_holdings_parents", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_holdings")
        .select("*")
        .eq("subsidiary_id", orgId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const linkedOrgIds = new Set([
    ...subsidiaries.map((s: any) => s.subsidiary_id),
    ...parents.map((p: any) => p.holding_id),
    orgId,
  ]);

  const availableOrgs = orgs.filter((o) => !linkedOrgIds.has(o.id));

  const getOrgName = (id: string) => orgs.find((o) => o.id === id)?.name || id.substring(0, 8);

  const handleLink = async () => {
    if (!selectedOrgId || !user) return;
    setLoading(true);
    try {
      const payload = linkAs === "subsidiary"
        ? { holding_id: orgId, subsidiary_id: selectedOrgId, created_by: user.id }
        : { holding_id: selectedOrgId, subsidiary_id: orgId, created_by: user.id };

      const { error } = await supabase.from("organization_holdings").insert(payload);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["org_holdings_subsidiaries", orgId] });
      qc.invalidateQueries({ queryKey: ["org_holdings_parents", orgId] });
      toast({ title: "Vínculo de holding criado" });
      setAddOpen(false);
      setSelectedOrgId("");
    } catch (err: any) {
      toast({ title: "Erro ao vincular", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (holdingRelId: string) => {
    const { error } = await supabase.from("organization_holdings").delete().eq("id", holdingRelId);
    if (error) {
      toast({ title: "Erro ao desvincular", variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["org_holdings_subsidiaries", orgId] });
    qc.invalidateQueries({ queryKey: ["org_holdings_parents", orgId] });
    toast({ title: "Vínculo removido" });
  };

  return (
    <div className="space-y-4">
      {/* Parent holdings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Holding (empresa-mãe)</CardTitle>
        </CardHeader>
        <CardContent>
          {parents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta empresa não pertence a nenhuma holding.</p>
          ) : (
            <div className="space-y-2">
              {parents.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-primary" />
                    <span className="text-sm font-medium text-foreground">{getOrgName(p.holding_id)}</span>
                    <Badge variant="outline" className="text-[10px]">Holding</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleUnlink(p.id)} title="Desvincular">
                    <Unlink size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subsidiaries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Subsidiárias / Controladas</CardTitle>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} className="mr-1" /> Vincular Empresa
          </Button>
        </CardHeader>
        <CardContent>
          {subsidiaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma subsidiária vinculada.</p>
          ) : (
            <div className="space-y-2">
              {subsidiaries.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{getOrgName(s.subsidiary_id)}</span>
                    <Badge variant="secondary" className="text-[10px]">Subsidiária</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleUnlink(s.id)} title="Desvincular">
                    <Unlink size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Link Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular Empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de vínculo</Label>
              <Select value={linkAs} onValueChange={(v) => setLinkAs(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="subsidiary">{orgName} é a Holding (adicionar subsidiária)</SelectItem>
                  <SelectItem value="holding">{orgName} é Subsidiária (adicionar holding)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{linkAs === "subsidiary" ? "Empresa subsidiária" : "Empresa holding"}</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
                <SelectContent>
                  {availableOrgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleLink} disabled={loading || !selectedOrgId}>
              <Link2 size={14} className="mr-1" /> {loading ? "Vinculando..." : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
