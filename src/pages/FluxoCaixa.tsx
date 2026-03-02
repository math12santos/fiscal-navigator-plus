import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { useCashFlow, CashFlowEntry } from "@/hooks/useCashFlow";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { KPICard } from "@/components/KPICard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FluxoCaixaPeriodNav } from "@/components/fluxocaixa/FluxoCaixaPeriodNav";
import { FluxoCaixaCharts } from "@/components/fluxocaixa/FluxoCaixaCharts";
import { FluxoCaixaTable } from "@/components/fluxocaixa/FluxoCaixaTable";
import {
  ArrowUpCircle, ArrowDownCircle, Wallet, Loader2,
} from "lucide-react";

const ALL_TABS = [
  { key: "geral", label: "Visão Geral" },
  { key: "projetado", label: "Projetado" },
  { key: "realizado", label: "Realizado" },
];

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

type DateCycle = "mensal" | "bimestral" | "trimestral" | "semestral" | "anual" | "personalizado";

const cycleOptions: { value: DateCycle; label: string; months: number }[] = [
  { value: "mensal", label: "Mensal", months: 1 },
  { value: "bimestral", label: "Bimestral", months: 2 },
  { value: "trimestral", label: "Trimestral", months: 3 },
  { value: "semestral", label: "Semestral", months: 6 },
  { value: "anual", label: "Anual", months: 12 },
  { value: "personalizado", label: "Personalizado", months: 0 },
];

function getCycleMonths(cycle: DateCycle): number {
  return cycleOptions.find((c) => c.value === cycle)?.months ?? 1;
}

export default function FluxoCaixa() {
  const { getAllowedTabs } = useUserPermissions();
  const allowedTabs = getAllowedTabs("fluxo-caixa", ALL_TABS);
  const [refDate, setRefDate] = useState(new Date());
  const [cycle, setCycle] = useState<DateCycle>("mensal");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customTo, setCustomTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [activeTab, setActiveTab] = useState(allowedTabs[0]?.key || "geral");

  const isCustom = cycle === "personalizado";
  const months = getCycleMonths(cycle);
  const rangeFrom = isCustom ? (customFrom ?? startOfMonth(new Date())) : startOfMonth(refDate);
  const rangeTo = isCustom ? (customTo ?? endOfMonth(new Date())) : endOfMonth(addMonths(startOfMonth(refDate), months - 1));

  const { entries, totals, isLoading } = useCashFlow(rangeFrom, rangeTo);

  // Split entries by view
  const projetado = useMemo(() =>
    entries.filter((e) => e.status === "previsto" || e.status === "confirmado"),
    [entries]
  );
  const realizado = useMemo(() =>
    entries.filter((e) => e.status === "pago" || e.status === "recebido"),
    [entries]
  );

  const totaisRealizado = useMemo(() => {
    let entradas = 0, saidas = 0;
    for (const e of realizado) {
      const val = Number(e.valor_realizado ?? e.valor_previsto);
      if (e.tipo === "entrada") entradas += val;
      else saidas += val;
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [realizado]);

  const totaisProjetado = useMemo(() => {
    let entradas = 0, saidas = 0;
    for (const e of projetado) {
      const val = Number(e.valor_previsto);
      if (e.tipo === "entrada") entradas += val;
      else saidas += val;
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [projetado]);

  const navigatePeriod = (direction: 1 | -1) => {
    setRefDate(direction === 1 ? addMonths(refDate, months) : subMonths(refDate, months));
  };

  const currentEntries = activeTab === "realizado" ? realizado : activeTab === "projetado" ? projetado : entries;
  const currentTotals = activeTab === "realizado" ? totaisRealizado : activeTab === "projetado" ? totaisProjetado : totals;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Fluxo de Caixa" description="Gestão do fluxo de caixa realizado e previsto" />

      <FluxoCaixaPeriodNav
        cycle={cycle}
        setCycle={(v) => setCycle(v as DateCycle)}
        cycleOptions={cycleOptions}
        isCustom={isCustom}
        customFrom={customFrom}
        customTo={customTo}
        setCustomFrom={setCustomFrom}
        setCustomTo={setCustomTo}
        refDate={refDate}
        months={months}
        navigatePeriod={navigatePeriod}
        setRefDate={setRefDate}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {allowedTabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6 mt-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICard title="Total Entradas" value={fmt(currentTotals.entradas)} icon={<ArrowUpCircle size={20} />} />
            <KPICard title="Total Saídas" value={fmt(currentTotals.saidas)} icon={<ArrowDownCircle size={20} />} />
            <KPICard title="Saldo do Período" value={fmt(currentTotals.saldo)} icon={<Wallet size={20} />} />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : currentEntries.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">
              <p>Nenhum lançamento encontrado para este período.</p>
              <p className="text-sm mt-1">Cadastre contratos ou lançamentos no módulo Financeiro.</p>
            </div>
          ) : (
            <>
              <FluxoCaixaCharts entries={currentEntries} />
              <FluxoCaixaTable entries={currentEntries} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
