import { useMemo, useState } from "react";
import { Settings2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinancialDashboardKPIs } from "@/hooks/useFinancialDashboardKPIs";
import { useKpiPreferences } from "@/hooks/useKpiPreferences";
import {
  KPI_REGISTRY,
  SECTION_META,
  KpiSection as KpiSectionKey,
} from "./kpiRegistry";
import { KpiSection } from "./KpiSection";
import { KpiTile } from "./KpiTile";
import { KpiPreferencesDialog } from "./KpiPreferencesDialog";

const SECTION_ORDER: KpiSectionKey[] = [
  "receita",
  "lucratividade",
  "caixa",
  "ar",
  "ap",
  "eficiencia",
  "comercial",
];

export function FinancialDashboardTab() {
  const [prefsOpen, setPrefsOpen] = useState(false);
  const { results, isLoading, windowMonths } = useFinancialDashboardKPIs(12);
  const { enabledMap, setEnabled } = useKpiPreferences();

  const grouped = useMemo(() => {
    const map: Record<KpiSectionKey, typeof KPI_REGISTRY> = {
      receita: [], lucratividade: [], caixa: [], ar: [], ap: [], eficiencia: [], comercial: [],
    };
    for (const k of KPI_REGISTRY) map[k.section].push(k);
    return map;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dashboard Financeiro</h2>
          <p className="text-xs text-muted-foreground">
            Visão executiva consolidada — janela de {windowMonths} meses. KPIs sem dados exibem o
            que falta e como configurar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Calculando…
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setPrefsOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1.5" />
            Configurar KPIs
          </Button>
        </div>
      </div>

      {SECTION_ORDER.map((sec) => {
        const items = grouped[sec];
        const meta = SECTION_META[sec];
        const visibleCount = items.filter((k) => enabledMap[k.id]).length;
        return (
          <KpiSection
            key={sec}
            title={meta.title}
            subtitle={meta.subtitle}
            visibleCount={visibleCount}
            totalCount={items.length}
          >
            {items.map((def) => (
              <KpiTile
                key={def.id}
                def={def}
                result={results[def.id] ?? { status: "loading", value: null, missingReasons: [] }}
                enabled={!!enabledMap[def.id]}
                onToggle={(enabled) => setEnabled.mutate({ kpiId: def.id, enabled })}
              />
            ))}
          </KpiSection>
        );
      })}

      <KpiPreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} />
    </div>
  );
}
