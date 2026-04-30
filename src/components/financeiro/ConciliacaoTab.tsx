import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, AlertTriangle, Clock, Upload, Link2, Unlink, EyeOff, Loader2, Wand2, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConciliacao, type StatementStatus, type CashflowCandidate } from "@/hooks/useConciliacao";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { BankStatementImportDialog } from "@/components/financeiro/BankStatementImportDialog";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STATUS_META: Record<StatementStatus, { label: string; className: string; Icon: typeof CheckCircle }> = {
  conciliado: { label: "Conciliado", className: "bg-success/10 text-success", Icon: CheckCircle },
  divergente: { label: "Divergente", className: "bg-destructive/10 text-destructive", Icon: AlertTriangle },
  pendente: { label: "Pendente", className: "bg-warning/10 text-warning", Icon: Clock },
  ignorado: { label: "Ignorado", className: "bg-muted text-muted-foreground", Icon: EyeOff },
};

export function ConciliacaoTab() {
  const [bankFilter, setBankFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<StatementStatus | "all">("all");
  const [importOpen, setImportOpen] = useState(false);
  const [matchEntry, setMatchEntry] = useState<{ id: string; descricao: string; valor: number } | null>(null);
  const [candidates, setCandidates] = useState<CashflowCandidate[]>([]);
  const [loadingCands, setLoadingCands] = useState(false);

  const { bankAccounts } = useBankAccounts();
  const { entries, isLoading, stats, fetchCandidates, reconcile, unreconcile, updateStatus, autoReconcileBatch, snapshotBalances } = useConciliacao({
    bankAccountId: bankFilter === "__all__" ? undefined : bankFilter,
    status: statusFilter,
  });

  const openMatch = async (e: { id: string; descricao: string; valor: number }) => {
    setMatchEntry(e);
    setLoadingCands(true);
    try {
      setCandidates(await fetchCandidates(e.id));
    } finally {
      setLoadingCands(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Importar Extrato
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Taxa de Conciliação</p>
          <p className="text-2xl font-bold text-success mt-1">{stats.taxa.toFixed(0)}%</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Conciliados</p>
          <p className="text-2xl font-bold mt-1">{stats.conciliados}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Divergências</p>
          <p className="text-2xl font-bold text-destructive mt-1">{stats.divergentes}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-warning mt-1">{stats.pendentes}</p>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={bankFilter} onValueChange={setBankFilter}>
            <SelectTrigger className="w-[240px] h-9 text-sm"><SelectValue placeholder="Conta bancária" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as contas</SelectItem>
              {bankAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}{a.banco ? ` (${a.banco})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="conciliado">Conciliado</SelectItem>
              <SelectItem value="divergente">Divergente</SelectItem>
              <SelectItem value="ignorado">Ignorado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma linha de extrato importada ainda</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Importe o extrato (CSV/XLSX) da conta bancária para começar a conciliar contra os lançamentos do fluxo de caixa.
            </p>
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Importar Extrato
            </Button>
          </div>
        ) : (
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const meta = STATUS_META[e.status];
                  const Icon = meta.Icon;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs font-mono">{e.data}</TableCell>
                      <TableCell className="text-xs">{e.bank_accounts?.nome ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-[320px] truncate">{e.descricao}</TableCell>
                      <TableCell className={cn("text-xs tabular-nums text-right", e.valor < 0 ? "text-destructive" : "text-success")}>
                        {fmt(Number(e.valor))}
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", meta.className)}>
                          <Icon size={11} /> {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {e.status === "conciliado" ? (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => unreconcile.mutate(e.id)}>
                            <Unlink className="h-3 w-3 mr-1" /> Desfazer
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => openMatch({ id: e.id, descricao: e.descricao, valor: Number(e.valor) })}>
                              <Link2 className="h-3 w-3 mr-1" /> Conciliar
                            </Button>
                            {e.status !== "ignorado" && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                                onClick={() => updateStatus.mutate({ statementId: e.id, status: "ignorado" })}>
                                Ignorar
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={!!matchEntry} onOpenChange={(o) => !o && setMatchEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Conciliar com lançamento</DialogTitle></DialogHeader>
          {matchEntry && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <div className="font-medium">{matchEntry.descricao}</div>
                <div className={cn("text-xs tabular-nums", matchEntry.valor < 0 ? "text-destructive" : "text-success")}>
                  {fmt(matchEntry.valor)}
                </div>
              </div>
              {loadingCands ? (
                <div className="py-6 flex items-center justify-center text-muted-foreground gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando candidatos...
                </div>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum lançamento compatível encontrado (busca por valor ±10% e data ±7 dias).
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-auto">
                  {candidates.map((c) => (
                    <button
                      key={c.cashflow_id}
                      onClick={() => {
                        reconcile.mutate({ statementId: matchEntry.id, cashflowId: c.cashflow_id });
                        setMatchEntry(null);
                      }}
                      className="w-full text-left rounded-md border p-3 hover:bg-accent transition-colors space-y-1"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="text-sm font-medium truncate">{c.descricao}</div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{(c.score * 100).toFixed(0)}% match</Badge>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{c.data_realizada || c.data_prevista}</span>
                        <span className="tabular-nums">{fmt(Number(c.valor_realizado || c.valor_previsto))}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BankStatementImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        defaultBankAccountId={bankFilter !== "__all__" ? bankFilter : null}
      />
    </div>
  );
}
