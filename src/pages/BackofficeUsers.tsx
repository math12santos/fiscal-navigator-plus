import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Eye, Edit2 } from "lucide-react";
import { useBackofficeOrgs } from "@/hooks/useBackoffice";
import { CreateUserDialog } from "@/components/CreateUserDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ROLES = [
  { value: "owner", label: "Admin" },
  { value: "admin", label: "CFO" },
  { value: "member", label: "Analista" },
  { value: "viewer", label: "Visualizador" },
];

export default function BackofficeUsers() {
  const { user } = useAuth();
  const { data: orgs = [] } = useBackofficeOrgs();
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("__all__");
  const [createUserOpen, setCreateUserOpen] = useState(false);

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
      const email = profile?.id || "";
      const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || email.includes(search);
      const matchOrg = orgFilter === "__all__" || u.memberships.some((m: any) => m.organization_id === orgFilter);
      return matchSearch && matchOrg;
    });
  }, [userList, search, orgFilter, profileMap]);

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
              <TableHead>Cargo</TableHead>
              <TableHead>Empresas</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                    <TableCell className="text-muted-foreground">{profile?.cargo || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.memberships.map((m: any) => (
                          <Badge key={m.id} variant="outline" className="text-xs">
                            {orgMap[m.organization_id] || "?"} ({m.role})
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={profile?.active !== false ? "default" : "secondary"}>
                        {profile?.active !== false ? "Ativo" : "Inativo"}
                      </Badge>
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
    </div>
  );
}
