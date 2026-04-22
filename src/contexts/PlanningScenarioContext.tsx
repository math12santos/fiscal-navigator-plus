import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { usePlanningScenarios, PlanningScenario } from "@/hooks/usePlanningScenarios";
import { useLiabilities } from "@/hooks/useLiabilities";

/**
 * Shared scenario state for the Planning module.
 * Allows Budget and Plan×Actual tabs to recalculate values
 * under the currently selected scenario (Base / Otimista / Conservador / Stress).
 */
interface PlanningScenarioContextValue {
  scenarios: PlanningScenario[];
  activeScenarioId: string | null;
  setActiveScenarioId: (id: string | null) => void;
  activeScenario: PlanningScenario | null;
  /** Multiplicative factor applied to revenue values (1 + variacao_receita/100) */
  receitaFactor: number;
  /** Multiplicative factor applied to cost/expense values (1 + variacao_custos/100) */
  custoFactor: number;
  /** Extra outflow contributed by liabilities under stress (only when stress active) */
  stressExtraOutflow: number;
  /** Apply the scenario to a single budget line */
  applyToLine: (tipo: string, valor: number) => number;
  isLoading: boolean;
}

const PlanningScenarioContext = createContext<PlanningScenarioContextValue | undefined>(undefined);

export function PlanningScenarioProvider({ children }: { children: ReactNode }) {
  const { scenarios, isLoading } = usePlanningScenarios();
  const { liabilities } = useLiabilities();
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // Default to Base scenario when scenarios load
  const effectiveActiveId = useMemo(() => {
    if (activeScenarioId) return activeScenarioId;
    const base = scenarios.find((s) => s.type === "base");
    return base?.id ?? scenarios[0]?.id ?? null;
  }, [activeScenarioId, scenarios]);

  const activeScenario = useMemo(
    () => scenarios.find((s) => s.id === effectiveActiveId) ?? null,
    [scenarios, effectiveActiveId]
  );

  const receitaFactor = activeScenario ? 1 + activeScenario.variacao_receita / 100 : 1;
  const custoFactor = activeScenario ? 1 + activeScenario.variacao_custos / 100 : 1;

  // Stress contribution from active/judicial liabilities
  const stressExtraOutflow = useMemo(() => {
    if (activeScenario?.type !== "stress") return 0;
    return liabilities
      .filter((l) => l.status === "ativo" || l.status === "judicial")
      .reduce((sum, l) => {
        const base = Number(l.valor_atualizado);
        const factor = (Number(l.impacto_stress) || 0) / 100;
        return sum + base * factor;
      }, 0);
  }, [liabilities, activeScenario]);

  const applyToLine = (tipo: string, valor: number) => {
    const isReceita = tipo === "receita";
    return isReceita ? valor * receitaFactor : valor * custoFactor;
  };

  const value: PlanningScenarioContextValue = {
    scenarios,
    activeScenarioId: effectiveActiveId,
    setActiveScenarioId,
    activeScenario,
    receitaFactor,
    custoFactor,
    stressExtraOutflow,
    applyToLine,
    isLoading,
  };

  return (
    <PlanningScenarioContext.Provider value={value}>
      {children}
    </PlanningScenarioContext.Provider>
  );
}

export function usePlanningScenarioContext() {
  const ctx = useContext(PlanningScenarioContext);
  if (!ctx) {
    throw new Error("usePlanningScenarioContext must be used within PlanningScenarioProvider");
  }
  return ctx;
}
