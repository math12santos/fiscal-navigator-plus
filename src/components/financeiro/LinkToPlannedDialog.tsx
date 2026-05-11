import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Link2, Search } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useStatementResolution, type CashflowLinkCandidate } from "@/hooks/useStatementResolution";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  staging: {
    id: string;
    bank_account_id: string;
    parsed: { data?: string; valor?: number; descricao?: string };
  } | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  previsto: { label: "Previsto", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  atrasado: { label: "Atrasado", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  realizado: { label: "Já conciliado", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40" },
};

export function LinkToPlannedDialog({ open, onOpenChange, staging }: Props) {
  const { searchCandidates, linkToCashflow } = useStatementResolution();
  const [includeReconciled, setIncludeReconciled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<CashflowLinkCandidate[]>([]);
  const [confirmRelink, setConfirmRelink] = useState<CashflowLinkCandidate | null>(null);

  useEffect(() => {
    if (!open || !staging?.parsed?.data || staging?.parsed?.valor == null) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchCandidates(
      staging.bank_account_id,
      staging.parsed.data,
      Number(staging.parsed.valor),
      includeReconciled
    )
      .then((r) => { if (!cancelled) setCandidates(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, staging?.id, includeReconciled]);

  const handlePick = (c: CashflowLinkCandidate) => {
    if (!staging) return;
    if (c.ja_conciliado_com_id) {
      setConfirmRelink(c);
    } else {
      linkToCashflow.mutate(
        { stagingId: staging.id, cashflowId: c.cashflow_id, force: false },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  const confirmAndRelink = () => {
    if (!staging || !confirmRelink) return;
    linkToCashflow.mutate(
      { stagingId: staging.id, cashflowId: confirmRelink.cashflow_id, force: true },
      {
        onSuccess: () => {
          setConfirmRelink(null);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Vincular a um lançamento previsto
            </DialogTitle>
            <DialogDescription>
              Escolha o previsto que esta linha do extrato realiza. O previsto será marcado como
              realizado e o saldo bancário ficará coerente.
            </DialogDescription>
          </DialogHeader>

          {staging && (
            <div className="rounded-md bg-muted/40 p-3 text-sm space-y-0.5">
              <div className="font-medium">{staging.parsed.descricao || "(sem descrição)"}</div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {staging.parsed.data ?? "—"} · {staging.parsed.valor != null ? fmt(Number(staging.parsed.valor)) : "—"}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="incl-reconciled" className="text-sm font-medium">
                Mostrar também previstos já conciliados
              </Label>
              <p className="text-xs text-muted-foreground">
                Use para corrigir uma conciliação anterior. A linha bancária antiga voltará para "pendente".
              </p>
            </div>
            <Switch
              id="incl-reconciled"
              checked={includeReconciled}
              onCheckedChange={setIncludeReconciled}
            />
          </div>

          <div className="max-h-[420px] overflow-auto space-y-1.5">
            {loading ? (
              <div className="py-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando candidatos...
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Search className="h-5 w-5 mx-auto mb-2 opacity-50" />
                Nenhum lançamento compatível encontrado.
                {!includeReconciled && (
                  <p className="text-xs mt-1">Tente ativar "incluir já conciliados".</p>
                )}
              </div>
            ) : (
              candidates.map((c) => {
                const meta = STATUS_LABEL[c.status] ?? { label: c.status, cls: "bg-muted text-muted-foreground" };
                const valor = Number(c.valor_realizado ?? c.valor_previsto);
                const data = c.data_realizada ?? c.data_prevista;
                const isReconciled = !!c.ja_conciliado_com_id;
                return (
                  <button
                    key={c.cashflow_id}
                    onClick={() => handlePick(c)}
                    className="w-full text-left rounded-md border p-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{c.descricao}</span>
                          <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>
                            {meta.label}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                          <span>{data ?? "—"}</span>
                          <span className="tabular-nums">{fmt(valor)}</span>
                        </div>
                        {isReconciled && (
                          <div className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>
                              Conciliado anteriormente com:{" "}
                              <strong>{c.ja_conciliado_com_descricao}</strong>
                              {c.ja_conciliado_com_data ? ` em ${c.ja_conciliado_com_data}` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {(c.match_score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRelink} onOpenChange={(o) => !o && setConfirmRelink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir conciliação anterior?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Este previsto já foi conciliado com a linha bancária:{" "}
                <strong>{confirmRelink?.ja_conciliado_com_descricao}</strong>
                {confirmRelink?.ja_conciliado_com_data ? ` (${confirmRelink.ja_conciliado_com_data})` : ""}.
              </p>
              <p>
                A linha bancária anterior voltará para o status <strong>"pendente"</strong> e
                aparecerá novamente na fila de resolução. A substituição fica registrada na
                trilha de auditoria.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndRelink} disabled={linkToCashflow.isPending}>
              {linkToCashflow.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Substituindo...</>
              ) : (
                "Confirmar substituição"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
