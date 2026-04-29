import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Edit2, Trash2, UserMinus, TrendingUp, FileUp } from "lucide-react";
import TerminationSimulatorDialog from "./TerminationSimulatorDialog";
import { EmployeeDossierDrawer } from "./EmployeeDossierDrawer";
import MassAdjustmentDialog from "./MassAdjustmentDialog";
import EmployeeImportDialog from "./EmployeeImportDialog";
import { useEmployees, useMutateEmployee, useDPConfig, calcEncargosPatronais } from "@/hooks/useDP";
import { usePositions } from "@/hooks/useDP";
import { useBusinessDaysForMonth } from "@/hooks/useBusinessDays";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useDPBenefits, useEmployeeBenefits, useMutateEmployeeBenefit } from "@/hooks/useDPBenefits";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DPExportButton } from "./DPExportButton";
import { generateDPExcelReport } from "@/lib/dpExports";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ativo: { label: "Ativo", variant: "default" },
  afastado: { label: "Afastado", variant: "secondary" },
  desligado: { label: "Desligado", variant: "destructive" },
};

const CONTRACT_TYPES = [
  { value: "CLT", label: "CLT" },
  { value: "PJ", label: "PJ" },
  { value: "estagio", label: "Estágio" },
  { value: "intermitente", label: "Intermitente" },
];

