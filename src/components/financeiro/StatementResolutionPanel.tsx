import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, Link2, Pencil, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { useStatementResolution, type UnresolvedLine } from "@/hooks/useStatementResolution";
import { LinkToPlannedDialog } from "./LinkToPlannedDialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const DISCARD_CATEGORIES = [
  { value: "estorno", label: "Estorno do banco" },
  { value: "duplicata_externa", label: "Duplicata de outra fonte" },
  { value: "tarifa_irrelevante", label: "Tarifa imaterial" },
  { value: "ja_lancada", label: "Já lançada manualmente" },
  { value: "outro", label: "Outro motivo" },
];

export function StatementResolutionPanel({ open, onOpenChange }: Props) {
  const { unresolved, discard, correctAndRetry } = useStatementResolution();
  const [linkTarget, setLinkTarget] = useState<UnresolvedLine | null>(null);
  const [editTarget, setEditTarget] = useState<UnresolvedLine | null>(null);
  const [editForm, setEditForm] = useState({ data: "", valor: "", descricao: "", documento: "" });
  const [discardTarget, setDiscardTarget] = useState<UnresolvedLine | null>(null);
  const [discardForm, setDiscardForm] = useState({ category: "outro", reason: "" });

  const lines = unresolved.data ?? [];

  const openEdit = (l: UnresolvedLine) => {
    setEditTarget(l);
    setEditForm({
      data: l.parsed?.data ?? "",
      valor: l.parsed?.valor != null ? String(l.parsed.valor) : "",
      descricao: l.parsed?.descricao ?? "",
      documento: l.parsed?.documento ?? "",
    });
  };

  const submitEdit = () => {
    if (!editTarget) return;
    const valor = Number(editForm.valor);
    if (!editForm.data || isNaN(valor) || !editForm.descricao.trim()) return;
    correctAndRetry.mutate(
      {
        stagingId: editTarget.id,
        data: editForm.data,
        valor,
        descricao: editForm.descricao.trim(),
        documento: editForm.documento.trim() || null,
      },
      { onSuccess: () => setEditTarget(null) }
    );
  };

  const submitDiscard = () => {
    if (!discardTarget || !discardForm.reason.trim()) return;
    discard.mutate(
      { stagingId: discardTarget.id, category: discardForm.category, reason: discardForm.reason.trim() },
      { onSuccess: () => { setDiscardTarget(null); setDiscardForm({ category: "outro", reason: "" }); } }
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-5xl h-[85vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Resolver linhas do extrato
            </DialogTitle>
            <DialogDescription>
              Toda linha do extrato precisa de um destino. Corrija, vincule a um previsto, classifique como realizada
              ou descarte com motivo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
            {unresolved.isLoading ? (
              <div className="py-12 flex items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : lines.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-medium">Nenhuma linha pendente</p>
                <p className="text-xs text-muted-foreground">Todo o extrato está reconciliado ou resolvido.</p>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right w-[120px]">Valor</TableHead>
                      <TableHead className="w-[120px]">Conta</TableHead>
                      <TableHead className="w-[180px]">Erros</TableHead>
                      <TableHead className="text-right w-[280px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => {
                      const valor = Number(l.parsed?.valor ?? 0);
                      const valid = !!l.parsed?.data && l.parsed?.valor != null && l.errors.length === 0;
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs font-mono">{l.parsed?.data ?? "—"}</TableCell>
                          <TableCell className="text-xs max-w-[280px] truncate">
                            {l.parsed?.descricao ?? <span className="text-muted-foreground">(vazio)</span>}
                          </TableCell>
                          <TableCell className={cn("text-xs tabular-nums text-right", valor < 0 ? "text-destructive" : "text-success")}>
                            {l.parsed?.valor != null ? fmt(valor) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{l.bank_account_nome ?? "—"}</TableCell>
                          <TableCell>
                            {l.errors.length > 0 ? (
                              <div className="space-y-0.5">
                                {l.errors.slice(0, 2).map((e, i) => (
                                  <Badge key={i} variant="destructive" className="text-[10px] mr-1">{e}</Badge>
                                ))}
                                {l.errors.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground">+{l.errors.length - 2}</span>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Sem erros</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(l)}>
                              <Pencil className="h-3 w-3 mr-1" /> Corrigir
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs"
                              disabled={!valid}
                              title={!valid ? "Corrija data/valor antes de vincular" : ""}
                              onClick={() => setLinkTarget(l)}
                            >
                              <Link2 className="h-3 w-3 mr-1" /> Vincular
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => setDiscardTarget(l)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Descartar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <LinkToPlannedDialog
        open={!!linkTarget}
        onOpenChange={(o) => !o && setLinkTarget(null)}
        staging={linkTarget ? {
          id: linkTarget.id,
          bank_account_id: linkTarget.bank_account_id,
          parsed: linkTarget.parsed as any,
        } : null}
      />

      {/* Corrigir */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Corrigir linha</DialogTitle>
            <DialogDescription>Ajuste data, valor e descrição para reprocessar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Data (AAAA-MM-DD)</Label>
              <Input value={editForm.data} onChange={(e) => setEditForm({ ...editForm, data: e.target.value })} placeholder="2025-01-15" />
            </div>
            <div>
              <Label className="text-xs">Valor (use sinal negativo para débitos)</Label>
              <Input value={editForm.valor} onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })} placeholder="-150.00" />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={editForm.descricao} onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Documento (opcional)</Label>
              <Input value={editForm.documento} onChange={(e) => setEditForm({ ...editForm, documento: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>Cancelar</Button>
              <Button size="sm" onClick={submitEdit} disabled={correctAndRetry.isPending}>
                {correctAndRetry.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Salvar e reprocessar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Descartar */}
      <Dialog open={!!discardTarget} onOpenChange={(o) => !o && setDiscardTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Descartar linha</DialogTitle>
            <DialogDescription>
              A linha não vira lançamento, mas fica auditada para futura inspeção.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={discardForm.category} onValueChange={(v) => setDiscardForm({ ...discardForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISCARD_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Motivo (obrigatório)</Label>
              <Textarea
                value={discardForm.reason}
                onChange={(e) => setDiscardForm({ ...discardForm, reason: e.target.value })}
                placeholder="Explique por que esta linha não vira lançamento"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDiscardTarget(null)}>Cancelar</Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={submitDiscard}
                disabled={discard.isPending || discardForm.reason.trim().length < 3}
              >
                {discard.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Descartar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
