import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, Link2, Pencil, Trash2, Loader2, CheckCircle2, MoreHorizontal, Plus, ArrowLeftRight, RotateCcw, Lock } from "lucide-react";
import { useStatementResolution, type UnresolvedLine } from "@/hooks/useStatementResolution";
import { LinkToPlannedDialog } from "./LinkToPlannedDialog";
import { CreateCashflowFromStatementDialog } from "./CreateCashflowFromStatementDialog";
import { MarkAsTransferDialog } from "./MarkAsTransferDialog";
import { MarkAsReversalDialog } from "./MarkAsReversalDialog";
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
  const [createTarget, setCreateTarget] = useState<UnresolvedLine | null>(null);
  const [transferTarget, setTransferTarget] = useState<UnresolvedLine | null>(null);
  const [reversalTarget, setReversalTarget] = useState<UnresolvedLine | null>(null);
  const [editTarget, setEditTarget] = useState<UnresolvedLine | null>(null);
  const [editForm, setEditForm] = useState({ descricao: "", documento: "" });
  const [editLocked, setEditLocked] = useState({ data: "", valor: "" });
  const [discardTarget, setDiscardTarget] = useState<UnresolvedLine | null>(null);
  const [discardForm, setDiscardForm] = useState({ category: "outro", reason: "" });

  const lines = unresolved.data ?? [];

  const openEdit = (l: UnresolvedLine) => {
    setEditTarget(l);
    setEditForm({
      descricao: String(l.parsed?.descricao ?? ""),
      documento: String(l.parsed?.documento ?? ""),
    });
    setEditLocked({
      data: l.parsed?.data ?? "",
      valor: l.parsed?.valor != null ? String(l.parsed.valor) : "",
    });
  };

  const dataLocked = !!editLocked.data;
  const valorLocked = editLocked.valor !== "";
  const [editFreeData, setEditFreeData] = useState("");
  const [editFreeValor, setEditFreeValor] = useState("");

  const submitEdit = () => {
    if (!editTarget) return;
    const data = dataLocked ? editLocked.data : editFreeData;
    const valor = valorLocked ? Number(editLocked.valor) : Number(editFreeValor);
    if (!data || isNaN(valor) || !editForm.descricao.trim()) return;
    correctAndRetry.mutate(
      {
        stagingId: editTarget.id,
        data,
        valor,
        descricao: editForm.descricao.trim(),
        documento: editForm.documento.trim() || null,
      },
      { onSuccess: () => { setEditTarget(null); setEditFreeData(""); setEditFreeValor(""); } }
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
              Toda linha precisa de um destino: vincule a um previsto, crie um lançamento novo,
              marque como transferência entre contas, registre como estorno ou descarte com motivo.
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
                      <TableHead className="w-[160px]">Erros</TableHead>
                      <TableHead className="text-right w-[260px]">Ações</TableHead>
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
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs"
                              disabled={!valid}
                              title={!valid ? "Complemente data/valor antes de vincular" : ""}
                              onClick={() => setLinkTarget(l)}
                            >
                              <Link2 className="h-3 w-3 mr-1" /> Vincular
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={!valid}
                              title={!valid ? "Complemente data/valor antes" : ""}
                              onClick={() => setCreateTarget(l)}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Criar
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem disabled={!valid} onClick={() => setTransferTarget(l)}>
                                  <ArrowLeftRight className="h-3.5 w-3.5 mr-2" /> É transferência entre contas
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={!valid} onClick={() => setReversalTarget(l)}>
                                  <RotateCcw className="h-3.5 w-3.5 mr-2" /> É estorno / devolução
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEdit(l)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" /> Complementar dados
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDiscardTarget(l)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Descartar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      <CreateCashflowFromStatementDialog
        open={!!createTarget}
        onOpenChange={(o) => !o && setCreateTarget(null)}
        staging={createTarget}
      />

      <MarkAsTransferDialog
        open={!!transferTarget}
        onOpenChange={(o) => !o && setTransferTarget(null)}
        staging={transferTarget}
      />

      <MarkAsReversalDialog
        open={!!reversalTarget}
        onOpenChange={(o) => !o && setReversalTarget(null)}
        staging={reversalTarget}
      />

      {/* Complementar dados (data e valor imutáveis quando vêm do extrato) */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complementar dados da linha</DialogTitle>
            <DialogDescription>
              Data e valor vêm do extrato e não podem ser alterados — ajuste apenas descrição
              e documento. Caso o banco não tenha enviado data/valor, os campos abrem para edição.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs flex items-center gap-1">
                Data {dataLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {dataLocked ? (
                <Input value={editLocked.data} readOnly className="bg-muted/50 font-mono" />
              ) : (
                <Input
                  value={editFreeData}
                  onChange={(e) => setEditFreeData(e.target.value)}
                  placeholder="2025-01-15"
                />
              )}
              {dataLocked && (
                <p className="text-[10px] text-muted-foreground mt-0.5">imutável (vem do extrato)</p>
              )}
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                Valor {valorLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {valorLocked ? (
                <Input value={editLocked.valor} readOnly className="bg-muted/50 font-mono" />
              ) : (
                <Input
                  value={editFreeValor}
                  onChange={(e) => setEditFreeValor(e.target.value)}
                  placeholder="-150.00"
                />
              )}
              {valorLocked && (
                <p className="text-[10px] text-muted-foreground mt-0.5">imutável (vem do extrato)</p>
              )}
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
