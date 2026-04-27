// Barra colapsável de maturidade do setor, com Trilha sugerida, Checklist,
// Tendência mensal e exportação em PDF.

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronDown, ChevronUp, RefreshCw, Gauge, ListChecks, FileDown, Sparkles, TrendingUp, Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useSectorOnboarding } from "@/hooks/useSectorOnboarding";
import { useMaturityMonthlyBackfill } from "@/hooks/useMaturityHistory";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  MATURITY_LABEL_META,
  SECTOR_META,
  SectorKey,
  ChecklistItem,
} from "@/lib/sectorMaturity/types";
import { downloadMaturityPdf } from "@/lib/sectorMaturity/exportMaturityPdf";
import { ImprovementStep } from "@/lib/sectorMaturity/improvementTrack";
import { SectorOnboardingChecklist } from "./SectorOnboardingChecklist";
import { ImprovementTrack } from "./ImprovementTrack";
import { MaturityTrendChart } from "./MaturityTrendChart";
import { SectorMaturityTargetsDialog } from "./SectorMaturityTargetsDialog";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/lib/utils";

interface Props {
  sector: SectorKey;
  onTabChange?: (tab: string) => void;
}

export function SectorOnboardingBar({ sector, onTabChange }: Props) {
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"trilha" | "checklist" | "tendencia">("trilha");
  const [targetsOpen, setTargetsOpen] = useState(false);
  const { result, isLoading, refresh } = useSectorOnboarding(sector);
  const { currentOrg } = useOrganization();
  const { hasFullAccess } = useUserPermissions();
  const canEditTargets = hasFullAccess;
  const [searchParams, setSearchParams] = useSearchParams();

  // Snapshot mensal defensivo
  useMaturityMonthlyBackfill(sector, result);

  // Deep-link: ?openMaturity=1 abre o drawer já na trilha (vindo de notificação)
  useEffect(() => {
    if (searchParams.get("openMaturity") === "1") {
      setDrawer(true);
      setDrawerTab("trilha");
      const next = new URLSearchParams(searchParams);
      next.delete("openMaturity");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (isLoading || !result) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Gauge size={16} className="animate-pulse" />
            Calculando maturidade do setor…
          </div>
        </CardContent>
      </Card>
    );
  }

  const meta = MATURITY_LABEL_META[result.label];

  const navigateToTab = (tab?: string) => {
    if (tab && onTabChange) {
      onTabChange(tab);
      setDrawer(false);
    }
  };

  const handleChecklistAction = (item: ChecklistItem) => navigateToTab(item.ctaTab);
  const handleStepAction = (step: ImprovementStep) => navigateToTab(step.ctaTab);

  const handleExport = () => {
    try {
      downloadMaturityPdf({
        orgName: currentOrg?.name || "Organização",
        sector,
        result,
      });
      toast.success("PDF gerado com sucesso");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF", { description: e?.message });
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <Gauge size={20} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Maturidade do {SECTOR_META[sector].label}
                </p>
                <p className="text-xs text-muted-foreground">
                  Termômetro do setor — {result.score}/100
                </p>
              </div>
              <Badge variant="outline" className={cn("ml-1", meta.badgeClass)}>
                {meta.label}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setDrawerTab("trilha"); setDrawer(true); }}
              >
                <Sparkles size={14} className="mr-1" /> Trilha
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setDrawerTab("checklist"); setDrawer(true); }}
              >
                <ListChecks size={14} className="mr-1" /> Checklist
              </Button>
              <Button size="sm" variant="ghost" onClick={handleExport} title="Exportar PDF">
                <FileDown size={14} />
              </Button>
              {canEditTargets && (
                <Button size="sm" variant="ghost" onClick={() => setTargetsOpen(true)} title="Metas de maturidade">
                  <Target size={14} />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={refresh} title="Recalcular">
                <RefreshCw size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Recolher" : "Expandir"}
              >
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </Button>
            </div>
          </div>

          <Progress value={result.score} className="h-2" />

          {open && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <MiniGauge label="Completude" value={result.completeness} max={50} />
              <MiniGauge label="Atualização" value={result.freshness} max={25} />
              <MiniGauge label="Rotinas" value={result.routines} max={25} />
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Gauge size={18} className="text-primary" />
              Maturidade do {SECTOR_META[sector].label}
            </SheetTitle>
            <SheetDescription>
              {result.score}/100 — {meta.label}.
            </SheetDescription>
          </SheetHeader>

          <Tabs value={drawerTab} onValueChange={(v) => setDrawerTab(v as any)} className="mt-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="trilha"><Sparkles size={12} className="mr-1" /> Trilha</TabsTrigger>
              <TabsTrigger value="checklist"><ListChecks size={12} className="mr-1" /> Checklist</TabsTrigger>
              <TabsTrigger value="tendencia"><TrendingUp size={12} className="mr-1" /> Tendência</TabsTrigger>
            </TabsList>

            <TabsContent value="trilha" className="mt-4">
              <ImprovementTrack result={result} onStepAction={handleStepAction} />
            </TabsContent>
            <TabsContent value="checklist" className="mt-4">
              <SectorOnboardingChecklist result={result} onItemAction={handleChecklistAction} />
            </TabsContent>
            <TabsContent value="tendencia" className="mt-4">
              <MaturityTrendChart sector={sector} />
            </TabsContent>
          </Tabs>

          <div className="mt-4 flex justify-end">
            <Button size="sm" variant="outline" onClick={handleExport}>
              <FileDown size={14} className="mr-1.5" /> Exportar PDF
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {canEditTargets && (
        <SectorMaturityTargetsDialog
          open={targetsOpen}
          onOpenChange={setTargetsOpen}
          sector={sector}
        />
      )}
    </>
  );
}

function MiniGauge({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {Math.round(value * 10) / 10}/{max}
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
