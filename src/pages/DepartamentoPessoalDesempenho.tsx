// Subpágina /dp/desempenho — Gestão de Desempenho (PDI, 1:1, 9 Box, BSC, Dashboard).
// MVP funcional integrado: cards-resumo, abas e diálogos de criação/edição.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { ArrowLeft, Plus, Target, MessageCircle, Grid3X3, BarChart3, LayoutDashboard, AlertTriangle, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { useEmployees } from "@/hooks/useDP";
import { useDepartments } from "@/hooks/useDepartments";
import { usePDIs, useMutatePDI, type HrPdi } from "@/hooks/usePDIs";
import { useOneOnOnes, useMutateOneOnOne, type HrOneOnOne } from "@/hooks/useOneOnOnes";
import { useNineBoxEvaluations, useLatest9BoxByEmployee, useMutateNineBox } from "@/hooks/useNineBox";
import { useBSCScorecards, useMutateBSC } from "@/hooks/useBSC";
import { QUADRANT_META, QUADRANT_TONE_CLASS, quadrantFrom } from "@/lib/performance/quadrante";
import { PDICharts, OneOnOneCharts, BSCCharts } from "@/components/desempenho/DesempenhoCharts";

const PDI_STATUS_META: Record<string, { label: string; class: string }> = {
  nao_iniciado: { label: "Não iniciado", class: "bg-muted text-foreground border-border" },
  em_andamento: { label: "Em andamento", class: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  em_atraso: { label: "Em atraso", class: "bg-destructive/10 text-destructive border-destructive/30" },
  concluido: { label: "Concluído", class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  cancelado: { label: "Cancelado", class: "bg-muted text-muted-foreground border-border" },
};

const ONE_ON_ONE_STATUS_META: Record<string, { label: string; class: string }> = {
  agendada: { label: "Agendada", class: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  realizada: { label: "Realizada", class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  remarcada: { label: "Remarcada", class: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  cancelada: { label: "Cancelada", class: "bg-muted text-muted-foreground border-border" },
  pendente: { label: "Pendente", class: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
};

export default function DepartamentoPessoalDesempenho() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("dashboard");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: employees = [] } = useEmployees();
  const { data: departments = [] } = useDepartments();
  const { data: pdis = [] } = usePDIs({
    employeeId: employeeFilter !== "all" ? employeeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const { data: oneOnOnes = [] } = useOneOnOnes({
    employeeId: employeeFilter !== "all" ? employeeFilter : undefined,
  });
  const { data: nineBox = [] } = useNineBoxEvaluations();
  const { map: latest9BoxMap } = useLatest9BoxByEmployee();
  const { data: bscList = [] } = useBSCScorecards();

  const employeeMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const stats = useMemo(() => {
    const activeEmployees = employees.filter((e: any) => e.status === "ativo");
    const today = new Date();
    const pdisAtivos = pdis.filter((p) => ["em_andamento", "em_atraso", "nao_iniciado"].includes(p.status));
    const oneOnOnesPend = oneOnOnes.filter((o) => ["agendada", "pendente"].includes(o.status) && new Date(o.data_reuniao) <= today);
    const altoDes = nineBox.filter((e) => (e.nota_desempenho ?? 0) >= 4).length;
    const risco = nineBox.filter((e) => e.quadrante === 1 || e.risco_perda === "alto").length;
    const mediaDes = nineBox.length
      ? nineBox.reduce((s, e) => s + Number(e.nota_desempenho || 0), 0) / nineBox.length
      : 0;
    return {
      total: activeEmployees.length,
      pdisAtivos: pdisAtivos.length,
      oneOnOnesPend: oneOnOnesPend.length,
      altoDes,
      risco,
      mediaDes: Math.round(mediaDes * 10) / 10,
    };
  }, [employees, pdis, oneOnOnes, nineBox]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Gestão de Desempenho"
        description="PDI, One-on-One, Matriz 9 Box e BSC — visão integrada do desempenho do time."
      >
        <Button variant="outline" size="sm" onClick={() => navigate("/dp")}>
          <ArrowLeft size={14} className="mr-1" /> Voltar ao DP
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Acompanhados" value={stats.total} />
        <KpiCard label="PDIs ativos" value={stats.pdisAtivos} />
        <KpiCard label="1:1 pendentes" value={stats.oneOnOnesPend} />
        <KpiCard label="Alto desempenho" value={stats.altoDes} tone="success" />
        <KpiCard label="Em risco" value={stats.risco} tone="destructive" />
        <KpiCard label="Média desempenho" value={stats.mediaDes ? `${stats.mediaDes}/5` : "—"} />
      </div>

      {/* Filtros globais */}
      <Card>
        <CardContent className="py-3 px-4 flex flex-wrap items-center gap-3">
          <Label className="text-xs text-muted-foreground">Filtros:</Label>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Colaborador" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos colaboradores</SelectItem>
              {employees.map((e: any) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="nao_iniciado">Não iniciado</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="em_atraso">Em atraso</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
          {(employeeFilter !== "all" || statusFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setEmployeeFilter("all"); setStatusFilter("all"); }}>
              Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard"><LayoutDashboard size={14} className="mr-1" /> Dashboard</TabsTrigger>
          <TabsTrigger value="pdi"><Target size={14} className="mr-1" /> PDI</TabsTrigger>
          <TabsTrigger value="oneonone"><MessageCircle size={14} className="mr-1" /> One-on-One</TabsTrigger>
          <TabsTrigger value="9box"><Grid3X3 size={14} className="mr-1" /> Matriz 9 Box</TabsTrigger>
          <TabsTrigger value="bsc"><BarChart3 size={14} className="mr-1" /> BSC</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardView pdis={pdis} oneOnOnes={oneOnOnes} nineBox={nineBox} bscList={bscList} employeeMap={employeeMap} />
        </TabsContent>

        <TabsContent value="pdi">
          <PDITab pdis={pdis} employees={employees} employeeMap={employeeMap} />
        </TabsContent>

        <TabsContent value="oneonone">
          <OneOnOneTab list={oneOnOnes} employees={employees} employeeMap={employeeMap} />
        </TabsContent>

        <TabsContent value="9box">
          <NineBoxTab evaluations={nineBox} employees={employees} employeeMap={employeeMap} latest={latest9BoxMap} bscList={bscList} />
        </TabsContent>

        <TabsContent value="bsc">
          <BSCTab list={bscList} employees={employees} departments={departments} employeeMap={employeeMap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =================== Subcomponentes ===================
function KpiCard({ label, value, tone }: { label: string; value: any; tone?: "success" | "destructive" }) {
  const toneClass =
    tone === "success" ? "text-emerald-600" :
    tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function DashboardView({ pdis, oneOnOnes, nineBox, bscList, employeeMap }: any) {
  const today = new Date();
  const pdisAtraso = pdis.filter((p: HrPdi) => p.status === "em_atraso").slice(0, 5);
  const oneOnOnesAtrasadas = oneOnOnes.filter(
    (o: HrOneOnOne) => o.status === "agendada" && new Date(o.data_reuniao) < today
  ).slice(0, 5);
  const talentos = nineBox.filter((e: any) => e.quadrante === 9).slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="text-destructive" /> PDIs em atraso
          </h3>
          {pdisAtraso.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum PDI em atraso.</p> :
            pdisAtraso.map((p: HrPdi) => (
              <div key={p.id} className="text-sm flex justify-between border-b pb-2">
                <span>{employeeMap.get(p.employee_id)?.name || "—"}</span>
                <span className="text-xs text-muted-foreground">venc. {p.data_conclusao_prevista}</span>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MessageCircle size={16} className="text-amber-600" /> 1:1 atrasadas
          </h3>
          {oneOnOnesAtrasadas.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma reunião atrasada.</p> :
            oneOnOnesAtrasadas.map((o: HrOneOnOne) => (
              <div key={o.id} className="text-sm flex justify-between border-b pb-2">
                <span>{employeeMap.get(o.employee_id)?.name || "—"}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(o.data_reuniao), "dd/MM/yy")}</span>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" /> Talentos estratégicos
          </h3>
          {talentos.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum colaborador no quadrante 9.</p> :
            talentos.map((t: any) => (
              <div key={t.id} className="text-sm flex justify-between border-b pb-2">
                <span>{employeeMap.get(t.employee_id)?.name || "—"}</span>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Quad. 9</Badge>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-600" /> BSC ativos
          </h3>
          {bscList.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum BSC cadastrado.</p> :
            bscList.slice(0, 5).map((b: any) => (
              <div key={b.id} className="text-sm flex justify-between border-b pb-2">
                <span>{b.nome}</span>
                <span className="text-xs tabular-nums">{Math.round(Number(b.resultado_geral))}%</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ====== PDI ======
function PDITab({ pdis, employees, employeeMap }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HrPdi | null>(null);
  const { create, update, remove } = useMutatePDI();

  return (
    <div className="space-y-4">
      <PDICharts pdis={pdis} employeeMap={employeeMap} />
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex justify-between">
            <p className="text-sm text-muted-foreground">{pdis.length} PDI(s)</p>
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus size={14} className="mr-1" /> Novo PDI
            </Button>
          </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Evolução</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pdis.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum PDI cadastrado.</TableCell></TableRow>
            )}
            {pdis.map((p: HrPdi) => {
              const status = PDI_STATUS_META[p.status];
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{employeeMap.get(p.employee_id)?.name || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{p.objetivo}</TableCell>
                  <TableCell>{p.competencia || "—"}</TableCell>
                  <TableCell className="text-xs">{p.data_conclusao_prevista || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <Progress value={Number(p.percentual_evolucao)} className="h-1.5 flex-1" />
                      <span className="text-xs tabular-nums">{Math.round(Number(p.percentual_evolucao))}%</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={status.class}>{status.label}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm("Excluir este PDI?")) remove.mutate(p.id, { onSuccess: () => toast.success("PDI excluído") });
                    }}>Excluir</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <PDIDialog open={open} onOpenChange={setOpen} editing={editing} employees={employees} onSave={async (data) => {
          if (editing) {
            await update.mutateAsync({ id: editing.id, ...data } as any);
            toast.success("PDI atualizado");
          } else {
            await create.mutateAsync(data as any);
            toast.success("PDI criado");
          }
          setOpen(false);
        }} />
        </CardContent>
      </Card>
    </div>
  );
}

function PDIDialog({ open, onOpenChange, editing, employees, onSave }: any) {
  const [employeeId, setEmployeeId] = useState(editing?.employee_id || "");
  const [objetivo, setObjetivo] = useState(editing?.objetivo || "");
  const [competencia, setCompetencia] = useState(editing?.competencia || "");
  const [justificativa, setJustificativa] = useState(editing?.justificativa || "");
  const [dataPrevista, setDataPrevista] = useState(editing?.data_conclusao_prevista || "");
  const [status, setStatus] = useState(editing?.status || "nao_iniciado");

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setEmployeeId(""); setObjetivo(""); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar PDI" : "Novo PDI"}</DialogTitle>
          <DialogDescription>Plano de Desenvolvimento Individual</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Colaborador *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Objetivo principal *</Label>
            <Textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Competência</Label>
              <Input value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Justificativa</Label>
            <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PDI_STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!employeeId || !objetivo} onClick={() => onSave({
            employee_id: employeeId, objetivo, competencia, justificativa,
            data_conclusao_prevista: dataPrevista || null, status,
          })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ====== One-on-One ======
function OneOnOneTab({ list, employees, employeeMap }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HrOneOnOne | null>(null);
  const { create, update, remove } = useMutateOneOnOne();

  return (
    <div className="space-y-4">
      <OneOnOneCharts list={list} employeeMap={employeeMap} />
      <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex justify-between">
          <p className="text-sm text-muted-foreground">{list.length} reunião(ões)</p>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus size={14} className="mr-1" /> Nova One-on-One
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pauta</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma reunião cadastrada.</TableCell></TableRow>
            )}
            {list.map((o: HrOneOnOne) => {
              const status = ONE_ON_ONE_STATUS_META[o.status];
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{employeeMap.get(o.employee_id)?.name || "—"}</TableCell>
                  <TableCell className="text-xs">{format(new Date(o.data_reuniao), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                  <TableCell className="text-xs">{o.tipo}</TableCell>
                  <TableCell><Badge variant="outline" className={status.class}>{status.label}</Badge></TableCell>
                  <TableCell className="max-w-xs truncate text-xs">{o.pauta || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(o); setOpen(true); }}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm("Excluir esta reunião?")) remove.mutate(o.id, { onSuccess: () => toast.success("Reunião excluída") });
                    }}>Excluir</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <OneOnOneDialog open={open} onOpenChange={setOpen} editing={editing} employees={employees} onSave={async (data) => {
          if (editing) {
            await update.mutateAsync({ id: editing.id, ...data } as any);
            toast.success("Reunião atualizada");
          } else {
            await create.mutateAsync(data as any);
            toast.success("Reunião criada");
          }
          setOpen(false);
        }} />
      </CardContent>
      </Card>
    </div>
  );
}

function OneOnOneDialog({ open, onOpenChange, editing, employees, onSave }: any) {
  const [employeeId, setEmployeeId] = useState(editing?.employee_id || "");
  const [data, setData] = useState(editing?.data_reuniao?.slice(0, 16) || "");
  const [tipo, setTipo] = useState(editing?.tipo || "mensal");
  const [status, setStatus] = useState(editing?.status || "agendada");
  const [pauta, setPauta] = useState(editing?.pauta || "");
  const [pontos, setPontos] = useState(editing?.pontos_discutidos || "");
  const [decisoes, setDecisoes] = useState(editing?.decisoes || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{editing ? "Editar reunião" : "Nova One-on-One"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Colaborador *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data e hora *</Label><Input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="extraordinaria">Extraordinária</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ONE_ON_ONE_STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Pauta</Label><Textarea value={pauta} onChange={(e) => setPauta(e.target.value)} rows={2} /></div>
          <div><Label>Pontos discutidos</Label><Textarea value={pontos} onChange={(e) => setPontos(e.target.value)} rows={2} /></div>
          <div><Label>Decisões</Label><Textarea value={decisoes} onChange={(e) => setDecisoes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!employeeId || !data} onClick={() => onSave({
            employee_id: employeeId, data_reuniao: new Date(data).toISOString(),
            tipo, status, pauta, pontos_discutidos: pontos, decisoes,
          })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ====== 9 Box ======
function NineBoxTab({ evaluations, employees, employeeMap, latest, bscList }: any) {
  const [open, setOpen] = useState(false);
  const { create, remove } = useMutateNineBox();

  // Agrupa por quadrante
  const byQuadrant = useMemo(() => {
    const groups = new Map<number, any[]>();
    for (let q = 1; q <= 9; q++) groups.set(q, []);
    for (const ev of latest.values()) {
      if (ev.quadrante) groups.get(ev.quadrante)!.push(ev);
    }
    return groups;
  }, [latest]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{evaluations.length} avaliação(ões) — última por colaborador é exibida na matriz.</p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} className="mr-1" /> Nova Avaliação 9 Box
          </Button>
        </CardContent>
      </Card>

      {/* Matriz visual 3x3 */}
      <div className="grid grid-cols-3 gap-3">
        {/* Linha potencial alto: Q7, Q8, Q9 */}
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((q) => {
          const meta = QUADRANT_META[q];
          const tone = QUADRANT_TONE_CLASS[meta.tone];
          const items = byQuadrant.get(q) || [];
          return (
            <Card key={q} className={`border ${tone}`}>
              <CardContent className="pt-3 space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-semibold">Q{q} · {meta.short}</p>
                  <Badge variant="outline" className="text-[10px] py-0 h-4">{items.length}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{meta.description}</p>
                <div className="space-y-1">
                  {items.slice(0, 4).map((ev: any) => (
                    <p key={ev.id} className="text-xs truncate">{employeeMap.get(ev.employee_id)?.name || "—"}</p>
                  ))}
                  {items.length > 4 && <p className="text-[10px] text-muted-foreground">+{items.length - 4} mais</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabela detalhada */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Desempenho</TableHead>
                <TableHead>Potencial</TableHead>
                <TableHead>Quadrante</TableHead>
                <TableHead>Recomendação</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma avaliação ainda.</TableCell></TableRow>
              )}
              {evaluations.map((ev: any) => (
                <TableRow key={ev.id}>
                  <TableCell className="font-medium">{employeeMap.get(ev.employee_id)?.name || "—"}</TableCell>
                  <TableCell className="text-xs">{ev.data_avaliacao}</TableCell>
                  <TableCell className="text-xs">{ev.nota_desempenho} ({ev.nivel_desempenho})</TableCell>
                  <TableCell className="text-xs">{ev.nota_potencial} ({ev.nivel_potencial})</TableCell>
                  <TableCell><Badge variant="outline">Q{ev.quadrante}</Badge></TableCell>
                  <TableCell className="text-xs">{ev.recomendacao}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm("Excluir avaliação?")) remove.mutate(ev.id, { onSuccess: () => toast.success("Excluída") });
                    }}>Excluir</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NineBoxDialog open={open} onOpenChange={setOpen} employees={employees} bscList={bscList} onSave={async (data) => {
        await create.mutateAsync(data);
        toast.success("Avaliação criada");
        setOpen(false);
      }} />
    </div>
  );
}

function NineBoxDialog({ open, onOpenChange, employees, bscList, onSave }: any) {
  const [employeeId, setEmployeeId] = useState("");
  const [notaDes, setNotaDes] = useState(3);
  const [notaPot, setNotaPot] = useState(3);
  const [justif, setJustif] = useState("");
  const [recomendacao, setRecomendacao] = useState("manter");

  // Sugestão a partir do BSC do colaborador (último ativo)
  const suggestedBsc = useMemo(() => {
    if (!employeeId) return null;
    const empBsc = bscList.find((b: any) => b.employee_id === employeeId && b.status === "ativo");
    if (!empBsc) return null;
    // Converte resultado_geral (0-100+) em nota 1-5
    const pct = Number(empBsc.resultado_geral);
    const nota = Math.max(1, Math.min(5, Math.round((pct / 100) * 5 * 10) / 10));
    return { bsc: empBsc, nota };
  }, [employeeId, bscList]);

  const quadrante = quadrantFrom(notaDes, notaPot);
  const meta = QUADRANT_META[quadrante];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova avaliação 9 Box</DialogTitle>
          <DialogDescription>Notas 1–5 (1-2 baixo · 3 médio · 4-5 alto)</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Colaborador *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {suggestedBsc && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
              <p>BSC ativo "<span className="font-semibold">{suggestedBsc.bsc.nome}</span>" sugere desempenho <span className="font-semibold">{suggestedBsc.nota}</span>.</p>
              <Button size="sm" variant="outline" onClick={() => setNotaDes(suggestedBsc.nota)}>Aplicar sugestão</Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nota desempenho (1–5) *</Label>
              <Input type="number" min={1} max={5} step={0.5} value={notaDes} onChange={(e) => setNotaDes(Number(e.target.value))} />
            </div>
            <div>
              <Label>Nota potencial (1–5) *</Label>
              <Input type="number" min={1} max={5} step={0.5} value={notaPot} onChange={(e) => setNotaPot(Number(e.target.value))} />
            </div>
          </div>
          <div className={`rounded-md border p-3 ${QUADRANT_TONE_CLASS[meta.tone]}`}>
            <p className="text-xs font-semibold">Quadrante {quadrante} · {meta.label}</p>
            <p className="text-[11px] mt-1">{meta.description}</p>
          </div>
          <div>
            <Label>Recomendação</Label>
            <Select value={recomendacao} onValueChange={setRecomendacao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manter">Manter</SelectItem>
                <SelectItem value="desenvolver">Desenvolver</SelectItem>
                <SelectItem value="promover">Promover</SelectItem>
                <SelectItem value="realocar">Realocar</SelectItem>
                <SelectItem value="acompanhar">Acompanhar</SelectItem>
                <SelectItem value="desligamento_em_analise">Desligamento em análise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Justificativa</Label><Textarea value={justif} onChange={(e) => setJustif(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!employeeId} onClick={() => onSave({
            employee_id: employeeId,
            nota_desempenho: notaDes,
            nota_potencial: notaPot,
            justificativa: justif,
            recomendacao,
            bsc_score_snapshot: suggestedBsc?.bsc?.resultado_geral || null,
          })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ====== BSC ======
function BSCTab({ list, employees, departments, employeeMap }: any) {
  const [open, setOpen] = useState(false);
  const { create, remove } = useMutateBSC();

  return (
    <div className="space-y-4">
      <BSCCharts list={list} employeeMap={employeeMap} departments={departments} />
      <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex justify-between">
          <p className="text-sm text-muted-foreground">{list.length} scorecard(s)</p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} className="mr-1" /> Novo BSC
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Vínculo</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum BSC cadastrado.</TableCell></TableRow>
            )}
            {list.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.nome}</TableCell>
                <TableCell className="text-xs">{b.tipo}</TableCell>
                <TableCell className="text-xs">
                  {b.tipo === "individual" && (employeeMap.get(b.employee_id)?.name || "—")}
                  {b.tipo === "departamento" && (departments.find((d: any) => d.id === b.department_id)?.name || "—")}
                  {b.tipo === "empresa" && "Toda a empresa"}
                </TableCell>
                <TableCell className="text-xs">{b.periodo_inicio} → {b.periodo_fim}</TableCell>
                <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                <TableCell className="text-xs tabular-nums">{Math.round(Number(b.resultado_geral))}%</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (confirm("Excluir BSC?")) remove.mutate(b.id, { onSuccess: () => toast.success("BSC excluído") });
                  }}>Excluir</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <BSCDialog open={open} onOpenChange={setOpen} employees={employees} departments={departments} onSave={async (data) => {
          await create.mutateAsync(data);
          toast.success("BSC criado");
          setOpen(false);
        }} />
      </CardContent>
    </Card>
    </div>
  );
}

function BSCDialog({ open, onOpenChange, employees, departments, onSave }: any) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("individual");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [pi, setPi] = useState("");
  const [pf, setPf] = useState("");
  const [status, setStatus] = useState("em_elaboracao");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo BSC</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="departamento">Departamento</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipo === "individual" && (
            <div>
              <Label>Colaborador *</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {tipo === "departamento" && (
            <div>
              <Label>Departamento *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {departments.length === 0 && <SelectItem value="__empty" disabled>Cadastre um departamento primeiro</SelectItem>}
                  {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início *</Label><Input type="date" value={pi} onChange={(e) => setPi(e.target.value)} /></div>
            <div><Label>Fim *</Label><Input type="date" value={pf} onChange={(e) => setPf(e.target.value)} /></div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="em_elaboracao">Em elaboração</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!nome || !pi || !pf || (tipo === "individual" && !employeeId) || (tipo === "departamento" && !departmentId)}
            onClick={() => onSave({
              nome, tipo, periodo_inicio: pi, periodo_fim: pf, status,
              employee_id: tipo === "individual" ? employeeId : null,
              department_id: tipo === "departamento" ? departmentId : null,
            })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
