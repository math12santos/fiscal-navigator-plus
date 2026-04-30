// Seção do Dashboard Geral que consolida o nível de maturidade de cada
// departamento avaliado. Mostra um score consolidado (média) e um card por
// setor. Os detalhes (trilha, checklist, tendência, metas, PDF) continuam
// dentro de cada módulo via SectorOnboardingBar.

import { useCallback, useState } from "react";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  MATURITY_LABEL_META,
  maturityLabelFromScore,
  SectorKey,
  SectorMaturityResult,
} from "@/lib/sectorMaturity/types";
import { SectorMaturityCard } from "./SectorMaturityCard";
import { cn } from "@/lib/utils";

// Setores com avaliador implementado. Estender quando CRM/Contratos/
// Planejamento ganharem seus `evaluate*`.
const SUPPORTED_SECTORS: SectorKey[] = ["dp", "financeiro", "juridico", "ti"];

export default function MaturityOverviewSection() {
  const [results, setResults] = useState<Partial<Record<SectorKey, SectorMaturityResult | null>>>({});

  const handleResult = useCallback(
    (sector: SectorKey, result: SectorMaturityResult | null) => {
      setResults((prev) => {
        const cur = prev[sector];
        // Compara por conteúdo: refs novas a cada render do hook causariam loop.
        if (cur === result) return prev;
        if (
          (cur ?? null) === null && result === null
        ) return prev;
        if (
          cur && result &&
          cur.score === result.score &&
          cur.label === result.label &&
          cur.completeness === result.completeness &&
          cur.freshness === result.freshness &&
          cur.routines === result.routines
        ) return prev;
        return { ...prev, [sector]: result };
      });
    },
    []
  );

  const evaluated = SUPPORTED_SECTORS
    .map((s) => results[s])
    .filter((r): r is SectorMaturityResult => !!r);

  const consolidatedScore = evaluated.length
    ? Math.round(evaluated.reduce((acc, r) => acc + r.score, 0) / evaluated.length)
    : null;

  const consolidatedLabel = consolidatedScore !== null
    ? MATURITY_LABEL_META[maturityLabelFromScore(consolidatedScore)]
    : null;

  return (
    <section className="bg-card border border-border rounded-xl p-6 space-y-4">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Maturidade dos Departamentos
            </h3>
            <p className="text-xs text-muted-foreground">
              Termômetro consolidado por setor — clique para abrir o módulo.
            </p>
          </div>
        </div>

        {consolidatedScore !== null && consolidatedLabel && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Consolidado</span>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {consolidatedScore}
              <span className="text-xs text-muted-foreground font-normal">/100</span>
            </span>
            <Badge variant="outline" className={cn(consolidatedLabel.badgeClass)}>
              {consolidatedLabel.label}
            </Badge>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SUPPORTED_SECTORS.map((sector) => (
          <SectorMaturityCard
            key={sector}
            sector={sector}
            onResult={handleResult}
          />
        ))}
      </div>
    </section>
  );
}
