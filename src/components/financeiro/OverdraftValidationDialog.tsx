import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CreditCard, Wallet } from "lucide-react";
import {
  decomposeNegativeBalance,
  estimateMonthlyClosingCharge,
  getNextClosingDate,
  fmtBRL,
} from "@/lib/overdraftCalculations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName: string;
  saldoNegativo: number; // valor negativo (ex: -5000)
  limiteTotal: number;
  taxaJurosMensalPct: number;
  /** chamado quando confirmado, com a separação informada */
  onConfirm: (params: {
    usoLimite: number;
    provisao: number;
  }) => void;
}

/**
 * Diálogo apresentado quando o usuário lança saldo negativo em conta de
 * cheque especial. Permite separar o quanto é uso efetivo da linha de
 * crédito (sujeito a juros) e o quanto é apenas provisão de pagamentos
 * já lançados (não consome limite).
 */
export function OverdraftValidationDialog({
  open,
  onOpenChange,
  accountName,
  saldoNegativo,
  limiteTotal,
  taxaJurosMensalPct,
  onConfirm,
}: Props) {
  const negativoAbs = Math.abs(saldoNegativo);
  const [provisao, setProvisao] = useState("0");

  // Reset provisão quando o saldo muda
  useEffect(() => {
    if (open) setProvisao("0");
  }, [open, saldoNegativo]);

  const provisaoNum = Math.max(0, Math.min(negativoAbs, Number(provisao) || 0));
  const { usoLimite } = decomposeNegativeBalance(saldoNegativo, provisaoNum);

  const excedeLimite = usoLimite > limiteTotal && limiteTotal > 0;
  const proximoFechamento = getNextClosingDate();
  const cobrancaEstimada = estimateMonthlyClosingCharge(usoLimite, taxaJurosMensalPct, 30);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Validar Saldo Negativo — {accountName}</DialogTitle>
          <DialogDescription>
            Esta conta usa <strong>cheque especial</strong>. Antes de gravar, valide
            quanto deste saldo negativo é uso efetivo do limite (gera juros) e quanto
            é apenas provisionamento de pagamentos já lançados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Saldo negativo informado:</span>
              <span className="font-mono font-semibold text-destructive">
                {fmtBRL(saldoNegativo)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              Quanto é provisão de pagamentos já lançados?
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={negativoAbs}
              value={provisao}
              onChange={(e) => setProvisao(e.target.value)}
              placeholder="0,00"
            />
            <p className="text-[11px] text-muted-foreground">
              Compromissos contábeis já registrados que ainda não saíram do banco.
              Este valor <strong>não consome o limite</strong> e <strong>não gera juros</strong>.
            </p>
          </div>

          <div className="bg-muted/40 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Uso efetivo do cheque especial:
              </span>
              <span className="font-mono font-semibold text-warning">
                {fmtBRL(usoLimite)}
              </span>
            </div>
            {limiteTotal > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">% do limite consumido:</span>
                <span className="font-mono">
                  {((usoLimite / limiteTotal) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {taxaJurosMensalPct > 0 && usoLimite > 0 && (
              <div className="border-t pt-2 mt-2 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Juros estimados (mês cheio @ {taxaJurosMensalPct}% a.m.):</span>
                  <span className="font-mono text-warning">{fmtBRL(cobrancaEstimada)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Próximo fechamento:</span>
                  <span className="font-mono">
                    {format(proximoFechamento, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground italic pt-1">
                  Juros calculados diariamente e debitados no 1º dia do mês subsequente.
                </p>
              </div>
            )}
          </div>

          {excedeLimite && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                O uso de limite ({fmtBRL(usoLimite)}) excede o limite total aprovado
                ({fmtBRL(limiteTotal)}). Verifique o valor informado ou aumente o limite.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm({ usoLimite, provisao: provisaoNum })}
            disabled={excedeLimite}
          >
            Confirmar Saldo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
