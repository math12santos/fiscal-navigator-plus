import { useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useOnboardingConfig } from "@/hooks/useOnboardingConfig";
import { OnboardingProgressBar } from "@/components/onboarding-guiado/OnboardingProgressBar";
import { Step1Diagnostico } from "@/components/onboarding-guiado/Step1Diagnostico";
import { Step2Estrutura } from "@/components/onboarding-guiado/Step2Estrutura";
import { Step3Integracoes } from "@/components/onboarding-guiado/Step3Integracoes";
import { Step4EstruturaFinanceira } from "@/components/onboarding-guiado/Step4EstruturaFinanceira";
import { Step5Contratos } from "@/components/onboarding-guiado/Step5Contratos";
import { Step6Planejamento } from "@/components/onboarding-guiado/Step6Planejamento";
import { Step7Rotinas } from "@/components/onboarding-guiado/Step7Rotinas";
import { Step10Score } from "@/components/onboarding-guiado/Step10Score";
import { StepShell } from "@/components/onboarding-guiado/StepShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, SkipForward, CheckCircle2, Loader2 } from "lucide-react";
import {
  Building2, Plug, Wallet, FileText, Target, CalendarCheck, LayoutDashboard, Lightbulb,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { type LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Building2, Plug, Wallet, FileText, Target, CalendarCheck, LayoutDashboard, Lightbulb,
};

const FALLBACK_SHELL_STEPS: Record<number, { title: string; description: string; icon: string; items: string[] }> = {
  2: { title: "Estrutura da Empresa", description: "Configure a estrutura organizacional do grupo", icon: "Building2", items: ["Empresas do grupo (holding, operacionais, filiais)", "Usuários principais (CEO, CFO, Controller)", "Áreas organizacionais (Financeiro, Comercial, Operações)"] },
  3: { title: "Integrações", description: "Conecte fontes de dados ao sistema", icon: "Plug", items: ["Bancos (Open Banking, OFX, CSV)", "ERPs (Conta Azul, Omie, Bling, TOTVS)", "Importação manual de planilhas"] },
  4: { title: "Estrutura Financeira", description: "Configure plano de contas e centros de custo", icon: "Wallet", items: ["Plano de contas gerencial padrão", "Centros de custo sugeridos", "Personalização e criação livre"] },
  5: { title: "Cadastro de Contratos", description: "Registre contratos que impactam o fluxo de caixa", icon: "FileText", items: ["Contratos de receita (clientes, recorrentes, projetos)", "Contratos de despesa (fornecedores, softwares, serviços)", "Investimentos (compra e venda de ativos)"] },
  6: { title: "Planejamento Financeiro", description: "Configure orçamento e cenários", icon: "Target", items: ["Orçamento anual", "Cenários (Base, Conservador, Expansão)", "Projeções (12, 24, 36 meses)"] },
  7: { title: "Rotinas Financeiras", description: "Configure rotinas sugeridas para o dia a dia", icon: "CalendarCheck", items: ["Diárias: conciliação bancária, atualização de saldo", "Semanais: revisão de fluxo de caixa, análise de recebimentos", "Mensais: fechamento financeiro, DRE gerencial"] },
  8: { title: "Ativação do Cockpit", description: "Libere os dashboards financeiros", icon: "LayoutDashboard", items: ["Dashboard CFO (caixa, runway, MRR, margem, burn rate)", "Dashboard Board (saúde financeira, projeção, riscos)"] },
  9: { title: "Operação Assistida", description: "Recomendações automáticas nos primeiros 90 dias", icon: "Lightbulb", items: ["Alertas de dados faltantes", "Sugestões de melhoria de classificação", "Acompanhamento de preenchimento"] },
};

export default function OnboardingGuiado() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { progress, loading, initProgress, updateStepData, completeStep, goToStep, saveProgress } =
    useOnboardingProgress();
  const { getStepConfig, isLoading: configLoading } = useOnboardingConfig();

  useEffect(() => {
    if (!loading && !progress && user && currentOrg) {
      initProgress();
    }
  }, [loading, progress, user, currentOrg]);

  const currentStep = progress?.current_step ?? 1;
  const completedSteps = progress?.completed_steps ?? [];

  const shellStepData = useMemo(() => {
    if (currentStep < 2 || currentStep > 9) return null;
    const dbConfig = getStepConfig(currentStep);
    const fallback = FALLBACK_SHELL_STEPS[currentStep];
    const config = dbConfig || fallback;
    if (!config) return null;
    const iconName = config.icon || fallback?.icon || "FileText";
    return {
      title: config.title || fallback?.title || "",
      description: config.description || fallback?.description || "",
      icon: ICON_MAP[iconName] || FileText,
      items: config.items || fallback?.items || [],
    };
  }, [currentStep, getStepConfig]);

  const handleNext = useCallback(async () => {
    await completeStep(currentStep);
    if (currentStep < 10) await goToStep(currentStep + 1);
  }, [currentStep, completeStep, goToStep]);

  const handlePrev = useCallback(async () => {
    if (currentStep > 1) await goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const handleSkip = useCallback(async () => {
    if (currentStep < 10) await goToStep(currentStep + 1);
  }, [currentStep, goToStep]);

  const handleFinish = useCallback(async () => {
    toast({ title: "Onboarding concluído!", description: "Seu cockpit financeiro está pronto." });
    navigate("/");
  }, [navigate]);

  const getStepData = (step: number) => {
    if (!progress) return {};
    const keys: Record<number, string> = {
      1: "diagnosis_answers", 2: "structure_data", 3: "integrations_data",
      4: "financial_structure_data", 5: "contracts_data", 6: "planning_data",
      7: "routines_data", 10: "score_dimensions",
    };
    return (progress as any)[keys[step]] || {};
  };

  if (loading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Onboarding Guiado</h1>
            <p className="text-muted-foreground mt-1">{currentOrg?.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>Continuar depois</Button>
        </div>

        <OnboardingProgressBar currentStep={currentStep} completedSteps={completedSteps} onStepClick={goToStep} />

        <div className="min-h-[400px]">
          {currentStep === 1 && (
            <Step1Diagnostico
              data={getStepData(1)}
              onChange={(d) => {
                updateStepData(1, d);
                if (d.maturity_level) saveProgress({ maturity_level: d.maturity_level });
              }}
            />
          )}
          {currentStep === 10 && (
            <Step10Score data={getStepData(10)} completedSteps={completedSteps} onChange={(d) => updateStepData(10, d)} />
          )}
          {currentStep === 2 && (
            <Step2Estrutura
              data={getStepData(2)}
              onChange={(d) => updateStepData(2, d)}
            />
          )}
          {currentStep === 3 && (
            <Step3Integracoes
              data={getStepData(3)}
              onChange={(d) => updateStepData(3, d)}
            />
          )}
          {currentStep === 4 && (
            <Step4EstruturaFinanceira
              data={getStepData(4)}
              onChange={(d) => updateStepData(4, d)}
            />
          )}
          {currentStep >= 5 && currentStep <= 9 && shellStepData && (
            <StepShell {...shellStepData} />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-6">
          <Button variant="outline" onClick={handlePrev} disabled={currentStep === 1}>
            <ArrowLeft size={16} className="mr-1" /> Anterior
          </Button>
          <div className="flex items-center gap-2">
            {currentStep < 10 && (
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                <SkipForward size={14} className="mr-1" /> Pular
              </Button>
            )}
            {currentStep < 10 ? (
              <Button onClick={handleNext}>Próximo <ArrowRight size={16} className="ml-1" /></Button>
            ) : (
              <Button onClick={handleFinish} className="gap-2"><CheckCircle2 size={16} /> Concluir Onboarding</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
