import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Rocket, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { format } from "date-fns";
import { OnboardingConfigTab } from "@/components/onboarding-guiado/OnboardingConfigTab";

interface OrgOnboarding {
  id: string;
  organization_id: string;
  current_step: number;
  completed_steps: number[];
  maturity_level: number | null;
  maturity_score: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  org_name?: string;
}

const STEP_NAMES = [
  "", "Diagnóstico", "Estrutura", "Integrações", "Financeiro", "Contratos",
  "Planejamento", "Rotinas", "Cockpit", "Assistida", "Score",
];

function scoreBadge(score: string | null) {
  if (!score) return null;
  const colors: Record<string, string> = {
    Bronze: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    Prata: "bg-slate-400/10 text-slate-500 border-slate-400/30",
    Ouro: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    "Board Ready": "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  };
  return <Badge variant="outline" className={colors[score] || ""}>{score}</Badge>;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    em_andamento: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    concluido: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    pausado: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  };
  const labels: Record<string, string> = {
    em_andamento: "Em andamento", concluido: "Concluído", pausado: "Pausado",
  };
  return <Badge variant="outline" className={colors[status] || ""}>{labels[status] || status}</Badge>;
}

function TrackingTab() {
  const [data, setData] = useState<OrgOnboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data: progressData } = await supabase
        .from("onboarding_progress" as any).select("*").order("started_at", { ascending: false });
      if (!progressData) { setLoading(false); return; }
      const orgIds = (progressData as any[]).map((p: any) => p.organization_id);
      const { data: orgs } = await supabase
        .from("organizations" as any).select("id, name").in("id", orgIds);
      const orgMap = new Map((orgs as any[] || []).map((o: any) => [o.id, o.name]));
      setData((progressData as any[]).map((p: any) => ({ ...p, org_name: orgMap.get(p.organization_id) || "—" })));
      setLoading(false);
    }
    fetch();
  }, []);

  const filtered = filter === "all" ? data : data.filter((d) => d.status === filter);
  const stats = { total: data.length, em_andamento: data.filter((d) => d.status === "em_andamento").length, concluido: data.filter((d) => d.status === "concluido").length };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total</p><p className="text-3xl font-bold text-foreground">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Em andamento</p><p className="text-3xl font-bold text-blue-600">{stats.em_andamento}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Concluídos</p><p className="text-3xl font-bold text-emerald-600">{stats.concluido}</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="pausado">Pausado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead><TableHead>Etapa Atual</TableHead><TableHead>Progresso</TableHead>
                <TableHead>Maturidade</TableHead><TableHead>Score</TableHead><TableHead>Status</TableHead>
                <TableHead>Início</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum onboarding encontrado</TableCell></TableRow>
              )}
              {filtered.map((item) => {
                const pct = Math.round((item.completed_steps.length / 10) * 100);
                const isExpanded = expandedId === item.id;
                return (
                  <>
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                      <TableCell className="font-medium">{item.org_name}</TableCell>
                      <TableCell>{STEP_NAMES[item.current_step] || item.current_step}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress value={pct} className="h-2 flex-1" /><span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.maturity_level ? <Badge variant="outline">Nível {item.maturity_level}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                      <TableCell>{scoreBadge(item.maturity_score) || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                      <TableCell>{statusBadge(item.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(item.started_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${item.id}-detail`}>
                        <TableCell colSpan={8} className="bg-muted/30">
                          <div className="py-3 px-2">
                            <p className="text-sm font-medium mb-3">Etapas concluídas:</p>
                            <div className="flex flex-wrap gap-2">
                              {Array.from({ length: 10 }, (_, i) => i + 1).map((step) => (
                                <Badge key={step} variant={item.completed_steps.includes(step) ? "default" : "outline"} className="text-xs">
                                  {step}. {STEP_NAMES[step]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BackofficeOnboarding() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Rocket size={24} className="text-primary" /> Gestão de Onboarding
        </h1>
        <p className="text-muted-foreground mt-1">Acompanhe a implantação e configure as etapas</p>
      </div>

      <Tabs defaultValue="acompanhamento">
        <TabsList>
          <TabsTrigger value="acompanhamento"><Rocket size={14} className="mr-1" /> Acompanhamento</TabsTrigger>
          <TabsTrigger value="configuracao"><Settings size={14} className="mr-1" /> Configuração</TabsTrigger>
        </TabsList>
        <TabsContent value="acompanhamento"><TrackingTab /></TabsContent>
        <TabsContent value="configuracao"><OnboardingConfigTab /></TabsContent>
      </Tabs>
    </div>
  );
}
