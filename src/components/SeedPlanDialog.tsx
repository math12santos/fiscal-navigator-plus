import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { useLinkedTransactions } from "@/hooks/useLinkedTransactions";
import { useToast } from "@/hooks/use-toast";

interface SeedPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountsCount: number;
  costCentersCount: number;
  onSeedFresh: () => Promise<void>;
  onReplace: () => Promise<void>;
  onStartTransfer: () => void;
}

type Step = "checking" | "no-data" | "safe-replace" | "has-transactions";

export default function SeedPlanDialog({
  open,
  onOpenChange,
  accountsCount,
  costCentersCount,
  onSeedFresh,
  onReplace,
  onStartTransfer,
}: SeedPlanDialogProps) {
  const [step, setStep] = useState<Step>("checking");
  const [loading, setLoading] = useState(false);
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const { checkLinkedTransactions } = useLinkedTransactions();
  const { toast } = useToast();

  const hasExistingData = accountsCount > 0 || costCentersCount > 0;

  useEffect(() => {
    if (!open) return;
    setConfirmCheck(false);
    setConfirmText("");
    setLoading(false);

    if (!hasExistingData) {
      setStep("no-data");
    } else {
      setStep("checking");
      (async () => {
        try {
          const result = await Promise.race([
            checkLinkedTransactions(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Tempo esgotado")), 5000)
            ),
          ]);
          setStep(result.has_linked_transactions ? "has-transactions" : "safe-replace");
        } catch (e: any) {
          console.warn("Linked transactions check failed/timed out:", e.message);
          setStep("safe-replace");
        }
      })();
    }
  }, [open]);

  const handleSeedFresh = async () => {
    setLoading(true);
    try {
      await onSeedFresh();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReplace = async () => {
    setLoading(true);
    try {
      await onReplace();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const canReplace = confirmCheck && confirmText === "SUBSTITUIR";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Gerar Plano Padrão</AlertDialogTitle>
        </AlertDialogHeader>

        {step === "checking" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Verificando lançamentos vinculados...</p>
          </div>
        )}

        {step === "no-data" && (
          <>
            <AlertDialogDescription>
              Serão criadas aproximadamente 40 contas contábeis e 17 centros de custo padrão para uma empresa de Assessoria em BPO Financeiro, Contabilidade e Licitações.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button onClick={handleSeedFresh} disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando...</> : "Confirmar"}
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {step === "safe-replace" && (
          <>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <ShieldCheck className="h-5 w-5 text-success mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Nenhum lançamento encontrado</p>
                  <p className="text-muted-foreground mt-1">
                    Você possui {accountsCount > 0 && <Badge variant="outline" className="mx-1">{accountsCount} contas</Badge>}
                    {accountsCount > 0 && costCentersCount > 0 && " e "}
                    {costCentersCount > 0 && <Badge variant="outline" className="mx-1">{costCentersCount} centros de custo</Badge>}
                    cadastrados. Como não há lançamentos vinculados, é seguro substituí-los.
                  </p>
                </div>
              </div>

              <div className="border border-destructive/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Ação destrutiva</span>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="confirm-replace"
                    checked={confirmCheck}
                    onCheckedChange={(v) => setConfirmCheck(!!v)}
                  />
                  <Label htmlFor="confirm-replace" className="text-sm leading-snug cursor-pointer">
                    Entendo que isso vai apagar meu Plano de Contas e Centros de Custo atuais
                  </Label>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">
                    Digite <span className="font-mono font-bold text-foreground">SUBSTITUIR</span> para confirmar:
                  </Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="SUBSTITUIR"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleReplace}
                disabled={!canReplace || loading}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Substituindo...</> : "Substituir e gerar plano padrão"}
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {step === "has-transactions" && (
          <>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Há lançamentos vinculados</p>
                  <p className="text-muted-foreground mt-1">
                    Não é possível substituir ou excluir porque há lançamentos históricos vinculados às contas e/ou centros de custo existentes.
                  </p>
                  <p className="text-muted-foreground mt-2">
                    Para manter a análise no tempo, você deve transferir (remapear) as contas e centros antigos para o novo plano.
                  </p>
                </div>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button onClick={() => { onOpenChange(false); onStartTransfer(); }}>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Iniciar transferência (remapeamento)
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
