import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Lock, Plus } from "lucide-react";
import { useStatementResolution, type UnresolvedLine } from "@/hooks/useStatementResolution";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useEntities } from "@/hooks/useEntities";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  staging: UnresolvedLine | null;
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const NONE = "__none__";

export function CreateCashflowFromStatementDialog({ open, onOpenChange, staging }: Props) {
  const { createFromStatement } = useStatementResolution();
  const { accounts } = useChartOfAccounts();
  const { costCenters } = useCostCenters();
  const { entities } = useEntities();

  const [descricao, setDescricao] = useState("");
  const [accountId, setAccountId] = useState<string>(NONE);
  const [costCenterId, setCostCenterId] = useState<string>(NONE);
  const [entityId, setEntityId] = useState<string>(NONE);
  const [notes, setNotes] = useState("");

  const valorSigned = staging?.parsed?.valor != null ? Number(staging.parsed.valor) : 0;
  const tipo = valorSigned >= 0 ? "Receita" : "Despesa";
  const data = staging?.parsed?.data ?? "";

  // Reset whenever a new staging is opened
  useMemo(() => {
    if (open && staging) {
      setDescricao(String(staging.parsed?.descricao ?? ""));
      setAccountId(NONE);
      setCostCenterId(NONE);
      setEntityId(NONE);
      setNotes("");
    }
  }, [open, staging?.id]);

  const filteredEntities = entities.filter((e: any) =>
    valorSigned >= 0 ? e.tipo !== "fornecedor" : e.tipo !== "cliente"
  );

  const submit = () => {
    if (!staging || !descricao.trim()) return;
    createFromStatement.mutate(
      {
        stagingId: staging.id,
        descricao: descricao.trim(),
        account_id: accountId === NONE ? null : accountId,
        cost_center_id: costCenterId === NONE ? null : costCenterId,
        entity_id: entityId === NONE ? null : entityId,
        notes: notes.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Criar lançamento a partir do extrato
          </DialogTitle>
          <DialogDescription>
            A movimentação vira um lançamento já realizado no sistema. Use quando não existe
            previsto para vincular.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/40 p-3 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{tipo}</span>
            <span className={valorSigned < 0 ? "text-destructive font-semibold tabular-nums" : "text-success font-semibold tabular-nums"}>
              {fmt(Math.abs(valorSigned))}
            </span>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">{data}</div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3" /> data e valor vêm do extrato (imutáveis)
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Conta contábil</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value={NONE}>—</SelectItem>
                {accounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.codigo} · {a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Centro de custo</Label>
              <Select value={costCenterId} onValueChange={setCostCenterId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={NONE}>—</SelectItem>
                  {costCenters.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{valorSigned >= 0 ? "Cliente" : "Fornecedor"}</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={NONE}>—</SelectItem>
                  {filteredEntities.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={createFromStatement.isPending || !descricao.trim()}
          >
            {createFromStatement.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Criar e marcar como realizado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
