import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useEntities } from "@/hooks/useEntities";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";

interface StatementLine {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  bank_account_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: StatementLine | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function ClassifyAndReconcileDialog({ open, onOpenChange, entry }: Props) {
  const { accounts, isLoading: loadingAccounts } = useChartOfAccounts();
  const { costCenters, isLoading: loadingCC } = useCostCenters();
  const { entities, isLoading: loadingEntities } = useEntities();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [accountId, setAccountId] = useState<string>("");
  const [costCenterId, setCostCenterId] = useState<string>("");
  const [entityId, setEntityId] = useState<string>("");
  const [competencia, setCompetencia] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saveRule, setSaveRule] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const tipo = (entry?.valor ?? 0) >= 0 ? "receita" : "despesa";

  useEffect(() => {
    if (!entry) return;
    setAccountId("");
    setCostCenterId("");
    setEntityId("");
    setCompetencia(entry.data?.slice(0, 7) ?? "");
    setNotes(entry.descricao ?? "");
    setSaveRule(true);
  }, [entry?.id]);

  // Filter accounts: only analytic (level 4) of the matching nature
  const accountOptions = useMemo(() => {
    return (accounts || [])
      .filter((a: any) => a.active && a.level === 4)
      .filter((a: any) =>
        tipo === "receita"
          ? a.type === "receita"
          : ["despesa", "custo", "investimento"].includes(a.type)
      )
      .map((a: any) => ({
        value: a.id,
        label: `${a.code} — ${a.name}`,
      }));
  }, [accounts, tipo]);

  const ccOptions = useMemo(
    () =>
      (costCenters || [])
        .filter((c: any) => c.active !== false)
        .map((c: any) => ({ value: c.id, label: `${c.code ?? ""} ${c.name}`.trim() })),
    [costCenters]
  );

  const entityOptions = useMemo(
    () =>
      (entities || [])
        .filter((e: any) => e.active !== false)
        .map((e: any) => ({ value: e.id, label: e.name })),
    [entities]
  );

  const canSubmit = !!entry && !!accountId && !!costCenterId && !submitting;

  const handleSubmit = async () => {
    if (!entry || !canSubmit || !currentOrg?.id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("materialize_unplanned_statement_entry" as any, {
        p_statement_id: entry.id,
        p_classification: {
          account_id: accountId,
          cost_center_id: costCenterId,
          entity_id: entityId || null,
          competencia: competencia || null,
          notes: notes || null,
          natureza_contabil: "caixa",
        },
      });
      if (error) throw error;

      // Optional: persist a reconciliation rule from a description token
      if (saveRule && entry.descricao) {
        const token = entry.descricao
          .toUpperCase()
          .replace(/[^A-Z0-9 ]+/g, " ")
          .split(/\s+/)
          .filter((w) => w.length >= 4)[0];
        if (token) {
          await supabase
            .from("reconciliation_rules" as any)
            .insert({
              organization_id: currentOrg.id,
              match_type: "contains",
              match_value: token,
              account_id: accountId,
              cost_center_id: costCenterId,
              priority: 50,
              active: true,
            } as any)
            .then(() => {}, () => {});
        }
      }

      qc.invalidateQueries({ queryKey: ["bank-statement-entries", currentOrg.id] });
      qc.invalidateQueries({ queryKey: ["cashflow-entries"] });
      qc.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
      toast({
        title: "Lançamento classificado e conciliado",
        description: "Um realizado foi criado no fluxo de caixa.",
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Erro ao classificar",
        description: e?.message ?? "Falha desconhecida",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Classificar e conciliar lançamento
          </DialogTitle>
          <DialogDescription>
            Esta linha do extrato não estava no plano. Classifique antes de conciliar para que o caixa real reflita o banco.
          </DialogDescription>
        </DialogHeader>

        {entry && (
          <div className="rounded-md bg-muted/40 p-3 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium leading-tight">{entry.descricao}</div>
              <Badge variant={entry.valor < 0 ? "destructive" : "default"} className="shrink-0">
                {tipo === "receita" ? "Crédito" : "Débito"}
              </Badge>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{entry.data}</span>
              <span className="tabular-nums font-mono">{fmt(entry.valor)}</span>
            </div>
          </div>
        )}

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">
              Conta contábil <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              value={accountId}
              onValueChange={setAccountId}
              options={accountOptions}
              placeholder={loadingAccounts ? "Carregando contas..." : "Selecione a conta..."}
              disabled={loadingAccounts}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">
              Centro de custo <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              value={costCenterId}
              onValueChange={setCostCenterId}
              options={ccOptions}
              placeholder={loadingCC ? "Carregando..." : "Selecione o centro de custo..."}
              disabled={loadingCC}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Entidade / fornecedor (opcional)</Label>
            <SearchableSelect
              value={entityId}
              onValueChange={setEntityId}
              options={entityOptions}
              placeholder={loadingEntities ? "Carregando..." : "—"}
              disabled={loadingEntities}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Competência</Label>
              <Input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Tipo</Label>
              <Input value={tipo} disabled className="capitalize" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={saveRule}
              onCheckedChange={(v) => setSaveRule(!!v)}
              className="mt-0.5"
            />
            <span>
              Salvar regra para classificar lançamentos futuros com descrição parecida automaticamente.
            </span>
          </label>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
          <span>
            Ao confirmar, criamos um lançamento <strong>realizado</strong> no fluxo de caixa com data {entry?.data} e valor {entry ? fmt(entry.valor) : "—"}, e marcamos esta linha como conciliada.
          </span>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Classificar e conciliar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
