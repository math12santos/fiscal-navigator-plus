import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { useDPBenefits, useMutateDPBenefit } from "@/hooks/useDPBenefits";
import { useEmployees } from "@/hooks/useDP";
import { useEmployeeBenefits } from "@/hooks/useDPBenefits";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DPExportButton } from "./DPExportButton";
import { generateDPExcelReport } from "@/lib/dpExports";

const BENEFIT_TYPES = [
  { value: "fixo", label: "Valor Fixo (R$/mês)" },
  { value: "percentual", label: "Percentual do Salário (%)" },
  { value: "por_dia", label: "Valor por Dia Útil (R$/dia)" },
];

export default function DPBeneficios() {
  const { data: benefits = [], isLoading } = useDPBenefits();
  const { create, update, remove } = useMutateDPBenefit();
  const { data: employees = [] } = useEmployees();
  const { data: empBenefits = [] } = useEmployeeBenefits();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", type: "fixo", default_value: "", description: "" });

  const filtered = useMemo(() => {
    return benefits.filter((b: any) => !search || b.name.toLowerCase().includes(search.toLowerCase()));
  }, [benefits, search]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", type: "fixo", default_value: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (b: any) => {
    setEditing(b);
    setForm({ name: b.name, type: b.type, default_value: String(b.default_value), description: b.description || "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = { ...form, default_value: Number(form.default_value) || 0 };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, {
        onSuccess: () => { toast({ title: "Benefício atualizado" }); setDialogOpen(false); },
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => { toast({ title: "Benefício cadastrado" }); setDialogOpen(false); },
      });
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Deseja realmente excluir este benefício?")) return;
    remove.mutate(id, { onSuccess: () => toast({ title: "Benefício removido" }) });
  };

  const fmtValue = (b: any) => {
    if (b.type === "percentual") return `${Number(b.default_value).toFixed(1)}%`;
    if (b.type === "por_dia") {
      return `${Number(b.default_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/dia`;
    }
    return Number(b.default_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const typeLabel = (t: string) =>
    t === "percentual" ? "Percentual" : t === "por_dia" ? "Por dia útil" : "Valor Fixo";

  const handleExportMatrix = () => {
    const activeEmps = employees.filter((e: any) => e.status === "ativo");
    const activeBenefits = benefits.filter((b: any) => b.active);

    const matrixHeader = ["Colaborador", "Salário Base", ...activeBenefits.map((b: any) => b.name), "Custo Total Mensal"];
    const matrixRows = activeEmps.map((emp: any) => {
      const sal = Number(emp.salary_base || 0);
      let totalEmp = 0;
      const cells = activeBenefits.map((b: any) => {
        const link = empBenefits.find((eb: any) => eb.employee_id === emp.id && eb.benefit_id === b.id && eb.active);
        if (!link) return "";
        const valor = link.custom_value != null ? Number(link.custom_value) : Number(b.default_value);
        const custo = b.type === "percentual" ? sal * (valor / 100) : valor;
        totalEmp += custo;
        return custo;
      });
      return [emp.name, sal, ...cells, totalEmp];
    });

    generateDPExcelReport({
      title: `Beneficios ${currentOrg?.name || ""}`.trim(),
      sheets: [
        {
          name: "Matriz Colab x Benefício",
          rows: [matrixHeader, ...matrixRows],
        },
        {
          name: "Cadastro",
          rows: [
            ["Nome", "Tipo", "Valor Padrão", "Ativo", "Descrição"],
            ...benefits.map((b: any) => [
              b.name,
              b.type === "percentual" ? "Percentual" : "Valor Fixo",
              Number(b.default_value),
              b.active ? "Sim" : "Não",
              b.description || "",
            ]),
          ],
        },
      ],
    });
    toast({ title: "Matriz de benefícios exportada" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input placeholder="Buscar benefício..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <DPExportButton onExcel={handleExportMatrix} disabled={benefits.length === 0} />
        <Button onClick={openNew}><Plus size={14} className="mr-1" /> Novo Benefício</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum benefício cadastrado</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor Padrão</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium text-foreground">{b.name}</TableCell>
                  <TableCell><Badge variant="outline">{typeLabel(b.type)}</Badge></TableCell>
                  <TableCell className="font-mono text-foreground">{fmtValue(b)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{b.description || "—"}</TableCell>
                  <TableCell><Badge variant={b.active ? "default" : "secondary"}>{b.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}><Edit2 size={13} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(b.id)}><Trash2 size={13} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Benefício" : "Novo Benefício"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Vale Refeição" /></div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BENEFIT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>
                {form.type === "percentual"
                  ? "Percentual Padrão (%)"
                  : form.type === "por_dia"
                  ? "Valor por Dia Útil (R$/dia)"
                  : "Valor Padrão Mensal (R$)"}
              </Label>
              <Input type="number" value={form.default_value} onChange={(e) => setForm({ ...form, default_value: e.target.value })} />
              {form.type === "por_dia" && (
                <p className="text-[10px] text-muted-foreground">
                  O custo mensal será calculado automaticamente: valor por dia × dias úteis efetivos do mês.
                </p>
              )}
            </div>
            <div className="space-y-1"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || create.isPending || update.isPending}>
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
