import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { Brain, TrendingUp, AlertTriangle, CheckCircle, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisResult {
  maturidade: number;
  nivel: string;
  pontos: { area: string; nota: number; feedback: string; tipo: "positivo" | "alerta" | "critico" }[];
  recomendacoes: string[];
}

const mockAnalysis: AnalysisResult = {
  maturidade: 68,
  nivel: "Intermediário",
  pontos: [
    { area: "Controle de Caixa", nota: 82, feedback: "Bom controle de entradas e saídas com fluxo diário monitorado.", tipo: "positivo" },
    { area: "Gestão de Contratos", nota: 65, feedback: "Contratos cadastrados mas sem automação de alertas de vencimento.", tipo: "alerta" },
    { area: "Conciliação Bancária", nota: 55, feedback: "Divergências frequentes entre ERP e extratos. Necessita revisão de processos.", tipo: "critico" },
    { area: "Planejamento Orçamentário", nota: 72, feedback: "Cenários projetados regularmente, mas sem integração com dados reais.", tipo: "positivo" },
    { area: "Custos Operacionais", nota: 58, feedback: "Custos com pessoal acima da média do setor em 12%.", tipo: "alerta" },
  ],
  recomendacoes: [
    "Automatizar alertas de vencimento de contratos para reduzir riscos de renovação passiva",
    "Implementar conciliação bancária automatizada para reduzir divergências em 80%",
    "Renegociar contratos de fornecedores com base na análise de mercado — economia estimada de R$ 180.000/ano",
    "Otimizar alocação de pessoal com base em produtividade por centro de custo",
    "Estabelecer KPIs financeiros mensais com metas claras por departamento",
  ],
};

const getScoreColor = (nota: number) => {
  if (nota >= 75) return "text-success";
  if (nota >= 60) return "text-warning";
  return "text-destructive";
};

const getScoreBg = (nota: number) => {
  if (nota >= 75) return "bg-success";
  if (nota >= 60) return "bg-warning";
  return "bg-destructive";
};

export default function IAFinanceira() {
  const [analyzed, setAnalyzed] = useState(false);
  const [loading, setLoading] = useState(false);

  const runAnalysis = () => {
    setLoading(true);
    setTimeout(() => {
      setAnalyzed(true);
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="IA Financeira" description="Análise de maturidade e recomendações inteligentes para redução de custos" />

      {!analyzed ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="rounded-full bg-primary/10 p-6 mb-6 glow-primary">
            <Brain size={48} className="text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Análise de Maturidade Financeira</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
            Nossa IA analisa seus dados financeiros para identificar o nível de maturidade da empresa e sugerir melhorias para redução de custos e despesas.
          </p>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              loading && "opacity-70 cursor-wait"
            )}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Analisando dados...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Iniciar Análise
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Maturity Score */}
          <div className="glass-card p-6 flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(222, 30%, 16%)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke="hsl(174, 72%, 50%)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${mockAnalysis.maturidade * 2.51} 251`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{mockAnalysis.maturidade}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nível de Maturidade</p>
              <p className="text-xl font-bold text-primary">{mockAnalysis.nivel}</p>
              <p className="text-sm text-muted-foreground mt-1">Baseado na análise de 5 áreas financeiras</p>
            </div>
          </div>

          {/* Areas */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Áreas Analisadas</h3>
            {mockAnalysis.pontos.map((p) => (
              <div key={p.area} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {p.tipo === "positivo" ? <CheckCircle size={16} className="text-success" /> :
                      p.tipo === "alerta" ? <AlertTriangle size={16} className="text-warning" /> :
                        <AlertTriangle size={16} className="text-destructive" />}
                    <span className="text-sm font-medium text-foreground">{p.area}</span>
                  </div>
                  <span className={cn("text-lg font-bold", getScoreColor(p.nota))}>{p.nota}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary mb-2">
                  <div className={cn("h-1.5 rounded-full transition-all", getScoreBg(p.nota))} style={{ width: `${p.nota}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{p.feedback}</p>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              Recomendações para Redução de Custos
            </h3>
            <div className="space-y-3">
              {mockAnalysis.recomendacoes.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <ChevronRight size={16} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
