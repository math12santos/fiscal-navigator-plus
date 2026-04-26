// Aba do Backoffice: visão multi-organização da maturidade por setor.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Gauge, FileDown, Sparkles, ListChecks, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  MATURITY_LABEL_META,
  SECTOR_META,
  MaturityLabel,
  SectorKey,
  SectorMaturityResult,
} from "@/lib/sectorMaturity/types";
import { downloadMaturityPdf } from "@/lib/sectorMaturity/exportMaturityPdf";
import { SectorOnboardingChecklist } from "@/components/sector-onboarding/SectorOnboardingChecklist";
import { ImprovementTrack } from "@/components/sector-onboarding/ImprovementTrack";
import { MaturityTrendChart } from "@/components/sector-onboarding/MaturityTrendChart";

interface Row {
  id: string;
  organization_id: string;
  sector: string;
  score: number;
  completeness_score: number;
  freshness_score: number;
  routines_score: number;
  maturity_label: MaturityLabel | null;
  checklist: any;
  last_calculated_at: string;
  org_name?: string;
}

const LABEL_OPTIONS: (MaturityLabel | "all")[] = ["all", "critico", "desenvolvimento", "maduro", "excelente"];

export function SectorMaturityTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState<string>("dp");
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      const { data: list } = await supabase
        .from("sector_onboarding" as any)
        .select("*")
        .order("score", { ascending: true });
      if (!list) {
        if (!cancelled) setLoading(false);
        return;
      }
      const orgIds = Array.from(new Set((list as any[]).map((r: any) => r.organization_id)));
      const { data: orgs } = await supabase
        .from("organizations" as any).select("id, name").in("id", orgIds);
      const orgMap = new Map((orgs as any[] || []).map((o: any) => [o.id, o.name]));
      if (cancelled) return;
      setRows((list as any[]).map((r: any) => ({ ...r, org_name: orgMap.get(r.organization_id) || "—" })));
      setLoading(false);
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (sector !== "all" && r.sector !== sector) return false;
      if (labelFilter !== "all" && r.maturity_label !== labelFilter) return false;
      return true;
    });
  }, [rows, sector, labelFilter]);

  const stats = useMemo(() => {
    const base = sector === "all" ? rows : rows.filter((r) => r.sector === sector);
    const counts = { critico: 0, desenvolvimento: 0, maduro: 0, excelente: 0 };
    for (const r of base) {
      if (r.maturity_label && r.maturity_label in counts) {
        counts[r.maturity_label as keyof typeof counts] += 1;
      }
    }
    return { total: base.length, ...counts };
  }, [rows, sector]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold text-foreground">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Crítico</p><p className="text-2xl font-bold text-destructive">{stats.critico}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Em desenvolvimento</p><p className="text-2xl font-bold text-amber-600">{stats.desenvolvimento}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Maduro</p><p className="text-2xl font-bold text-blue-600">{stats.maduro}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Excelente</p><p className="text-2xl font-bold text-emerald-600">{stats.excelente}</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {Object.entries(SECTOR_META).map(([k, m]) => (
              <SelectItem key={k} value={k}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={labelFilter} onValueChange={setLabelFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Faixa de maturidade" /></SelectTrigger>
          <SelectContent>
            {LABEL_OPTIONS.map((l) => (
              <SelectItem key={l} value={l}>
                {l === "all" ? "Todas as faixas" : MATURITY_LABEL_META[l].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Completude</TableHead>
                <TableHead>Atualização</TableHead>
                <TableHead>Rotinas</TableHead>
                <TableHead>Faixa</TableHead>
                <TableHead>Atualizado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum registro de maturidade ainda. Os dados aparecem assim que os gestores acessam o módulo.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const meta = r.maturity_label ? MATURITY_LABEL_META[r.maturity_label] : null;
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                    <TableCell className="font-medium">{r.org_name}</TableCell>
                    <TableCell>{SECTOR_META[r.sector as keyof typeof SECTOR_META]?.label ?? r.sector}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={Number(r.score)} className="h-2 flex-1" />
                        <span className="text-xs tabular-nums text-muted-foreground">{Math.round(Number(r.score))}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{Math.round(Number(r.completeness_score))}/50</TableCell>
                    <TableCell className="text-sm tabular-nums">{Math.round(Number(r.freshness_score))}/25</TableCell>
                    <TableCell className="text-sm tabular-nums">{Math.round(Number(r.routines_score))}/25</TableCell>
                    <TableCell>
                      {meta ? <Badge variant="outline" className={meta.badgeClass}>{meta.label}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(r.last_calculated_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && <SelectedDetail row={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SelectedDetail({ row }: { row: Row }) {
  const result: SectorMaturityResult = {
    score: Number(row.score),
    completeness: Number(row.completeness_score),
    freshness: Number(row.freshness_score),
    routines: Number(row.routines_score),
    label: (row.maturity_label ?? "critico") as MaturityLabel,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
  };

  const handleExport = () => {
    try {
      downloadMaturityPdf({
        orgName: row.org_name || "Organização",
        sector: row.sector as SectorKey,
        result,
      });
      toast.success("PDF gerado com sucesso");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF", { description: e?.message });
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Gauge size={18} className="text-primary" />
          {row.org_name} — {SECTOR_META[row.sector as keyof typeof SECTOR_META]?.label ?? row.sector}
        </SheetTitle>
        <SheetDescription>
          Score {Math.round(Number(row.score))}/100 — atualizado em{" "}
          {format(new Date(row.last_calculated_at), "dd/MM/yyyy HH:mm")}
        </SheetDescription>
      </SheetHeader>

      <Tabs defaultValue="checklist" className="mt-4">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="trilha"><Sparkles size={12} className="mr-1" /> Trilha</TabsTrigger>
          <TabsTrigger value="checklist"><ListChecks size={12} className="mr-1" /> Checklist</TabsTrigger>
          <TabsTrigger value="tendencia"><TrendingUp size={12} className="mr-1" /> Tendência</TabsTrigger>
        </TabsList>
        <TabsContent value="trilha" className="mt-4">
          <ImprovementTrack result={result} readOnly />
        </TabsContent>
        <TabsContent value="checklist" className="mt-4">
          <SectorOnboardingChecklist readOnly result={result} />
        </TabsContent>
        <TabsContent value="tendencia" className="mt-4">
          <MaturityTrendChart
            sector={row.sector as SectorKey}
            organizationId={row.organization_id}
          />
        </TabsContent>
      </Tabs>

      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="outline" onClick={handleExport}>
          <FileDown size={14} className="mr-1.5" /> Exportar PDF
        </Button>
      </div>
    </>
  );
}
