import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useHolding } from "@/contexts/HoldingContext";
import { useOrganization, Organization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowRight, CheckCircle2, Clock, Circle, Loader2, Plus } from "lucide-react";
import { CreateSubsidiaryDialog } from "./CreateSubsidiaryDialog";
import { useQueryClient } from "@tanstack/react-query";

interface SubOnboardingStatus {
  org: Organization;
  status: "not_started" | "in_progress" | "completed";
  currentStep?: number;
}

export function HoldingOnboardingView() {
  const navigate = useNavigate();
  const { subsidiaryOrgs, isLoading: holdingLoading } = useHolding();
  const { currentOrg, setCurrentOrg } = useOrganization();
  const qc = useQueryClient();
  const [statuses, setStatuses] = useState<SubOnboardingStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    if (holdingLoading || subsidiaryOrgs.length === 0) {
      setLoading(false);
      return;
    }

    const fetchStatuses = async () => {
      const subIds = subsidiaryOrgs.map((o) => o.id);
      const { data: progressRows } = await supabase
        .from("onboarding_progress" as any)
        .select("organization_id, status, current_step")
        .in("organization_id", subIds);

      const progressMap = new Map(
        ((progressRows as any[]) ?? []).map((r: any) => [r.organization_id, r])
      );

      const result: SubOnboardingStatus[] = subsidiaryOrgs.map((org) => {
        const p = progressMap.get(org.id);
        if (!p) return { org, status: "not_started" as const };
        if (p.status === "concluido") return { org, status: "completed" as const };
        return { org, status: "in_progress" as const, currentStep: p.current_step };
      });

      setStatuses(result);
      setLoading(false);
    };

    fetchStatuses();
  }, [subsidiaryOrgs, holdingLoading]);

  const handleGoToSubsidiary = (org: Organization) => {
    setCurrentOrg(org);
    // Small delay to allow context to update
    setTimeout(() => navigate("/onboarding-guiado"), 100);
  };

  const statusIcon = (s: SubOnboardingStatus["status"]) => {
    if (s === "completed") return <CheckCircle2 size={16} className="text-primary" />;
    if (s === "in_progress") return <Clock size={16} className="text-warning" />;
    return <Circle size={16} className="text-muted-foreground" />;
  };

  const statusLabel = (s: SubOnboardingStatus) => {
    if (s.status === "completed") return <Badge className="bg-primary/10 text-primary border-primary/20">Concluído</Badge>;
    if (s.status === "in_progress") return <Badge variant="outline" className="text-warning border-warning/30">Etapa {s.currentStep}/10</Badge>;
    return <Badge variant="secondary">Não iniciado</Badge>;
  };

  if (loading || holdingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Onboarding por Empresa</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            O onboarding guiado é configurado individualmente por empresa.
            Selecione uma subsidiária para iniciar ou continuar a implantação financeira.
          </p>
        </div>

        {subsidiaryOrgs.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
            Nenhuma subsidiária vinculada a esta holding. Adicione uma empresa para começar.
          </div>
        ) : (
          <div className="space-y-3">
            {statuses.map((s) => (
              <div
                key={s.org.id}
                className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {statusIcon(s.status)}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{s.org.name}</p>
                    <p className="text-xs text-muted-foreground">{s.org.document_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {statusLabel(s)}
                  <Button
                    size="sm"
                    variant={s.status === "completed" ? "outline" : "default"}
                    onClick={() => handleGoToSubsidiary(s.org)}
                  >
                    {s.status === "completed" ? "Revisar" : s.status === "in_progress" ? "Continuar" : "Iniciar"}
                    <ArrowRight size={14} className="ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Voltar ao Dashboard
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus size={16} className="mr-1" />
            Adicionar Empresa
          </Button>
        </div>

        {currentOrg && (
          <CreateSubsidiaryDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            holdingId={currentOrg.id}
            onCreated={() => {
              qc.invalidateQueries({ queryKey: ["holding_subsidiaries"] });
              qc.invalidateQueries({ queryKey: ["organization_holdings"] });
            }}
          />
        )}
      </div>
    </div>
  );
}
