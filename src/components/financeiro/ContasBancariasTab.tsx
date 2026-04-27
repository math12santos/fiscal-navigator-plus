import { useState } from "react";
import { useBankAccounts, BankAccount } from "@/hooks/useBankAccounts";
import { BankAccountFormDialog } from "./BankAccountFormDialog";
import { OverdraftValidationDialog } from "./OverdraftValidationDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Building2, Landmark, Trash2, DollarSign, CreditCard, TrendingUp, Info, KeyRound, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHolding } from "@/contexts/HoldingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  calculateAvailability,
  estimateMonthlyClosingCharge,
  getNextClosingDate,
} from "@/lib/overdraftCalculations";

const tipoContaLabels: Record<string, string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  investimento: "Investimento",
  pagamento: "Pagamento",
};

const tipoLimiteLabels: Record<string, string> = {
  cheque_especial: "Cheque Especial",
  capital_giro: "Capital de Giro",
  conta_garantida: "Conta Garantida",
  antecipacao_recebiveis: "Antec. Recebíveis",
  outros: "Outros",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function ContasBancariasTab() {
  const { allBankAccounts, isLoading, create, update, remove } = useBankAccounts();
  const [showCreate, setShowCreate] = useState(false);
  const { holdingMode, subsidiaryOrgs } = useHolding();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();

  // PIX dialog state
  const [pixAccount, setPixAccount] = useState<BankAccount | null>(null);
  const [pixValue, setPixValue] = useState("");

  // Balance dialog state
  const [balanceAccount, setBalanceAccount] = useState<BankAccount | null>(null);
  const [balanceValue, setBalanceValue] = useState("");

  // Overdraft validation dialog state (for cheque especial with negative balance)
  const [overdraftValidation, setOverdraftValidation] = useState<{
    account: BankAccount;
    saldoNegativo: number;
  } | null>(null);

  // Limite dialog state
  const [limitAccount, setLimitAccount] = useState<BankAccount | null>(null);
  const [limitForm, setLimitForm] = useState({
    limite_tipo: "cheque_especial",
    limite_credito: "",
    limite_utilizado: "",
    limite_taxa_juros_mensal: "",
    limite_vencimento: "",
  });

  // Build orgId → orgName map for holding mode
  const orgNameMap: Record<string, string> = {};
  if (currentOrg) orgNameMap[currentOrg.id] = currentOrg.name;
  subsidiaryOrgs.forEach((o) => { orgNameMap[o.id] = o.name; });

  const handleSaveBalance = () => {
    if (!balanceAccount) return;
    const val = parseFloat(balanceValue.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (isNaN(val)) return;

    // Se conta de cheque especial e saldo negativo: abrir validação de uso de limite
    const isOverdraft = (balanceAccount.limite_tipo || "cheque_especial") === "cheque_especial";
    if (isOverdraft && val < 0 && (balanceAccount.limite_credito || 0) > 0) {
      setOverdraftValidation({ account: balanceAccount, saldoNegativo: val });
      return;
    }

    update.mutate({ id: balanceAccount.id, saldo_atual: val } as any);
    setBalanceAccount(null);
    setBalanceValue("");
  };

  const handleConfirmOverdraft = ({ usoLimite }: { usoLimite: number; provisao: number }) => {
    if (!overdraftValidation) return;
    const { account, saldoNegativo } = overdraftValidation;
    update.mutate({
      id: account.id,
      saldo_atual: saldoNegativo,
      limite_utilizado: usoLimite,
      saldo_atualizado_em: new Date().toISOString(),
      limite_atualizado_em: new Date().toISOString(),
    } as any);
    setOverdraftValidation(null);
    setBalanceAccount(null);
    setBalanceValue("");
  };

  const openLimitDialog = (acc: BankAccount) => {
    setLimitAccount(acc);
    setLimitForm({
      limite_tipo: acc.limite_tipo || "cheque_especial",
      limite_credito: String(acc.limite_credito ?? 0),
      limite_utilizado: String(acc.limite_utilizado ?? 0),
      limite_taxa_juros_mensal: String(acc.limite_taxa_juros_mensal ?? 0),
      limite_vencimento: acc.limite_vencimento || "",
    });
  };

  const handleSaveLimit = () => {
    if (!limitAccount) return;
    update.mutate({
      id: limitAccount.id,
      limite_tipo: limitForm.limite_tipo,
      limite_credito: Number(limitForm.limite_credito) || 0,
      limite_utilizado: Number(limitForm.limite_utilizado) || 0,
      limite_taxa_juros_mensal: Number(limitForm.limite_taxa_juros_mensal) || 0,
      limite_vencimento: limitForm.limite_vencimento || null,
      limite_atualizado_em: new Date().toISOString(),
    } as any);
    setLimitAccount(null);
  };

  // Totais consolidados — usa lógica diferenciada para cheque especial
  const totals = allBankAccounts.reduce(
    (acc, b) => {
      const saldo = b.saldo_atual || 0;
      const tipo = (b.limite_tipo || "cheque_especial") as any;
      const av = calculateAvailability({
        saldoAtual: saldo,
        limiteTotal: b.limite_credito || 0,
        limiteUtilizado: b.limite_utilizado || 0,
        limiteTipo: tipo,
      });
      acc.saldo += saldo;
      acc.limiteTotal += b.limite_credito || 0;
      acc.limiteUsado += av.usoLimiteAtual;
      acc.limiteDisp += av.limiteDisponivel;
      acc.disponivel += av.capitalGiroDisponivel;
      // Estimativa de juros do mês (cheque especial)
      if (tipo === "cheque_especial" && av.usoLimiteAtual > 0) {
        acc.jurosEstimado += estimateMonthlyClosingCharge(
          av.usoLimiteAtual,
          b.limite_taxa_juros_mensal || 0,
          30
        );
      }
      return acc;
    },
    { saldo: 0, limiteTotal: 0, limiteUsado: 0, limiteDisp: 0, disponivel: 0, jurosEstimado: 0 }
  );

  const proximoFechamento = getNextClosingDate();

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* KPIs de capital de giro */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <DollarSign className="h-3.5 w-3.5" /> Saldo em Caixa
            </div>
            <p className={`text-lg font-semibold mt-1 ${totals.saldo < 0 ? "text-destructive" : ""}`}>
              {fmt(totals.saldo)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <CreditCard className="h-3.5 w-3.5" /> Limite Disponível
            </div>
            <p className="text-lg font-semibold mt-1">{fmt(totals.limiteDisp)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              de {fmt(totals.limiteTotal)} aprovado
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <CreditCard className="h-3.5 w-3.5" /> Limite Utilizado
              {totals.jurosEstimado > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-warning cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Juros estimados do mês corrente:{" "}
                        <strong className="text-warning">{fmt(totals.jurosEstimado)}</strong>
                        <br />
                        Fechamento em {format(proximoFechamento, "dd/MM/yyyy", { locale: ptBR })}.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className={`text-lg font-semibold mt-1 ${totals.limiteUsado > 0 ? "text-warning" : ""}`}>
              {fmt(totals.limiteUsado)}
            </p>
            {totals.limiteTotal > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {((totals.limiteUsado / totals.limiteTotal) * 100).toFixed(1)}% do limite
                {totals.jurosEstimado > 0 && (
                  <span className="text-warning"> · ~{fmt(totals.jurosEstimado)} juros/mês</span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-primary/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-primary text-xs font-medium">
              <TrendingUp className="h-3.5 w-3.5" /> Capital de Giro Disponível
            </div>
            <p className={`text-lg font-bold mt-1 ${totals.disponivel < 0 ? "text-destructive" : "text-primary"}`}>
              {fmt(totals.disponivel)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Saldo + Limite Disponível
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {allBankAccounts.length} conta(s) bancária(s) cadastrada(s)
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Conta
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Saldo Atual</TableHead>
                <TableHead className="text-right">Limite</TableHead>
                <TableHead className="text-right">Disponível</TableHead>
                {holdingMode && <TableHead>Empresa</TableHead>}
                <TableHead className="text-center">Ativa</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allBankAccounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={holdingMode ? 9 : 8} className="text-center text-muted-foreground py-8">
                    <Landmark className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Nenhuma conta bancária cadastrada
                  </TableCell>
                </TableRow>
              )}
              {allBankAccounts.map((acc) => {
                const limTotal = acc.limite_credito || 0;
                const tipoLim = (acc.limite_tipo || "cheque_especial") as any;
                const av = calculateAvailability({
                  saldoAtual: acc.saldo_atual || 0,
                  limiteTotal: limTotal,
                  limiteUtilizado: acc.limite_utilizado || 0,
                  limiteTipo: tipoLim,
                });
                const limUsado = av.usoLimiteAtual;
                const limDisp = av.limiteDisponivel;
                const disponivel = av.capitalGiroDisponivel;
                const usoPct = limTotal > 0 ? (limUsado / limTotal) * 100 : 0;
                const isOverdraft = tipoLim === "cheque_especial";
                const jurosMes = isOverdraft && limUsado > 0
                  ? estimateMonthlyClosingCharge(limUsado, acc.limite_taxa_juros_mensal || 0, 30)
                  : 0;

                return (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">
                      <div>{acc.nome}</div>
                      {(acc.agencia || acc.conta) && (
                        <div className="text-[10px] text-muted-foreground">
                          {acc.agencia} {acc.conta && `/ ${acc.conta}`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{acc.banco || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {tipoContaLabels[acc.tipo_conta] || acc.tipo_conta}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className={`font-mono text-sm ${acc.saldo_atual < 0 ? "text-destructive" : "text-foreground"}`}>
                          {fmt(acc.saldo_atual)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Inserir saldo manualmente"
                          onClick={() => {
                            setBalanceAccount(acc);
                            setBalanceValue(String(acc.saldo_atual));
                          }}
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {acc.saldo_atualizado_em && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(acc.saldo_atualizado_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="text-right">
                          <div className="font-mono text-sm">{fmt(limDisp)}</div>
                          {limTotal > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              {tipoLimiteLabels[acc.limite_tipo || "cheque_especial"]} • {usoPct.toFixed(0)}% usado
                            </div>
                          )}
                          {jurosMes > 0 && (
                            <div className="text-[10px] text-warning">
                              ~{fmt(jurosMes)}/mês juros
                            </div>
                          )}
                          {limTotal === 0 && (
                            <div className="text-[10px] text-muted-foreground">sem limite</div>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Configurar limite de crédito"
                          onClick={() => openLimitDialog(acc)}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono text-sm font-semibold ${disponivel < 0 ? "text-destructive" : "text-primary"}`}>
                        {fmt(disponivel)}
                      </span>
                    </TableCell>
                    {holdingMode && (
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          <Building2 className="h-3 w-3 mr-1" />
                          {orgNameMap[acc.organization_id ?? ""] || acc.organization_id?.slice(0, 8) || "—"}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <Switch
                        checked={acc.active}
                        onCheckedChange={(checked) => update.mutate({ id: acc.id, active: checked } as any)}
                      />
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover conta bancária?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A conta "{acc.nome}" será removida permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove.mutate(acc.id)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Balance dialog */}
      <Dialog open={!!balanceAccount} onOpenChange={(open) => { if (!open) setBalanceAccount(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inserir Saldo — {balanceAccount?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Saldo Atual (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={balanceValue}
              onChange={(e) => setBalanceValue(e.target.value)}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              Este saldo será a verdade absoluta para disponibilidade de caixa no Aging List e referência para conciliações futuras.
            </p>
            {balanceAccount &&
              (balanceAccount.limite_tipo || "cheque_especial") === "cheque_especial" &&
              (balanceAccount.limite_credito || 0) > 0 &&
              parseFloat(balanceValue.replace(",", ".") || "0") < 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Saldo negativo + cheque especial: ao salvar, você poderá separar
                    o valor entre <strong>uso de limite</strong> (gera juros) e
                    <strong> provisão de pagamentos</strong> (não gera juros).
                  </AlertDescription>
                </Alert>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceAccount(null)}>Cancelar</Button>
            <Button onClick={handleSaveBalance} disabled={update.isPending}>Salvar Saldo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Limite dialog */}
      <Dialog open={!!limitAccount} onOpenChange={(open) => { if (!open) setLimitAccount(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Limite de Crédito — {limitAccount?.nome}</DialogTitle>
            <DialogDescription>
              Configure a linha de crédito desta conta. O limite disponível compõe o capital de giro e aparece nas projeções de caixa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de Limite</Label>
                <Select
                  value={limitForm.limite_tipo}
                  onValueChange={(v) => setLimitForm((p) => ({ ...p, limite_tipo: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cheque_especial">Cheque Especial</SelectItem>
                    <SelectItem value="capital_giro">Capital de Giro</SelectItem>
                    <SelectItem value="conta_garantida">Conta Garantida</SelectItem>
                    <SelectItem value="antecipacao_recebiveis">Antecipação de Recebíveis</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taxa de Juros (% a.m.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={limitForm.limite_taxa_juros_mensal}
                  onChange={(e) => setLimitForm((p) => ({ ...p, limite_taxa_juros_mensal: e.target.value }))}
                  placeholder="Ex: 8,00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Limite Total Aprovado</Label>
                <Input
                  type="number"
                  value={limitForm.limite_credito}
                  onChange={(e) => setLimitForm((p) => ({ ...p, limite_credito: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Limite Utilizado</Label>
                <Input
                  type="number"
                  value={limitForm.limite_utilizado}
                  onChange={(e) => setLimitForm((p) => ({ ...p, limite_utilizado: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>
            {limitForm.limite_tipo !== "cheque_especial" && (
              <div className="space-y-2">
                <Label>Vencimento / Renovação do Contrato</Label>
                <Input
                  type="date"
                  value={limitForm.limite_vencimento}
                  onChange={(e) => setLimitForm((p) => ({ ...p, limite_vencimento: e.target.value }))}
                />
              </div>
            )}
            {limitForm.limite_tipo === "cheque_especial" && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Cheque especial não possui vencimento. Os juros são calculados
                  diariamente sobre o saldo devedor e debitados no <strong>1º dia
                  do mês subsequente</strong>. O uso do limite é detectado
                  automaticamente pelo saldo negativo da conta.
                </AlertDescription>
              </Alert>
            )}
            {Number(limitForm.limite_credito) > 0 && (
              <div className="bg-muted/50 rounded-md p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disponível desta linha:</span>
                  <span className="font-mono font-semibold">
                    {fmt(Math.max(0, Number(limitForm.limite_credito) - Number(limitForm.limite_utilizado || 0)))}
                  </span>
                </div>
                {Number(limitForm.limite_taxa_juros_mensal) > 0 && Number(limitForm.limite_utilizado) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {limitForm.limite_tipo === "cheque_especial"
                        ? "Juros estimados (mês cheio):"
                        : "Custo mensal estimado:"}
                    </span>
                    <span className="font-mono text-warning">
                      {fmt(
                        limitForm.limite_tipo === "cheque_especial"
                          ? estimateMonthlyClosingCharge(
                              Number(limitForm.limite_utilizado),
                              Number(limitForm.limite_taxa_juros_mensal),
                              30
                            )
                          : Number(limitForm.limite_utilizado) * (Number(limitForm.limite_taxa_juros_mensal) / 100)
                      )}
                    </span>
                  </div>
                )}
                {limitForm.limite_tipo === "cheque_especial" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Próximo fechamento:</span>
                    <span className="font-mono">
                      {format(getNextClosingDate(), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitAccount(null)}>Cancelar</Button>
            <Button onClick={handleSaveLimit} disabled={update.isPending}>Salvar Limite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overdraft validation dialog (cheque especial) */}
      {overdraftValidation && (
        <OverdraftValidationDialog
          open={!!overdraftValidation}
          onOpenChange={(open) => { if (!open) setOverdraftValidation(null); }}
          accountName={overdraftValidation.account.nome}
          saldoNegativo={overdraftValidation.saldoNegativo}
          limiteTotal={overdraftValidation.account.limite_credito || 0}
          taxaJurosMensalPct={overdraftValidation.account.limite_taxa_juros_mensal || 0}
          onConfirm={handleConfirmOverdraft}
        />
      )}

      <BankAccountFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSave={async (data) => { await create.mutateAsync(data); setShowCreate(false); }}
        isPending={create.isPending}
      />
    </div>
  );
}
