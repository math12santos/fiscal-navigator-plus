import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";

interface TransferWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Gerar novo plano",
  2: "Mapear contas",
  3: "Mapear centros de custo",
  4: "Executar transferência",
  5: "Finalização",
};

export default function TransferWizard({ open, onOpenChange, onComplete }: TransferWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const { toast } = useToast();

  const handleClose = () => {
    setCurrentStep(1);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transferência de Plano de Contas</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
          {([1, 2, 3, 4, 5] as WizardStep[]).map((step) => (
            <div key={step} className="flex items-center gap-1">
              <Badge
                variant={currentStep === step ? "default" : currentStep > step ? "secondary" : "outline"}
                className="whitespace-nowrap text-xs"
              >
                {currentStep > step ? (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                ) : null}
                {step}. {STEP_LABELS[step]}
              </Badge>
              {step < 5 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[200px]">
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nesta etapa, um novo plano de contas e centros de custo padrão serão criados <strong>em paralelo</strong> aos existentes.
                Nenhum registro antigo será removido ou alterado.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p>Serão criados:</p>
                <ul className="list-disc ml-4 mt-2 space-y-1">
                  <li>~40 contas contábeis padrão</li>
                  <li>~17 centros de custo padrão</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Este recurso estará disponível quando houver tabelas financeiras com lançamentos vinculados. 
                No momento, use a opção "Substituir" no diálogo principal.
              </p>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Mapeie cada conta antiga (com lançamentos) para uma conta do novo plano.
              </p>
              <div className="bg-muted/50 rounded-lg p-8 text-center text-sm text-muted-foreground">
                <p>Nenhuma conta com lançamentos encontrada.</p>
                <p className="text-xs mt-1">Este mapeamento será habilitado quando houver tabelas financeiras referenciando as contas.</p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Mapeie cada centro de custo antigo (com lançamentos) para um centro do novo plano.
              </p>
              <div className="bg-muted/50 rounded-lg p-8 text-center text-sm text-muted-foreground">
                <p>Nenhum centro de custo com lançamentos encontrado.</p>
                <p className="text-xs mt-1">Este mapeamento será habilitado quando houver tabelas financeiras referenciando os centros de custo.</p>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Revise os mapeamentos e execute a transferência.
              </p>
              <div className="bg-muted/50 rounded-lg p-8 text-center text-sm text-muted-foreground">
                <p>Nenhuma transferência necessária no momento.</p>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="h-12 w-12 text-success" />
                <p className="text-sm font-medium">Transferência concluída</p>
                <p className="text-xs text-muted-foreground text-center">
                  As contas e centros de custo antigos foram inativados.
                  Os lançamentos históricos agora apontam para o novo plano.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {currentStep === 5 ? "Fechar" : "Cancelar"}
          </Button>
          {currentStep < 5 && (
            <Button
              onClick={() => {
                if (currentStep === 4) {
                  // In the future, execute the actual transfer here
                  setCurrentStep(5);
                  toast({ title: "Wizard de transferência concluído (placeholder)" });
                } else {
                  setCurrentStep((currentStep + 1) as WizardStep);
                }
              }}
            >
              {currentStep === 4 ? "Executar transferência" : "Próximo"}
            </Button>
          )}
          {currentStep === 5 && (
            <Button onClick={() => { onComplete(); handleClose(); }}>
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
