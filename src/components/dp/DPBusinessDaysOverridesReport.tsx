/**
 * Relatório de Histórico de Overrides de Dias Úteis.
 *
 * Auditoria CFO-first dos ajustes de dias úteis aplicados sobre a folha:
 *   - Overrides mensais (organização inteira) — ex.: ponte de carnaval.
 *   - Overrides individuais (por colaborador, dentro de uma rodada de folha) —
 *     ex.: banco de horas, afastamento parcial.
 *
 * Para cada override exibe motivo, delta vs. mês cheio (seg-sex) e impacto
 * financeiro estimado (VT diário + benefícios "por_dia") por colaborador.
 *
 * O relatório é puramente informativo (read-only) e usa as mesmas fontes
 * de dados da folha real, garantindo reconciliação.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { History, Download, Calendar, User, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEmployees } from "@/hooks/useDP";
import { useEmployeeBenefits } from "@/hooks/useDPBenefits";
import { useBusinessDayOverrides } from "@/hooks/useBusinessDays";
import { getBusinessDays } from "@/hooks/usePayrollProjections";

type ReportRow = {
  scope: "monthly" | "individual";
  monthKey: string;
  monthLabel: string;
  employeeId: string | null;
  employeeName: string;
  daysAuto: number;
  daysEffective: number;
  delta: number;
  reason: string;
  vtImpact: number; // delta financeiro (negativo = redução de custo)
  vaImpact: number;
  totalImpact: number;
  createdAt: string;
};

interface PayrollOverrideRaw {
  id: string;
  employee_id: string;
  business_days_used: number;
  reason: string | null;
  created_at: string;
  payroll_run_id: string;
  payroll_runs: { reference_month: string } | null;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DPBusinessDaysOverridesReport() {
  const { currentOrg } = useOrganization();
  const { data: monthlyOverrides = [] } = useBusinessDayOverrides();
  const { data: employees = [] } = useEmployees();
  const { data: empBenefits = [] } = useEmployeeBenefits();

  const [scopeFilter, setScopeFilter] = useState<"all" | "monthly" | "individual">("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Busca todos os overrides individuais da org com o mês de referência da folha.
  const individualQuery = useQuery({
    queryKey: ["payroll_day_overrides_report", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("payroll_business_days_overrides")
        .select("id, employee_id, business_days_used, reason, created_at, payroll_run_id, payroll_runs(reference_month)")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PayrollOverrideRaw[];
    },
  });

  // Soma de benefícios por_dia de cada colaborador (impacto VA por dia útil).
  const vaPorDiaByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    for (const eb of empBenefits) {
      if (!eb.active) continue;
      const benefit = (eb as any).dp_benefits;
      if (!benefit || benefit.type !== "por_dia") continue;
      const value = Number(eb.custom_value ?? benefit.default_value ?? 0);
      map.set(eb.employee_id, (map.get(eb.employee_id) ?? 0) + value);
    }
    return map;
  }, [empBenefits]);

  const employeeById = useMemo(() => {
    const m = new Map<string, { name: string; vt_diario: number; vt_ativo: boolean }>();
    for (const e of employees) {
      m.set(e.id, {
        name: e.name,
        vt_diario: Number(e.vt_diario ?? 0),
        vt_ativo: !!e.vt_ativo,
      });
    }
    return m;
  }, [employees]);

  // Calcula impacto VT/VA somente para overrides individuais (afetam um
  // colaborador específico). Para overrides mensais, o impacto seria a soma
  // sobre todos os colaboradores ativos no mês — exibimos como "—" e o usuário
  // pode usar o relatório individual ou o card de VT/VA do dashboard para
  // visualizar o agregado.
  const rows = useMemo<ReportRow[]>(() => {
    const out: ReportRow[] = [];

    // 1. Overrides mensais
    for (const ov of monthlyOverrides) {
      const monthDate = parseISO(ov.reference_month);
      const auto = getBusinessDays(monthDate);
      out.push({
        scope: "monthly",
        monthKey: ov.reference_month,
        monthLabel: format(monthDate, "MMM/yyyy", { locale: ptBR }),
        employeeId: null,
        employeeName: "Toda a organização",
        daysAuto: auto,
        daysEffective: ov.business_days,
        delta: ov.business_days - auto,
        reason: ov.notes ?? "",
        vtImpact: 0,
        vaImpact: 0,
        totalImpact: 0,
        createdAt: ov.reference_month,
      });
    }

    // 2. Overrides individuais
    for (const ov of individualQuery.data ?? []) {
      const refMonth = ov.payroll_runs?.reference_month;
      if (!refMonth) continue;
      const monthDate = parseISO(refMonth);
      const auto = getBusinessDays(monthDate);
      const delta = ov.business_days_used - auto;
      const emp = employeeById.get(ov.employee_id);
      const vtDay = emp?.vt_ativo ? emp.vt_diario : 0;
      const vaDay = vaPorDiaByEmployee.get(ov.employee_id) ?? 0;
      const vtImpact = vtDay * delta;
      const vaImpact = vaDay * delta;
      out.push({
        scope: "individual",
        monthKey: refMonth,
        monthLabel: format(monthDate, "MMM/yyyy", { locale: ptBR }),
        employeeId: ov.employee_id,
        employeeName: emp?.name ?? "(colaborador removido)",
        daysAuto: auto,
        daysEffective: ov.business_days_used,
        delta,
        reason: ov.reason ?? "",
        vtImpact,
        vaImpact,
        totalImpact: vtImpact + vaImpact,
        createdAt: ov.created_at,
      });
    }

    // Ordenação: mês desc, depois individual antes do mensal
    return out.sort((a, b) => {
      if (a.monthKey !== b.monthKey) return a.monthKey < b.monthKey ? 1 : -1;
      if (a.scope !== b.scope) return a.scope === "individual" ? -1 : 1;
      return a.employeeName.localeCompare(b.employeeName);
    });
  }, [monthlyOverrides, individualQuery.data, employeeById, vaPorDiaByEmployee]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (scopeFilter !== "all" && r.scope !== scopeFilter) return false;
      if (employeeFilter !== "all") {
        if (employeeFilter === "__monthly__") {
          if (r.scope !== "monthly") return false;
        } else if (r.employeeId !== employeeFilter) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !r.employeeName.toLowerCase().includes(q) &&
          !r.reason.toLowerCase().includes(q) &&
          !r.monthLabel.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, scopeFilter, employeeFilter, search]);

  // Agregados para o cabeçalho
  const summary = useMemo(() => {
    let totalImpact = 0;
    let monthlyCount = 0;
    let individualCount = 0;
    let withoutReason = 0;
    for (const r of filtered) {
      totalImpact += r.totalImpact;
      if (r.scope === "monthly") monthlyCount++;
      else individualCount++;
      if (!r.reason.trim()) withoutReason++;
    }
    return { totalImpact, monthlyCount, individualCount, withoutReason };
  }, [filtered]);

  const exportCsv = () => {
    const headers = [
      "Tipo",
      "Mês",
      "Colaborador",
      "Dias auto (seg-sex)",
      "Dias efetivos",
      "Delta",
      "Motivo",
      "Impacto VT (R$)",
      "Impacto VA por_dia (R$)",
      "Impacto total (R$)",
      "Registrado em",
    ];
    const lines = filtered.map((r) =>
      [
        r.scope === "monthly" ? "Mensal" : "Individual",
        r.monthLabel,
        r.employeeName,
        r.daysAuto,
        r.daysEffective,
        r.delta,
        `"${r.reason.replace(/"/g, '""')}"`,
        r.scope === "individual" ? r.vtImpact.toFixed(2) : "",
        r.scope === "individual" ? r.vaImpact.toFixed(2) : "",
        r.scope === "individual" ? r.totalImpact.toFixed(2) : "",
        r.createdAt,
      ].join(";")
    );
    const csv = [headers.join(";"), ...lines].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-dias-uteis-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Histórico de Overrides de Dias Úteis</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Auditoria de todos os ajustes mensais e individuais aplicados sobre a folha,
                com motivo e impacto financeiro estimado por colaborador (VT diário + benefícios por dia).
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Indicadores agregados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> Overrides mensais
            </div>
            <div className="text-2xl font-semibold mt-1">{summary.monthlyCount}</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" /> Overrides individuais
            </div>
            <div className="text-2xl font-semibold mt-1">{summary.individualCount}</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" /> Sem motivo registrado
            </div>
            <div className={`text-2xl font-semibold mt-1 ${summary.withoutReason > 0 ? "text-warning" : ""}`}>
              {summary.withoutReason}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">Impacto total (individual)</div>
            <div
              className={`text-2xl font-semibold mt-1 ${
                summary.totalImpact < 0 ? "text-success" : summary.totalImpact > 0 ? "text-destructive" : ""
              }`}
            >
              {formatBRL(summary.totalImpact)}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Select value={scopeFilter} onValueChange={(v: any) => setScopeFilter(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo de override" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="monthly">Apenas mensais</SelectItem>
              <SelectItem value="individual">Apenas individuais</SelectItem>
            </SelectContent>
          </Select>

          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Colaborador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os colaboradores</SelectItem>
              <SelectItem value="__monthly__">— Apenas overrides mensais —</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Buscar por nome, mês ou motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabela */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Mês</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-right">Auto (seg-sex)</TableHead>
                <TableHead className="text-right">Efetivo</TableHead>
                <TableHead className="text-right">Δ dias</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Δ VT</TableHead>
                <TableHead className="text-right">Δ VA/dia</TableHead>
                <TableHead className="text-right">Impacto total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Nenhum override registrado no período.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r, idx) => (
                  <TableRow key={`${r.scope}-${r.monthKey}-${r.employeeId ?? "org"}-${idx}`}>
                    <TableCell>
                      {r.scope === "monthly" ? (
                        <Badge variant="secondary" className="gap-1">
                          <Calendar className="h-3 w-3" /> Mensal
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <User className="h-3 w-3" /> Individual
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{r.monthLabel}</TableCell>
                    <TableCell className="font-medium">{r.employeeName}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.daysAuto}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {r.daysEffective}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-medium ${
                        r.delta < 0 ? "text-warning" : r.delta > 0 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      {r.reason ? (
                        <span className="text-sm">{r.reason}</span>
                      ) : (
                        <span className="text-xs text-warning italic">Sem motivo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.scope === "individual" ? formatBRL(r.vtImpact) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.scope === "individual" ? formatBRL(r.vaImpact) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-semibold ${
                        r.totalImpact < 0
                          ? "text-success"
                          : r.totalImpact > 0
                          ? "text-destructive"
                          : ""
                      }`}
                    >
                      {r.scope === "individual" ? formatBRL(r.totalImpact) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          O impacto financeiro é estimado a partir do VT diário do colaborador e da soma de
          benefícios do tipo <code className="font-mono">por_dia</code>, multiplicados pelo Δ de
          dias úteis. Overrides mensais afetam todos os colaboradores ativos do mês — consulte
          os cards de VT/VA do Dashboard para visualizar o agregado.
        </p>
      </CardContent>
    </Card>
  );
}
