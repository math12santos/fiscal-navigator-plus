import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lock, CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Readiness {
  year_month: string;
  extrato_total: number;
  extrato_pendente: number;
  staging_pendente: number;
  ap_total: number;
  ap_realizado: number;
  ar_total: number;
  ar_realizado: number;
  pct_extrato: number;
  pct_ap: number;
  pct_ar: number;
  pct_geral: number;
  ready: boolean;
}

export function MonthClosingReadinessCard() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [yearMonth, setYearMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data, isLoading } = useQuery({
    queryKey: ["month-closing-readiness", currentOrg?.id, yearMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_month_closing_readiness" as any, {
        p_org_id: currentOrg!.id,
        p_year_month: yearMonth,
      });
      if (error) throw error;
      return data as unknown as Readiness;
    },
    enabled: !!currentOrg?.id,
  });

  const close = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("close_fiscal_period" as any, {
        p_org_id: currentOrg!.id, p_year_month: yearMonth,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mês fechado", description: `${yearMonth} consolidado e bloqueado para escrita.` });
      qc.invalidateQueries({ queryKey: ["month-closing-readiness"] });
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
    },
    onError: (e: any) => toast({ title: "Não foi possível fechar", description: e.message, variant: "destructive" }),
  });

  const r = data;
  const pct = r?.pct_geral ?? 0;
  const ready = !!r?.ready;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-sm font-semibold">Fechamento de mês</h3>
            <p className="text-xs text-muted-foreground">
              Mês fecha quando AP + AR + Extrato estão 100% conciliados.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} className="h-9 w-[160px]" />
          <Button
            size="sm"
            disabled={!ready || close.isPending}
            onClick={() => close.mutate()}
            variant={ready ? "default" : "outline"}
          >
            {close.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> :
              ready ? <CheckCircle2 className="h-4 w-4 mr-1.5" /> : <Lock className="h-4 w-4 mr-1.5" />}
            Fechar mês
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="font-medium">Pronto para fechar</span>
          <span className={ready ? "text-success font-semibold" : "text-muted-foreground"}>
            {isLoading ? "—" : `${pct}%`}
          </span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      {r && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <ReadinessItem label="Extrato conciliado" pct={r.pct_extrato} detail={`${r.extrato_pendente} pendente${r.extrato_pendente === 1 ? "" : "s"}`} />
          <ReadinessItem label="Contas a pagar" pct={r.pct_ap} detail={`${r.ap_realizado}/${r.ap_total}`} />
          <ReadinessItem label="Contas a receber" pct={r.pct_ar} detail={`${r.ar_realizado}/${r.ar_total}`} />
        </div>
      )}

      {r && r.staging_pendente > 0 && (
        <p className="text-xs text-amber-600">
          {r.staging_pendente} linha(s) de extrato em staging aguardando resolução.
        </p>
      )}
    </div>
  );
}

function ReadinessItem({ label, pct, detail }: { label: string; pct: number; detail: string }) {
  const ok = pct >= 100;
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="flex justify-between mb-1">
        <span className="font-medium">{label}</span>
        <span className={ok ? "text-success font-semibold" : "text-muted-foreground"}>{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <p className="text-[11px] text-muted-foreground mt-1">{detail}</p>
    </div>
  );
}
