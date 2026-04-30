import { useState, useMemo } from "react";
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCashFlow } from "@/hooks/useCashFlow";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useUrlState } from "@/hooks/useUrlState";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FluxoCaixaPeriodNav } from "@/components/fluxocaixa/FluxoCaixaPeriodNav";
import { FluxoCaixaCharts } from "@/components/fluxocaixa/FluxoCaixaCharts";
import { FluxoCaixaTable } from "@/components/fluxocaixa/FluxoCaixaTable";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  Loader2,
  Download,
  FileText,
  TrendingDown,
} from "lucide-react";
import {
  exportFluxoCaixaCSV,
  exportFluxoCaixaPDF,
} from "@/lib/fluxoCaixaExport";

const SUB_TABS = [
  { key: "geral", label: "Visão Geral" },
  { key: "projetado", label: "Projetado" },
  { key: "realizado", label: "Realizado" },
];

const fmt = (v: number) => {
  const n = Number(v) || 0;
  const abs = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(Math.abs(n));
  return n < 0 ? `(${abs})` : abs;
};

type DateCycle =
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual"
  | "personalizado";

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

export function FluxoCaixaTab() {
  const [refDate, setRefDate] = useState(new Date());
  const [urlCycle, setUrlCycle] = useUrlState("ciclo", "mensal");
  const cycle = urlCycle as DateCycle;
  const setCycle = (v: DateCycle) => setUrlCycle(v);

  const [customFrom, setCustomFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customTo, setCustomTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [activeTab, setActiveTab] = useUrlState("view", "geral");

  const isCustom = cycle === "personalizado";
  const months = getCycleMonths(cycle);
  const rangeFrom = isCustom
    ? customFrom ?? startOfMonth(new Date())
    : startOfMonth(refDate);
  const rangeTo = isCustom
    ? customTo ?? endOfMonth(new Date())
    : endOfMonth(addMonths(startOfMonth(refDate), months - 1));

  const { entries, totals, isLoading } = useCashFlow(rangeFrom, rangeTo);
  const { bankAccounts } = useBankAccounts();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();

  // Saldo de abertura = soma dos saldos atuais das contas bancárias ativas.
  const openingBalance = useMemo(
    () =>
      bankAccounts
        .filter((a) => a.active !== false)
        .reduce((s, a) => s + Number(a.saldo_atual ?? 0), 0),
    [bankAccounts],
  );

  const projetado = useMemo(
    () =>
      entries.filter(
        (e) => e.status === "previsto" || e.status === "confirmado",
      ),
    [entries],
  );
  const realizado = useMemo(
    () => entries.filter((e) => e.status === "pago" || e.status === "recebido"),
    [entries],
  );

  const totaisRealizado = useMemo(() => {
    let entradas = 0,
      saidas = 0;
    for (const e of realizado) {
      const val = Number(e.valor_realizado ?? e.valor_previsto);
      if (e.tipo === "entrada") entradas += val;
      else saidas += val;
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [realizado]);

  const totaisProjetado = useMemo(() => {
    let entradas = 0,
      saidas = 0;
    for (const e of projetado) {
      const val = Number(e.valor_previsto);
      if (e.tipo === "entrada") entradas += val;
      else saidas += val;
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [projetado]);

  // Burn rate: média de saídas líquidas mensais quando há déficit.
  // Runway (em meses) = openingBalance / burn mensal médio.
  const runway = useMemo(() => {
    const monthsSpan = Math.max(1, months);
    const netMonthly = totaisProjetado.saldo / monthsSpan;
    if (netMonthly >= 0) return { months: Infinity, burnPerMonth: 0 };
    const burn = Math.abs(netMonthly);
    const m = openingBalance > 0 ? openingBalance / burn : 0;
    return { months: m, burnPerMonth: burn };
  }, [totaisProjetado.saldo, months, openingBalance]);

  const navigatePeriod = (direction: 1 | -1) => {
    setRefDate(
      direction === 1 ? addMonths(refDate, months) : subMonths(refDate, months),
    );
  };

  const currentEntries =
    activeTab === "realizado"
      ? realizado
      : activeTab === "projetado"
        ? projetado
        : entries;
  const currentTotals =
    activeTab === "realizado"
      ? totaisRealizado
      : activeTab === "projetado"
        ? totaisProjetado
        : totals;

  const periodLabel = isCustom
    ? `${format(rangeFrom, "dd/MM/yyyy")} a ${format(rangeTo, "dd/MM/yyyy")}`
    : `${format(rangeFrom, "MMM yyyy", { locale: ptBR })}${
        months > 1 ? ` a ${format(rangeTo, "MMM yyyy", { locale: ptBR })}` : ""
      }`;

  const handleExportCsv = () => exportFluxoCaixaCSV(currentEntries, activeTab);
  const handleExportPdf = () =>
    exportFluxoCaixaPDF({
      contextName: currentOrg?.name ?? "—",
      periodLabel,
      entries: currentEntries,
      totals: currentTotals,
      openingBalance,
      issuer: {
        name: user?.user_metadata?.full_name ?? user?.email ?? "—",
        email: user?.email ?? "",
      },
    });

  const runwayDisplay =
    runway.months === Infinity
      ? "∞"
      : runway.months >= 24
        ? "24+ meses"
        : `${runway.months.toFixed(1)} meses`;

  return (
    <div className="space-y-6">
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
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <TabsList>
            {SUB_TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              disabled={currentEntries.length === 0}
              title="Baixar lançamentos do período em CSV"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPdf}
              disabled={currentEntries.length === 0}
              title="Gerar PDF com saldo acumulado"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
            </Button>
          </div>
        </div>

        <TabsContent value={activeTab} className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Saldo de Abertura"
              value={fmt(openingBalance)}
              icon={<Wallet size={20} />}
            />
            <KPICard
              title="Total Entradas"
              value={fmt(currentTotals.entradas)}
              icon={<ArrowUpCircle size={20} />}
            />
            <KPICard
              title="Total Saídas"
              value={fmt(currentTotals.saidas)}
              icon={<ArrowDownCircle size={20} />}
            />
            <KPICard
              title="Saldo Final Projetado"
              value={fmt(openingBalance + currentTotals.saldo)}
              icon={<Wallet size={20} />}
            />
            <KPICard
              title="Runway"
              value={runwayDisplay}
              icon={<TrendingDown size={20} />}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin" />
            </div>
          ) : currentEntries.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">
              <p>Nenhum lançamento encontrado para este período.</p>
              <p className="text-sm mt-1">
                Cadastre contratos ou lançamentos no módulo Financeiro.
              </p>
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
