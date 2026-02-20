import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {
  Building2,
  Users,
  CreditCard,
  Calendar,
  Shield,
  ChevronRight,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrgRow {
  id: string;
  name: string;
  document_type: string;
  document_number: string;
  logo_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

function formatDoc(type: string, number: string) {
  if (type === "CPF") {
    return number.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return number.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5"
  );
}

export default function Backoffice() {
  const { user, loading: authLoading } = useAuth();
  const { isMaster, loading: roleLoading } = useUserRole();
  const [selectedOrg, setSelectedOrg] = useState<OrgRow | null>(null);

  // Fetch ALL organizations (master has access via service-level or we need a policy)
  // For now we fetch orgs the user is member of — master should be member of all or we use a dedicated query
  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ["backoffice-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return data as unknown as OrgRow[];
    },
    enabled: isMaster,
  });

  // Fetch members for selected org
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["backoffice-members", selectedOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members" as any)
        .select("*")
        .eq("organization_id", selectedOrg!.id);
      if (error) throw error;
      return data as unknown as MemberRow[];
    },
    enabled: !!selectedOrg,
  });

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary animate-pulse text-lg font-semibold">
          Verificando permissões...
        </div>
      </div>
    );
  }

  if (!user || !isMaster) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Backoffice Fincore"
        description="Painel administrativo — Visão de todas as empresas"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Empresas Ativas
            </p>
            <p className="text-2xl font-bold text-foreground">
              {orgsLoading ? "..." : orgs?.length ?? 0}
            </p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded-lg bg-success/10 p-3">
            <Users className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Membros
            </p>
            <p className="text-2xl font-bold text-foreground">—</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded-lg bg-warning/10 p-3">
            <CreditCard className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pagamentos Pendentes
            </p>
            <p className="text-2xl font-bold text-foreground">—</p>
          </div>
        </div>
      </div>

      {/* Org Cards Grid */}
      {orgsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs?.map((org) => (
            <Card
              key={org.id}
              className="glass-card cursor-pointer hover:border-primary/40 transition-all duration-200 group"
              onClick={() => setSelectedOrg(org)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">
                        {org.name}
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {org.document_type}:{" "}
                        {formatDoc(org.document_type, org.document_number)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Criada em{" "}
                      {format(new Date(org.created_at), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-success/30 text-success"
                  >
                    Ativa
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Panel (Slide-in) */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            onClick={() => setSelectedOrg(null)}
          />
          <div className="relative w-full max-w-lg bg-card border-l border-border animate-slide-in-right overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {selectedOrg.name}
                    </h2>
                    <p className="text-xs text-muted-foreground font-mono">
                      {selectedOrg.document_type}:{" "}
                      {formatDoc(
                        selectedOrg.document_type,
                        selectedOrg.document_number
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedOrg(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Info Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Informações da Empresa
                </h3>
                <div className="glass-card p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className="bg-success/10 text-success border-success/30">
                      Ativa
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Criada em</span>
                    <span className="text-foreground">
                      {format(new Date(selectedOrg.created_at), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Última atualização
                    </span>
                    <span className="text-foreground">
                      {format(new Date(selectedOrg.updated_at), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Members Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Membros ({membersLoading ? "..." : members?.length ?? 0})
                </h3>
                <div className="glass-card p-4 space-y-2">
                  {membersLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8" />
                      <Skeleton className="h-8" />
                    </div>
                  ) : members && members.length > 0 ? (
                    members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0"
                      >
                        <span className="text-muted-foreground font-mono text-xs truncate max-w-[200px]">
                          {m.user_id.substring(0, 8)}...
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {m.role}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum membro encontrado
                    </p>
                  )}
                </div>
              </div>

              {/* Payment Section (Mockup) */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Informações de Pagamento
                </h3>
                <div className="glass-card p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Plano</span>
                    <Badge className="bg-primary/10 text-primary border-primary/30">
                      Profissional
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor Mensal</span>
                    <span className="text-foreground font-semibold">
                      R$ 299,00
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Próximo Venc.</span>
                    <span className="text-foreground">15/03/2026</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Última Cobrança
                    </span>
                    <Badge className="bg-success/10 text-success border-success/30 text-[10px]">
                      Pago em 15/02/2026
                    </Badge>
                  </div>
                  <div className="border-t border-border/30 pt-3 mt-2">
                    <p className="text-[11px] text-muted-foreground italic">
                      * Dados de pagamento serão integrados em breve.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
