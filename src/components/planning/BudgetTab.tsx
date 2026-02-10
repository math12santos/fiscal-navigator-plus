import { useState, useMemo } from "react";
import { format, addMonths, startOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useBudget, BudgetLine } from "@/hooks/useBudget";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useCostCenters } from "@/hooks/useCostCenters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, Trash2, FileText } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

interface Props {
  startDate: Date;
  endDate: Date;
  selectedVersionId: string | null;
  onSelectVersion: (id: string | null) => void;
}

export default function BudgetTab({ startDate, endDate, selectedVersionId, onSelectVersion }: Props) {
  const { versions, isLoadingVersions, linesQuery, createVersion, deleteVersion, createLine, deleteLine } = useBudget();
  const { accounts } = useChartOfAccounts();
  const { costCenters } = useCostCenters();

  const [showNewVersion, setShowNewVersion] = useState(false);
  const [showNewLine, setShowNewLine] = useState(false);
  const [versionForm, setVersionForm] = useState({ name: "", description: "" });
  const [lineForm, setLineForm] = useState({
    account_id: "",
    cost_center_id: "",
    month: format(startDate, "yyyy-MM-dd"),
    tipo: "despesa",
    natureza: "fixo",
    valor_orcado: 0,
  });

  const budgetLinesData = selectedVersionId ? linesQuery(selectedVersionId) : null;
  const lines = (budgetLinesData?.data ?? []) as BudgetLine[];

  const analyticalAccounts = useMemo(
    () => accounts.filter((a) => !a.is_synthetic && a.active),
    [accounts]
  );

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const ccMap = useMemo(() => new Map(costCenters.map((c) => [c.id, c])), [costCenters]);

  // Generate months in range
  const months = useMemo(() => {
    const result: Date[] = [];
    let cursor = startOfMonth(startDate);
    while (!isAfter(cursor, endDate)) {
      result.push(cursor);
      cursor = addMonths(cursor, 1);
    }
    return result;
  }, [startDate, endDate]);

  const totalOrcado = lines.reduce((s, l) => s + Number(l.valor_orcado), 0);

  const handleCreateVersion = async () => {
    const result = await createVersion.mutateAsync({
      name: versionForm.name,
      description: versionForm.description || null,
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
      status: "draft",
    });
    onSelectVersion(result.id);
    setShowNewVersion(false);
    setVersionForm({ name: "", description: "" });
  };

  const handleCreateLine = async () => {
    if (!selectedVersionId) return;
    await createLine.mutateAsync({
      budget_version_id: selectedVersionId,
      account_id: lineForm.account_id || null,
      cost_center_id: lineForm.cost_center_id || null,
      month: lineForm.month,
      tipo: lineForm.tipo,
      natureza: lineForm.natureza,
      valor_orcado: lineForm.valor_orcado,
      notes: null,
    });
    setShowNewLine(false);
    setLineForm({ account_id: "", cost_center_id: "", month: format(startDate, "yyyy-MM-dd"), tipo: "despesa", natureza: "fixo", valor_orcado: 0 });
  };

  const statusLabel: Record<string, string> = {
    draft: "Rascunho",
    approved: "Aprovado",
    archived: "Arquivado",
  };

  return (
    <div className="space-y-6">
      {/* Version selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedVersionId ?? ""} onValueChange={(v) => onSelectVersion(v || null)}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Selecione uma versão de orçamento" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name} <span className="text-xs text-muted-foreground ml-1">({statusLabel[v.status] ?? v.status})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setShowNewVersion(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Versão
        </Button>
        {selectedVersionId && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              deleteVersion.mutate(selectedVersionId);
              onSelectVersion(null);
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
        )}
      </div>

      {/* Budget lines */}
      {selectedVersionId ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                Total Orçado: {fmt(totalOrcado)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {lines.length} linhas
              </Badge>
            </div>
            <Button size="sm" onClick={() => setShowNewLine(true)}>
              <Plus className="h-4 w-4 mr-1" /> Linha
            </Button>
          </div>

          {budgetLinesData?.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : lines.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma linha de orçamento. Adicione linhas para cada conta/mês.</p>
            </div>
          ) : (
            <div className="glass-card overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Natureza</TableHead>
                    <TableHead className="text-right">Valor Orçado</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm">
                        {format(new Date(line.month), "MMM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">{accountMap.get(line.account_id ?? "")?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{ccMap.get(line.cost_center_id ?? "")?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{line.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">{line.natureza}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(line.valor_orcado))}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteLine.mutate(line.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {versions.length === 0
              ? "Crie sua primeira versão de orçamento para começar."
              : "Selecione uma versão para ver e editar o orçamento."}
          </p>
        </div>
      )}

      {/* New Version Dialog */}
      <Dialog open={showNewVersion} onOpenChange={setShowNewVersion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Versão de Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={versionForm.name} onChange={(e) => setVersionForm({ ...versionForm, name: e.target.value })} placeholder="Ex: Orçamento 2026" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={versionForm.description} onChange={(e) => setVersionForm({ ...versionForm, description: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Período: {format(startDate, "dd/MM/yyyy")} a {format(endDate, "dd/MM/yyyy")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewVersion(false)}>Cancelar</Button>
            <Button onClick={handleCreateVersion} disabled={!versionForm.name || createVersion.isPending}>
              {createVersion.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Line Dialog */}
      <Dialog open={showNewLine} onOpenChange={setShowNewLine}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Linha de Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={lineForm.month} onValueChange={(v) => setLineForm({ ...lineForm, month: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={format(m, "yyyy-MM-dd")} value={format(m, "yyyy-MM-dd")}>
                      {format(m, "MMMM yyyy", { locale: ptBR })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={lineForm.account_id} onValueChange={(v) => setLineForm({ ...lineForm, account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {analyticalAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Select value={lineForm.cost_center_id} onValueChange={(v) => setLineForm({ ...lineForm, cost_center_id: v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {costCenters.filter((c) => c.active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={lineForm.tipo} onValueChange={(v) => setLineForm({ ...lineForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="custo">Custo</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Natureza</Label>
                <Select value={lineForm.natureza} onValueChange={(v) => setLineForm({ ...lineForm, natureza: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Fixo</SelectItem>
                    <SelectItem value="variavel">Variável</SelectItem>
                    <SelectItem value="hibrido">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor Orçado (R$)</Label>
              <Input type="number" value={lineForm.valor_orcado} onChange={(e) => setLineForm({ ...lineForm, valor_orcado: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewLine(false)}>Cancelar</Button>
            <Button onClick={handleCreateLine} disabled={createLine.isPending}>
              {createLine.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
