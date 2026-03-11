import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Plus, Edit2, Trash2, Building2, ShieldCheck } from "lucide-react";
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
import { useBackofficeOrgs, useBackofficeUsers as useBackofficeUsersList, useManageBackofficeUsers, useBackofficeOrgAccess } from "@/hooks/useBackoffice";
import { CreateUserDialog } from "@/components/CreateUserDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield } from "lucide-react";

const ROLES = [
  { value: "owner", label: "Admin" },
  { value: "admin", label: "CFO" },
  { value: "member", label: "Analista" },
  { value: "viewer", label: "Visualizador" },
];

export default function BackofficeUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: orgs = [] } = useBackofficeOrgs();
  const { data: backofficeUsers = [] } = useBackofficeUsersList();
  const { upsertBackofficeUser, removeBackofficeUser, assignOrgAccess, removeOrgAccess } = useManageBackofficeUsers();
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("__all__");
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [boDialogUser, setBoDialogUser] = useState<any>(null);

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: deleteUserTarget.userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuário excluído permanentemente" });
      setDeleteUserTarget(null);
      qc.invalidateQueries({ queryKey: ["backoffice_all_members"] });
      qc.invalidateQueries({ queryKey: ["backoffice_all_profiles"] });
    } catch (err: any) {
      toast({ title: "Erro ao excluir usuário", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // Edit user state
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editCargo, setEditCargo] = useState("");
  const [editMemberships, setEditMemberships] = useState<{ id: string; organization_id: string; role: string }[]>([]);

  // Fetch all members across all orgs
  const { data: allMembers = [], refetch } = useQuery({
    queryKey: ["backoffice_all_members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("*");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch all profiles
  const memberUserIds = useMemo(() => [...new Set(allMembers.map((m: any) => m.user_id))], [allMembers]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["backoffice_all_profiles", memberUserIds],
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

  const profileMap = useMemo(() => {
    const map: Record<string, any> = {};
    profiles.forEach((p: any) => { map[p.id] = p; });
    return map;
  }, [profiles]);

  const orgMap = useMemo(() => {
    const map: Record<string, string> = {};
    orgs.forEach((o) => { map[o.id] = o.name; });
    return map;
  }, [orgs]);

  const boUserMap = useMemo(() => {
    const map: Record<string, any> = {};
    backofficeUsers.forEach((bu: any) => { map[bu.user_id] = bu; });
    return map;
  }, [backofficeUsers]);

  const BO_ROLES = [
    { value: "backoffice_operator", label: "Operador" },
    { value: "backoffice_admin", label: "Admin BPO" },
    { value: "auditor", label: "Auditor" },
  ];

  // Build a unique user list with their memberships
  const userList = useMemo(() => {
    const grouped: Record<string, { userId: string; memberships: any[] }> = {};
    allMembers.forEach((m: any) => {
      if (!grouped[m.user_id]) {
        grouped[m.user_id] = { userId: m.user_id, memberships: [] };
      }
      grouped[m.user_id].memberships.push(m);
    });
    return Object.values(grouped);
  }, [allMembers]);

  const filtered = useMemo(() => {
    return userList.filter((u) => {
      const profile = profileMap[u.userId];
      const name = profile?.full_name || "";
      const email = profile?.email || "";
      const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
      const matchOrg = orgFilter === "__all__" || u.memberships.some((m: any) => m.organization_id === orgFilter);
      return matchSearch && matchOrg;
    });
  }, [userList, search, orgFilter, profileMap]);

  const handleOpenEdit = (u: any) => {
    const profile = profileMap[u.userId];
    setEditingUser(u);
    setEditName(profile?.full_name || "");
    setEditCargo(profile?.cargo || "");
    setEditMemberships(u.memberships.map((m: any) => ({
      id: m.id,
      organization_id: m.organization_id,
      role: m.role,
    })));
    setEditOpen(true);
  };

  const handleMembershipRoleChange = (membershipId: string, newRole: string) => {
    setEditMemberships((prev) =>
      prev.map((m) => m.id === membershipId ? { ...m, role: newRole } : m)
    );
  };

  const handleRemoveMembership = (membershipId: string) => {
    setEditMemberships((prev) => prev.filter((m) => m.id !== membershipId));
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    try {
      // Update profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ full_name: editName, cargo: editCargo })
        .eq("id", editingUser.userId);
      if (profileErr) throw profileErr;

      // Update each membership role
      for (const m of editMemberships) {
        const { error } = await supabase
          .from("organization_members")
          .update({ role: m.role })
          .eq("id", m.id);
        if (error) throw error;
      }

      // Remove deleted memberships
      const currentIds = editMemberships.map((m) => m.id);
      const removedIds = editingUser.memberships
        .filter((m: any) => !currentIds.includes(m.id))
        .map((m: any) => m.id);
      for (const id of removedIds) {
        await supabase.from("organization_members").delete().eq("id", id);
      }

      toast({ title: "Usuário atualizado com sucesso" });
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["backoffice_all_members"] });
      qc.invalidateQueries({ queryKey: ["backoffice_all_profiles"] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            {userList.length} usuário{userList.length !== 1 ? "s" : ""} na plataforma
          </p>
        </div>
        <Button onClick={() => setCreateUserOpen(true)}>
          <Plus size={14} className="mr-1" /> Criar Usuário
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={orgFilter} onValueChange={setOrgFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as empresas</SelectItem>
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Empresas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const profile = profileMap[u.userId];
                return (
                  <TableRow key={u.userId}>
                    <TableCell>
                      <span className="font-medium text-foreground">{profile?.full_name || "Sem nome"}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{profile?.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{profile?.cargo || "—"}</TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
                            <Building2 size={13} />
                            {u.memberships.length} empresa{u.memberships.length !== 1 ? "s" : ""}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="start">
                          <div className="space-y-1.5">
                            {u.memberships.map((m: any) => (
                              <div key={m.id} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/40">
                                <span className="truncate font-medium">{orgMap[m.organization_id] || "?"}</span>
                                <Badge variant="outline" className="text-[10px] ml-2 shrink-0">{m.role}</Badge>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={profile?.active !== false ? "default" : "secondary"}>
                          {profile?.active !== false ? "Ativo" : "Inativo"}
                        </Badge>
                        {boUserMap[u.userId] && (
                          <Badge variant="outline" className="text-[10px] gap-0.5 border-primary/40 text-primary">
                            <ShieldCheck size={10} />
                            {boUserMap[u.userId].role === "backoffice_admin" ? "Admin BPO" : boUserMap[u.userId].role === "auditor" ? "Auditor" : "Operador"}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(u)} title="Editar usuário">
                          <Edit2 size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setBoDialogUser(u)} title="Backoffice BPO">
                          <ShieldCheck size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteUserTarget(u)} title="Excluir usuário">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onSuccess={() => refetch()}
      />

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={editCargo} onChange={(e) => setEditCargo(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Vínculos com empresas</Label>
              {editMemberships.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum vínculo.</p>
              )}
              {editMemberships.map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                  <span className="flex-1 text-sm font-medium truncate">
                    {orgMap[m.organization_id] || m.organization_id.substring(0, 8)}
                  </span>
                  <Select value={m.role} onValueChange={(v) => handleMembershipRoleChange(m.id, v)}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveMembership(m.id)}
                    title="Remover vínculo"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUserTarget} onOpenChange={(open) => !open && setDeleteUserTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O usuário <strong>{deleteUserTarget ? profileMap[deleteUserTarget.userId]?.full_name || "Sem nome" : ""}</strong> será excluído permanentemente, incluindo todos os vínculos, permissões e dados de autenticação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
