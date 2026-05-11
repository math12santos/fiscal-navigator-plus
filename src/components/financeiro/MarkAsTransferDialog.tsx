import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, ArrowLeftRight, Search } from "lucide-react";
import { useStatementResolution, type UnresolvedLine, type TransferCounterparty } from "@/hooks/useStatementResolution";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  staging: UnresolvedLine | null;
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function MarkAsTransferDialog({ open, onOpenChange, staging }: Props) {
  const { searchTransferCounterparties, markAsTransfer } = useStatementResolution();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<TransferCounterparty[]>([]);
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    if (!open || !staging) {
      setCandidates([]);
      return;
    }
    setDescricao(String(staging.parsed?.descricao ?? ""));
    let cancelled = false;
    setLoading(true);
    searchTransferCounterparties(staging.id, 3)
      .then((r) => { if (!cancelled) setCandidates(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, staging?.id]);

  const valorSigned = staging?.parsed?.valor != null ? Number(staging.parsed.valor) : 0;
  const data = staging?.parsed?.data ?? "";

  const handlePick = (c: TransferCounterparty | null) => {
    if (!staging) return;
    markAsTransfer.mutate(
      {
        stagingId: staging.id,
        counterpartyStagingId: c?.staging_id ?? null,
        descricao: descricao.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" /> Marcar como transferência entre contas
          </DialogTitle>
          <DialogDescription>
            Pareie esta linha com a contraparte na outra conta. A transferência é registrada como
            evento único — não conta como receita nem despesa.
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

        <div>
          <Label className="text-xs">Descrição da transferência (opcional)</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Contraparte (linha espelho em outra conta)</Label>
          <div className="max-h-[280px] overflow-auto space-y-1.5 rounded-md border p-2">
            {loading ? (
              <div className="py-6 flex items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando contrapartes...
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Search className="h-5 w-5 mx-auto mb-2 opacity-50" />
                Nenhuma contraparte encontrada nas outras contas (janela ±3 dias).
              </div>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.staging_id}
                  onClick={() => handlePick(c)}
                  disabled={markAsTransfer.isPending}
                  className="w-full text-left rounded-md border p-2.5 hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{c.bank_account_nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.descricao ?? "(sem descrição)"}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{c.data}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={Number(c.valor) < 0 ? "text-destructive text-sm font-semibold tabular-nums" : "text-success text-sm font-semibold tabular-nums"}>
                        {fmt(Math.abs(Number(c.valor)))}
                      </div>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        {(Number(c.match_score) * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePick(null)}
            disabled={markAsTransfer.isPending}
            className="sm:mr-auto"
          >
            Registrar sem contraparte (aguardar outro extrato)
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
