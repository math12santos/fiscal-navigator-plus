import { useState } from "react";
import { useBankAccounts, BankAccount } from "@/hooks/useBankAccounts";
import { BankAccountFormDialog } from "./BankAccountFormDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Building2, Landmark, Trash2, DollarSign } from "lucide-react";
import { useHolding } from "@/contexts/HoldingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const tipoContaLabels: Record<string, string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  investimento: "Investimento",
  pagamento: "Pagamento",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function ContasBancariasTab() {
  const { allBankAccounts, isLoading, create, update, remove } = useBankAccounts();
  const [showCreate, setShowCreate] = useState(false);
  const { holdingMode, subsidiaryOrgs } = useHolding();
  const { currentOrg } = useOrganization();

  // Balance dialog state
  const [balanceAccount, setBalanceAccount] = useState<BankAccount | null>(null);
  const [balanceValue, setBalanceValue] = useState("");

  // Build orgId → orgName map for holding mode
  const orgNameMap: Record<string, string> = {};
  if (currentOrg) orgNameMap[currentOrg.id] = currentOrg.name;
  subsidiaryOrgs.forEach((o) => { orgNameMap[o.id] = o.name; });

  const handleSaveBalance = () => {
    if (!balanceAccount) return;
    const val = parseFloat(balanceValue.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (isNaN(val)) return;
    update.mutate({ id: balanceAccount.id, saldo_atual: val } as any);
    setBalanceAccount(null);
    setBalanceValue("");
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {allBankAccounts.length} conta(s) bancária(s) cadastrada(s)
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Conta
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Agência / Conta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Chave PIX</TableHead>
                <TableHead className="text-right">Saldo Atual</TableHead>
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
              {allBankAccounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell className="font-medium">{acc.nome}</TableCell>
                  <TableCell>{acc.banco || "—"}</TableCell>
                  <TableCell>
                    {acc.agencia && acc.conta ? `${acc.agencia} / ${acc.conta}` : acc.agencia || acc.conta || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{tipoContaLabels[acc.tipo_conta] || acc.tipo_conta}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{acc.pix_key || "—"}</TableCell>
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
                    {(acc as any).saldo_atualizado_em && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Atualizado em {format(new Date((acc as any).saldo_atualizado_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </p>
                    )}
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
              ))}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceAccount(null)}>Cancelar</Button>
            <Button onClick={handleSaveBalance} disabled={update.isPending}>Salvar Saldo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BankAccountFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSave={async (data) => { await create.mutateAsync(data); setShowCreate(false); }}
        isPending={create.isPending}
      />
    </div>
  );
}
