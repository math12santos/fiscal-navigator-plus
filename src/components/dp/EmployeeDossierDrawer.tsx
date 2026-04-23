import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, FileText, AlertTriangle, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCompensations, usePayrollItems, usePayrollRuns, usePositions } from "@/hooks/useDP";
import { useCostCenters } from "@/hooks/useCostCenters";
import {
  useEmployeeDocuments,
  useUploadEmployeeDocument,
  useDeleteEmployeeDocument,
  getSignedDocumentUrl,
  DOC_TYPES,
  type DocType,
} from "@/hooks/useEmployeeDocuments";

interface DossierProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any | null;
}

export function EmployeeDossierDrawer({ open, onOpenChange, employee }: DossierProps) {
  const { toast } = useToast();
  const { data: compensations = [] } = useCompensations(employee?.id);
  const { data: documents = [] } = useEmployeeDocuments(employee?.id);
  const { data: positions = [] } = usePositions();
  const { costCenters = [] } = useCostCenters();
  const { data: runs = [] } = usePayrollRuns();
  const upload = useUploadEmployeeDocument();
  const remove = useDeleteEmployeeDocument();

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<DocType>("contrato");
  const [uploadExpires, setUploadExpires] = useState<string>("");
  const [uploadNotes, setUploadNotes] = useState<string>("");

  if (!employee) return null;

  const positionLabel = positions.find((p: any) => p.id === employee.position_id)?.name || "—";
  const ccLabel = costCenters.find((c: any) => c.id === employee.cost_center_id)?.name || "—";
  const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleUpload = () => {
    if (!uploadFile) return;
    upload.mutate(
      {
        employeeId: employee.id,
        file: uploadFile,
        docType: uploadType,
        expiresAt: uploadExpires || null,
        notes: uploadNotes || null,
      },
      {
        onSuccess: () => {
          toast({ title: "Documento enviado" });
          setUploadFile(null);
          setUploadExpires("");
          setUploadNotes("");
        },
        onError: (err: any) => toast({ title: "Falha no upload", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleDownload = async (doc: any) => {
    try {
      const url = await getSignedDocumentUrl(doc.file_path, 60);
      window.open(url, "_blank");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = (doc: any) => {
    if (!confirm(`Excluir "${doc.file_name}"?`)) return;
    remove.mutate(doc, { onSuccess: () => toast({ title: "Documento excluído" }) });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{employee.name}</SheetTitle>
          <SheetDescription>
            {positionLabel} • {ccLabel} • {employee.contract_type}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="dados" className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="salario">Salário</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="folha">Histórico</TabsTrigger>
          </TabsList>

          {/* Dados */}
          <TabsContent value="dados" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="CPF" value={employee.cpf || "—"} />
              <Field label="Email" value={employee.email || "—"} />
              <Field label="Telefone" value={employee.phone || "—"} />
              <Field
                label="Admissão"
                value={employee.admission_date ? format(new Date(employee.admission_date), "dd/MM/yyyy") : "—"}
              />
              <Field label="Contrato" value={employee.contract_type} />
              <Field label="Status" value={employee.status} />
              <Field label="Salário Base" value={fmt(Number(employee.salary_base || 0))} />
              <Field label="Jornada" value={`${employee.workload_hours || 44} h/sem`} />
              <Field label="VT Diário" value={employee.vt_ativo ? fmt(Number(employee.vt_diario || 0)) : "—"} />
              <Field label="Tempo de Casa" value={timeOfService(employee.admission_date)} />
            </div>
            {employee.notes && (
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Observações</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{employee.notes}</p>
              </div>
            )}
          </TabsContent>

          {/* Histórico salarial */}
          <TabsContent value="salario" className="space-y-2 mt-4">
            {compensations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem alterações salariais registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compensations.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{format(new Date(c.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{c.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{c.description}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(c.value || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Documentos */}
          <TabsContent value="documentos" className="space-y-3 mt-4">
            <Card>
              <CardContent className="p-3 space-y-2">
                <Label className="text-xs font-semibold">Enviar novo documento</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                  </div>
                  <Select value={uploadType} onValueChange={(v) => setUploadType(v as DocType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={uploadExpires}
                    onChange={(e) => setUploadExpires(e.target.value)}
                    placeholder="Validade (opcional)"
                  />
                  <Input
                    className="col-span-2"
                    placeholder="Observações (opcional)"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={handleUpload} disabled={!uploadFile || upload.isPending} className="w-full">
                  <Upload size={14} className="mr-1" /> {upload.isPending ? "Enviando..." : "Enviar"}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-1">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum documento enviado.</p>
              ) : (
                documents.map((d: any) => {
                  const expDays = d.expires_at ? differenceInDays(new Date(d.expires_at), new Date()) : null;
                  const expWarn = expDays != null && expDays < 30;
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 p-2 border border-border rounded-lg hover:bg-muted/30"
                    >
                      <FileText size={16} className="text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{d.file_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {DOC_TYPES.find((t) => t.value === d.doc_type)?.label || d.doc_type}
                          </Badge>
                          {d.expires_at && (
                            <span className={expWarn ? "text-warning flex items-center gap-1" : ""}>
                              {expWarn && <AlertTriangle size={11} />}
                              Vence {format(new Date(d.expires_at), "dd/MM/yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(d)}>
                        <Download size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(d)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Histórico de folha */}
          <TabsContent value="folha" className="mt-4">
            <PayrollHistory employeeId={employee.id} runs={runs} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}

function timeOfService(admission?: string) {
  if (!admission) return "—";
  const days = differenceInDays(new Date(), new Date(admission));
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) return `${years}a ${months}m`;
  return `${months} meses`;
}

function PayrollHistory({ employeeId, runs }: { employeeId: string; runs: any[] }) {
  // For each run, payroll items are loaded individually; we just show last 12.
  const last = runs.slice(0, 12);
  if (last.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Sem folhas registradas.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mês</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {last.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell className="text-sm">
              {format(new Date(r.reference_month), "MMMM/yyyy", { locale: ptBR })}
            </TableCell>
            <TableCell>
              <Badge variant={r.locked ? "secondary" : "outline"} className="text-xs">{r.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