export default function DPColaboradores() {
  const { data: employees = [], isLoading } = useEmployees();
  const { data: positions = [] } = usePositions();
  const { costCenters = [] } = useCostCenters();
  const { create, update, remove } = useMutateEmployee();
  const { data: dpConfig } = useDPConfig();
  const { data: allBenefits = [] } = useDPBenefits();
  const { data: allEmployeeBenefits = [] } = useEmployeeBenefits();
  const { assign: assignBenefits } = useMutateEmployeeBenefit();
  const { toast } = useToast();
  const { currentOrg } = useOrganization();
  const businessDaysInfo = useBusinessDaysForMonth(new Date());
  const DIAS_UTEIS_MES = businessDaysInfo.days;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [terminateEmpId, setTerminateEmpId] = useState<string | null>(null);
  const [dossierEmp, setDossierEmp] = useState<any | null>(null);
  const [massOpen, setMassOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", cpf: "", email: "", phone: "",
    admission_date: "", contract_type: "CLT",
    salary_base: "", workload_hours: "44",
    position_id: "", cost_center_id: "", status: "ativo", notes: "",
    comissao_tipo: "nenhuma", comissao_valor: "",
    vt_ativo: false, vt_diario: "",
  });
  const [selectedBenefitIds, setSelectedBenefitIds] = useState<string[]>([]);
  // Map benefit_id -> custom_value (used for plano_saude where each employee has own price)
  const [benefitCustomValues, setBenefitCustomValues] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    return employees.filter((e: any) => {
      const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || (e.cpf || "").includes(search);
      const matchStatus = statusFilter === "__all__" || e.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [employees, search, statusFilter]);

  const posMap = useMemo(() => {
    const m: Record<string, string> = {};
    positions.forEach((p: any) => { m[p.id] = p.name; });
    return m;
  }, [positions]);

  const ccMap = useMemo(() => {
    const m: Record<string, string> = {};
    costCenters.forEach((c: any) => { m[c.id] = c.name; });
    return m;
  }, [costCenters]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", cpf: "", email: "", phone: "", admission_date: "", contract_type: "CLT", salary_base: "", workload_hours: "44", position_id: "", cost_center_id: "", status: "ativo", notes: "", comissao_tipo: "nenhuma", comissao_valor: "", vt_ativo: false, vt_diario: "" });
    setSelectedBenefitIds([]);
    setDialogOpen(true);
  };

  const openEdit = (e: any) => {
    setEditing(e);
    setForm({
      name: e.name, cpf: e.cpf || "", email: e.email || "", phone: e.phone || "",
      admission_date: e.admission_date, contract_type: e.contract_type,
      salary_base: String(e.salary_base), workload_hours: String(e.workload_hours || 44),
      position_id: e.position_id || "", cost_center_id: e.cost_center_id || "",
      status: e.status, notes: e.notes || "",
      comissao_tipo: e.comissao_tipo || "nenhuma", comissao_valor: String(e.comissao_valor || ""),
      vt_ativo: e.vt_ativo || false, vt_diario: String(e.vt_diario || ""),
    });
    const empBenefits = allEmployeeBenefits.filter((eb: any) => eb.employee_id === e.id);
    setSelectedBenefitIds(empBenefits.map((eb: any) => eb.benefit_id));
    setDialogOpen(true);
  };

  const handleSave = () => {
    const { vt_ativo, vt_diario, ...rest } = form;
    const payload = {
      ...rest,
      salary_base: Number(rest.salary_base) || 0,
      workload_hours: Number(rest.workload_hours) || 44,
      position_id: rest.position_id && rest.position_id !== "__none__" ? rest.position_id : null,
      cost_center_id: rest.cost_center_id && rest.cost_center_id !== "__none__" ? rest.cost_center_id : null,
      comissao_valor: Number(rest.comissao_valor) || 0,
      vt_ativo,
      vt_diario: Number(vt_diario) || 0,
    };

    const saveBenefits = async (employeeId: string) => {
      // Sincronização completa em 2 etapas:
      // 1) Remove vínculos desmarcados explicitamente.
      // 2) Remove vínculos pré-existentes que conflitem por CATEGORIA com algum
      //    benefício recém-adicionado (exceto categoria "outros"), evitando
      //    a violação do trigger trg_unique_employee_benefit_category.
      const current = allEmployeeBenefits.filter((eb: any) => eb.employee_id === employeeId);

      const explicitRemove = current.filter((eb: any) => !selectedBenefitIds.includes(eb.benefit_id));

      const toAdd = selectedBenefitIds.filter(
        (bid) => !current.some((eb: any) => eb.benefit_id === bid),
      );

      // Categorias dos benefícios novos (ignorando "outros")
      const incomingCategories = new Set(
        toAdd
          .map((bid) => allBenefits.find((b: any) => b.id === bid))
          .filter((b: any) => b && (b.category || "outros") !== "outros")
          .map((b: any) => b.category),
      );

      // Conflitos implícitos: vínculos atuais que ficam, mas pertencem a categoria
      // de um novo (e não foram explicitamente desmarcados nem estão em explicitRemove).
      const implicitRemove = current.filter((eb: any) => {
        if (explicitRemove.some((r: any) => r.id === eb.id)) return false;
        if (toAdd.includes(eb.benefit_id)) return false;
        const benefit = allBenefits.find((b: any) => b.id === eb.benefit_id);
        const cat = benefit?.category || "outros";
        return incomingCategories.has(cat);
      });

      const allRemove = [...explicitRemove, ...implicitRemove];
      const removedNames = implicitRemove
        .map((eb: any) => allBenefits.find((b: any) => b.id === eb.benefit_id)?.name)
        .filter(Boolean);

      try {
        if (allRemove.length > 0) {
          const { error: delErr } = await supabase
            .from("employee_benefits")
            .delete()
            .in("id", allRemove.map((eb: any) => eb.id));
          if (delErr) throw delErr;
        }
        if (toAdd.length > 0) {
          await assignBenefits.mutateAsync(
            toAdd.map((bid) => ({ employee_id: employeeId, benefit_id: bid })),
          );
        }
        if (removedNames.length > 0) {
          toast({
            title: "Benefícios sincronizados",
            description: `Substituído(s) automaticamente por categoria: ${removedNames.join(", ")}.`,
          });
        }
      } catch (err: any) {
        toast({
          title: "Erro ao salvar benefícios",
          description: err?.message || "Verifique se há benefícios duplicados na mesma categoria.",
          variant: "destructive",
        });
      }
    };

    if (editing) {
      update.mutate({ id: editing.id, ...payload }, {
        onSuccess: async () => { toast({ title: "Colaborador atualizado" }); await saveBenefits(editing.id); setDialogOpen(false); },
      });
    } else {
      create.mutate(payload, {
        onSuccess: async (data: any) => {
          toast({ title: "Colaborador cadastrado" });
          if (data?.id) await saveBenefits(data.id);
          setDialogOpen(false);
        },
      });
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Deseja realmente excluir este colaborador?")) return;
    remove.mutate(id, { onSuccess: () => toast({ title: "Colaborador removido" }) });
  };

  const handleExportExcel = () => {
    const benefitsByEmp: Record<string, string[]> = {};
    allEmployeeBenefits.forEach((eb: any) => {
      if (!eb.active) return;
      const benefit = allBenefits.find((b: any) => b.id === eb.benefit_id);
      if (!benefit) return;
      if (!benefitsByEmp[eb.employee_id]) benefitsByEmp[eb.employee_id] = [];
      benefitsByEmp[eb.employee_id].push(benefit.name);
    });

    generateDPExcelReport({
      title: `Colaboradores ${currentOrg?.name || ""}`.trim(),
      sheets: [
        {
          name: "Colaboradores",
          rows: [
            [
              "Nome", "CPF", "Email", "Telefone", "Cargo", "Tipo Contrato",
              "Salário Base", "Jornada (h/sem)", "Centro de Custo", "Status",
              "Admissão", "Comissão Tipo", "Comissão Valor",
              "VT Ativo", "VT Diário", "Encargos Estimados", "Custo Total Estimado",
              "Benefícios", "Observações",
            ],
            ...filtered.map((e: any) => {
              const sal = Number(e.salary_base || 0);
              const enc = calcEncargosPatronais(sal, dpConfig, e.contract_type);
              return [
                e.name, e.cpf || "", e.email || "", e.phone || "",
                posMap[e.position_id] || "", e.contract_type,
                sal, e.workload_hours || 44, ccMap[e.cost_center_id] || "",
                e.status, e.admission_date,
                e.comissao_tipo || "nenhuma", Number(e.comissao_valor || 0),
                e.vt_ativo ? "Sim" : "Não", Number(e.vt_diario || 0),
                enc.total, sal + enc.total,
                (benefitsByEmp[e.id] || []).join(", "),
                e.notes || "",
              ];
            }),
          ],
        },
      ],
    });
    toast({ title: "Lista exportada" });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="afastado">Afastados</SelectItem>
            <SelectItem value="desligado">Desligados</SelectItem>
          </SelectContent>
        </Select>
        <DPExportButton onExcel={handleExportExcel} disabled={filtered.length === 0} />
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <FileUp size={14} className="mr-1" /> Importar CSV
        </Button>
        <Button variant="outline" onClick={() => setMassOpen(true)}>
          <TrendingUp size={14} className="mr-1" /> Reajuste em massa
        </Button>
        <Button onClick={openNew}><Plus size={14} className="mr-1" /> Novo Colaborador</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum colaborador encontrado</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Salário Base</TableHead>
                <TableHead>VT</TableHead>
                <TableHead>Custo Total</TableHead>
                <TableHead>Custo Diário</TableHead>
                <TableHead>Centro de Custo</TableHead>
                <TableHead>Admissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e: any) => {
                const st = STATUS_MAP[e.status] || STATUS_MAP.ativo;
                const salario = Number(e.salary_base || 0);
                const encargos = calcEncargosPatronais(salario, dpConfig, e.contract_type);
                const vtDiario = Number(e.vt_diario || 0);
                const vtMensal = e.vt_ativo ? vtDiario * DIAS_UTEIS_MES : 0;
                const vtDesconto = e.vt_ativo ? salario * 0.06 : 0;
                const custoVTLiquido = Math.max(vtMensal - vtDesconto, 0);
                const custoTotal = salario + encargos.total + custoVTLiquido;
                const custoDiario = custoTotal / 30;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <button
                        className="font-medium text-foreground hover:text-primary hover:underline text-left"
                        onClick={() => setDossierEmp(e)}
                      >
                        {e.name}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{posMap[e.position_id] || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{e.contract_type}</Badge></TableCell>
                    <TableCell className="font-mono text-foreground">{fmt(salario)}</TableCell>
                    <TableCell>{e.vt_ativo ? <Badge variant="default" className="text-xs">R$ {vtDiario.toFixed(2)}/dia</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell className="font-mono text-foreground">{fmt(custoTotal)}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{fmt(custoDiario)}</TableCell>
                    <TableCell className="text-muted-foreground">{ccMap[e.cost_center_id] || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{format(new Date(e.admission_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)} title="Editar"><Edit2 size={13} /></Button>
                        {e.status === "ativo" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setTerminateEmpId(e.id)}
                            title="Demitir"
                          >
                            <UserMinus size={13} />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e.id)} title="Excluir"><Trash2 size={13} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>Nome Completo</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
              <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-1"><Label>Data de Admissão</Label><Input type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Tipo de Contrato</Label>
                <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTRACT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Salário Base (R$)</Label><Input type="number" value={form.salary_base} onChange={(e) => setForm({ ...form, salary_base: e.target.value })} /></div>
              <div className="space-y-1"><Label>Jornada (horas/sem)</Label><Input type="number" value={form.workload_hours} onChange={(e) => setForm({ ...form, workload_hours: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Cargo</Label>
                <Select value={form.position_id} onValueChange={(v) => setForm({ ...form, position_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {positions.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Centro de Custo</Label>
                <Select value={form.cost_center_id} onValueChange={(v) => setForm({ ...form, cost_center_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {costCenters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editing && (
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="afastado">Afastado</SelectItem>
                      <SelectItem value="desligado">Desligado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Comissão */}
              <div className="space-y-1">
                <Label>Comissão</Label>
                <Select value={form.comissao_tipo} onValueChange={(v) => setForm({ ...form, comissao_tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Sem Comissão</SelectItem>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.comissao_tipo !== "nenhuma" && (
                <div className="space-y-1">
                  <Label>{form.comissao_tipo === "percentual" ? "Percentual (%)" : "Valor (R$)"}</Label>
                  <Input type="number" value={form.comissao_valor} onChange={(e) => setForm({ ...form, comissao_valor: e.target.value })} />
                </div>
              )}
              {/* Vale Transporte */}
              <div className="col-span-2 flex items-center gap-3 pt-1">
                <Checkbox
                  id="vt_ativo"
                  checked={form.vt_ativo}
                  onCheckedChange={(checked) => setForm({ ...form, vt_ativo: !!checked })}
                />
                <Label htmlFor="vt_ativo" className="cursor-pointer">Vale Transporte ativo (desconto de 6% do salário)</Label>
              </div>
              {form.vt_ativo && (
                <div className="space-y-1">
                  <Label>VT Diário (R$)</Label>
                  <Input type="number" value={form.vt_diario} onChange={(e) => setForm({ ...form, vt_diario: e.target.value })} placeholder="Ex: 12.00" />
                </div>
              )}
            </div>
            {/* Benefícios */}
            {allBenefits.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-semibold">Benefícios</Label>
                <p className="text-[10px] text-muted-foreground">
                  Cada colaborador só pode receber 1 benefício por categoria (exceto "Outros"). Selecionar outro da mesma categoria substitui o anterior.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {allBenefits.filter((b: any) => b.active).map((b: any) => {
                    const cat = b.category || "outros";
                    const isSelected = selectedBenefitIds.includes(b.id);
                    // Detecta conflito: outro benefício já selecionado, mesma categoria (não "outros"), e não é este
                    const conflictWith = !isSelected && cat !== "outros"
                      ? allBenefits.find((x: any) =>
                          x.id !== b.id &&
                          selectedBenefitIds.includes(x.id) &&
                          (x.category || "outros") === cat
                        )
                      : null;
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center gap-2 text-sm cursor-pointer rounded-md p-1.5 transition-colors ${
                          conflictWith ? "bg-warning/10 border border-warning/40" : "border border-transparent"
                        }`}
                        title={conflictWith ? `Selecionar irá substituir "${conflictWith.name}" (mesma categoria: ${cat})` : undefined}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            setSelectedBenefitIds((prev) => {
                              if (!checked) return prev.filter((id) => id !== b.id);
                              // Substituir outros benefícios da mesma categoria (exceto "outros")
                              if (cat === "outros") return [...prev, b.id];
                              const replaced = prev
                                .map((id) => allBenefits.find((x: any) => x.id === id))
                                .filter((x: any) => x && x.id !== b.id && (x.category || "outros") === cat);
                              const next = prev.filter((id) => {
                                const other = allBenefits.find((x: any) => x.id === id);
                                return (other?.category || "outros") !== cat;
                              });
                              if (replaced.length > 0) {
                                toast({
                                  title: "Benefício substituído",
                                  description: `"${b.name}" substituiu "${replaced.map((r: any) => r.name).join(", ")}" na categoria ${cat}.`,
                                });
                              }
                              return [...next, b.id];
                            });
                          }}
                        />
                        <span className={conflictWith ? "font-medium" : ""}>{b.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ({b.type === "percentual" ? `${b.default_value}%` : `R$ ${Number(b.default_value).toFixed(2)}`})
                        </span>
                        {conflictWith && (
                          <span className="ml-auto text-[10px] text-warning font-medium">
                            substitui {conflictWith.name}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.admission_date || create.isPending || update.isPending}>
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TerminationSimulatorDialog
        open={!!terminateEmpId}
        onOpenChange={(o) => { if (!o) setTerminateEmpId(null); }}
        initialEmployeeId={terminateEmpId || undefined}
      />

      <EmployeeDossierDrawer
        open={!!dossierEmp}
        onOpenChange={(o) => { if (!o) setDossierEmp(null); }}
        employee={dossierEmp}
      />

      <MassAdjustmentDialog
        open={massOpen}
        onOpenChange={setMassOpen}
      />

      <EmployeeImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  );
}
