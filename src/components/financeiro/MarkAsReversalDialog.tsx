import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, RotateCcw, Search } from "lucide-react";
import { useStatementResolution, type UnresolvedLine, type ReversalCandidate } from "@/hooks/useStatementResolution";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  staging: UnresolvedLine | null;
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function MarkAsReversalDialog({ open, onOpenChange, staging }: Props) {
  const { searchReversalCandidates, markAsReversal } = useStatementResolution();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<ReversalCandidate[]>([]);
  const [picked, setPicked] = useState<ReversalCandidate | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !staging) {
      setCandidates([]); setPicked(null); setNotes("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchReversalCandidates(staging.id, 90)
      .then((r) => { if (!cancelled) setCandidates(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, staging?.id]);

  const valorSigned = staging?.parsed?.valor != null ? Number(staging.parsed.valor) : 0;
  const data = staging?.parsed?.data ?? "";

  const submit = () => {
    if (!staging || !picked) return;
    markAsReversal.mutate(
      { stagingId: staging.id, originalEntryId: picked.cashflow_id, notes: notes.trim() || null },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Marcar como estorno / devolução
          </DialogTitle>
          <DialogDescription>
            Selecione o lançamento realizado que esta linha do extrato anula. O original será
            marcado como estornado — sem criar receita ou despesa duplicada.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/40 p-3 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{staging?.bank_account_nome ?? "Conta"}</span>
            <span className={valorSigned < 0 ? "text-destructive tabular-nums font-semibold" : "text-success tabular-nums font-semibold"}>
              {fmt(Math.abs(valorSigned))} {valorSigned < 0 ? "(saída)" : "(entrada)"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">{data}</div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3" /> dados imutáveis do extrato
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Lançamento original (mesmo valor, sentido oposto)</Label>
          <div className="max-h-[280px] overflow-auto space-y-1.5 rounded-md border p-2">
            {loading ? (
              <div className="py-6 flex items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando candidatos...
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Search className="h-5 w-5 mx-auto mb-2 opacity-50" />
                Nenhum lançamento realizado compatível encontrado nos últimos 90 dias.
              </div>
            ) : (
              candidates.map((c) => {
                const selected = picked?.cashflow_id === c.cashflow_id;
                return (
                  <button
                    key={c.cashflow_id}
                    onClick={() => setPicked(c)}
                    className={`w-full text-left rounded-md border p-2.5 transition-colors ${selected ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{c.descricao}</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                          {c.data_realizada ?? "—"} · {c.tipo}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={c.tipo === "saida" ? "text-destructive text-sm font-semibold tabular-nums" : "text-success text-sm font-semibold tabular-nums"}>
                          {fmt(Number(c.valor_realizado ?? 0))}
                        </div>
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          {(Number(c.match_score) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div>
          <Label className="text-xs">Observações (opcional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={!picked || markAsReversal.isPending}>
            {markAsReversal.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Confirmar estorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
