import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { format } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";

type Ctx = {
  /** yyyy-MM. null = sem filtro (mostrar tudo). */
  workingMonth: string | null;
  /** Indica se o usuário trocou manualmente o mês (para esconder banner quando estiver no mês corrente "default"). */
  isManual: boolean;
  setWorkingMonth: (ym: string | null) => void;
  clearWorkingMonth: () => void;
  /** Mês corrente real (yyyy-MM), útil para defaults. */
  currentMonth: string;
};

const FinanceiroMonthContext = createContext<Ctx | undefined>(undefined);

export function FinanceiroMonthProvider({ children }: { children: ReactNode }) {
  const { currentOrg } = useOrganization();
  const currentMonth = format(new Date(), "yyyy-MM");
  const [workingMonth, setWM] = useState<string | null>(currentMonth);
  const [isManual, setIsManual] = useState(false);

  // Reset on org change.
  useEffect(() => {
    setWM(currentMonth);
    setIsManual(false);
  }, [currentOrg?.id, currentMonth]);

  const setWorkingMonth = (ym: string | null) => {
    setWM(ym);
    setIsManual(ym !== currentMonth);
  };

  const clearWorkingMonth = () => {
    setWM(null);
    setIsManual(true);
  };

  return (
    <FinanceiroMonthContext.Provider
      value={{ workingMonth, isManual, setWorkingMonth, clearWorkingMonth, currentMonth }}
    >
      {children}
    </FinanceiroMonthContext.Provider>
  );
}

export function useFinanceiroMonth() {
  const ctx = useContext(FinanceiroMonthContext);
  if (!ctx) throw new Error("useFinanceiroMonth must be used within FinanceiroMonthProvider");
  return ctx;
}
