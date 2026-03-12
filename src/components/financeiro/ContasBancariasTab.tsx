import { useState } from "react";
import { useBankAccounts, BankAccount } from "@/hooks/useBankAccounts";
import { BankAccountFormDialog } from "./BankAccountFormDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Building2, Landmark, Trash2 } from "lucide-react";
import { useHolding } from "@/contexts/HoldingContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const tipoContaLabels: Record<string, string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  investimento: "Investimento",
  pagamento: "Pagamento",
};

export function ContasBancariasTab() {
  const { allBankAccounts, isLoading, create, update, remove } = useBankAccounts();
  const [showCreate, setShowCreate] = useState(false);
  const { holdingMode } = useHolding();

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
                {holdingMode && <TableHead>Empresa</TableHead>}
                <TableHead className="text-center">Ativa</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allBankAccounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={holdingMode ? 8 : 7} className="text-center text-muted-foreground py-8">
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
                  {holdingMode && (
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" />
                        {(acc as any).organization_id?.slice(0, 8) ?? "—"}
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

      <BankAccountFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSave={async (data) => { await create.mutateAsync(data); setShowCreate(false); }}
        isPending={create.isPending}
      />
    </div>
  );
}
