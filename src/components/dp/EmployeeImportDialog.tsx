/**
 * Importação em massa de colaboradores via CSV/XLSX.
 *
 * Fluxo: upload → preview com detecção de colunas → confirmação → insert em lote.
 * Mapeamento esperado (case insensitive, aceita variações):
 *   nome | cpf | email | telefone | admissao | tipo_contrato | salario_base
 *   jornada | cargo | centro_custo | status | vt_diario
 *
 * Cargos e Centros de Custo são resolvidos por NOME (criados previamente).
 * Linhas com erros são reportadas e ignoradas — operação parcial é aceita.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { useMutateEmployee } from "@/hooks/useDP";
import { usePositions } from "@/hooks/useDP";
import { useCostCenters } from "@/hooks/useCostCenters";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface ParsedRow {
  raw: Record<string, any>;
  mapped: any;
  errors: string[];
}

const FIELD_ALIASES: Record<string, string[]> = {
  name: ["nome", "name", "colaborador"],
  cpf: ["cpf"],
  email: ["email", "e-mail"],
  phone: ["telefone", "phone", "celular"],
  admission_date: ["admissao", "admissão", "data_admissao", "admission_date"],
  contract_type: ["tipo_contrato", "contrato", "regime", "tipo"],
  salary_base: ["salario_base", "salário", "salario", "salary"],
  workload_hours: ["jornada", "horas", "workload"],
  position_name: ["cargo", "position"],
  cost_center_name: ["centro_custo", "centro de custo", "cc", "cost_center"],
  status: ["status", "situacao", "situação"],
  vt_diario: ["vt_diario", "vt", "vale_transporte"],
};

function findField(row: Record<string, any>, key: string): any {
  const aliases = FIELD_ALIASES[key];
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().trim().replace(/\s+/g, "_");
    if (aliases.includes(norm)) return row[k];
  }
  return null;
}

function normalizeDate(v: any): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export default function EmployeeImportDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { data: positions = [] } = usePositions();
  const { costCenters = [] } = useCostCenters();
  const { create } = useMutateEmployee();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ ok: number; fail: number } | null>(null);

  const handleFile = async (file: File) => {
    setDone(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });

      const parsed: ParsedRow[] = json.map((raw) => {
        const errors: string[] = [];
        const name = findField(raw, "name");
        const admission = normalizeDate(findField(raw, "admission_date"));
        const salary = Number(findField(raw, "salary_base") || 0);
        const positionName = findField(raw, "position_name");
        const ccName = findField(raw, "cost_center_name");

        if (!name) errors.push("Nome ausente");
        if (!admission) errors.push("Admissão inválida");
        if (!salary || salary <= 0) errors.push("Salário base inválido");

        const positionMatch = positionName
          ? positions.find((p: any) => p.name?.toLowerCase().trim() === String(positionName).toLowerCase().trim())
          : null;
        const ccMatch = ccName
          ? costCenters.find((c: any) => c.name?.toLowerCase().trim() === String(ccName).toLowerCase().trim())
          : null;

        if (positionName && !positionMatch) errors.push(`Cargo "${positionName}" não cadastrado`);
        if (ccName && !ccMatch) errors.push(`CC "${ccName}" não cadastrado`);

        const contractType = String(findField(raw, "contract_type") || "CLT").toUpperCase();
        const validContract = ["CLT", "PJ", "ESTAGIO", "INTERMITENTE"].includes(contractType);
        if (!validContract) errors.push(`Tipo "${contractType}" inválido`);

        return {
          raw,
          mapped: {
            name: String(name || "").trim(),
            cpf: String(findField(raw, "cpf") || "").trim() || null,
            email: String(findField(raw, "email") || "").trim() || null,
            phone: String(findField(raw, "phone") || "").trim() || null,
            admission_date: admission,
            contract_type: validContract ? (contractType === "ESTAGIO" ? "estagio" : contractType) : "CLT",
            salary_base: salary,
            workload_hours: Number(findField(raw, "workload_hours") || 44),
            position_id: positionMatch?.id || null,
            cost_center_id: ccMatch?.id || null,
            status: String(findField(raw, "status") || "ativo").toLowerCase(),
            vt_ativo: !!findField(raw, "vt_diario"),
            vt_diario: Number(findField(raw, "vt_diario") || 0),
          },
          errors,
        };
      });

      setRows(parsed);
    } catch (err: any) {
      toast({ title: "Erro ao ler arquivo", description: err.message, variant: "destructive" });
    }
  };

  const handleImport = async () => {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) {
      toast({ title: "Nada para importar", description: "Corrija as linhas com erro." });
      return;
    }
    setImporting(true);
    let ok = 0;
    let fail = 0;
    for (const row of valid) {
      try {
        await new Promise<void>((resolve, reject) =>
          create.mutate(row.mapped, {
            onSuccess: () => {
              ok++;
              resolve();
            },
            onError: (e) => {
              fail++;
              reject(e);
            },
          }),
        );
      } catch {
        // já contado
      }
    }
    setImporting(false);
    setDone({ ok, fail });
    toast({ title: "Importação concluída", description: `${ok} cadastrado(s), ${fail} falha(s)` });
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.length - validCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar colaboradores (CSV/XLSX)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Colunas aceitas:&nbsp;
              <code>nome, cpf, email, telefone, admissao, tipo_contrato, salario_base,
              jornada, cargo, centro_custo, status, vt_diario</code>.
              Datas em <code>dd/mm/aaaa</code> ou <code>aaaa-mm-dd</code>. Cargos e CCs devem existir.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-2">
            <Label htmlFor="emp-import-file" className="cursor-pointer">
              <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-muted/40">
                <FileUp size={14} />
                <span className="text-sm">Selecionar arquivo</span>
              </div>
            </Label>
            <Input
              id="emp-import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {rows.length > 0 && (
              <div className="flex gap-2 text-xs">
                <Badge variant="default">{validCount} válida(s)</Badge>
                {errorCount > 0 && <Badge variant="destructive">{errorCount} com erro</Badge>}
              </div>
            )}
          </div>

          {rows.length > 0 && (
            <div className="border border-border rounded-lg overflow-x-auto max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Admissão</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead className="text-right">Salário</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>CC</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((r, i) => (
                    <TableRow key={i} className={r.errors.length > 0 ? "bg-destructive/5" : ""}>
                      <TableCell className="text-xs">
                        {r.mapped.name || "—"}
                        {r.errors.length > 0 && (
                          <div className="text-[10px] text-destructive mt-0.5">{r.errors.join(" · ")}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{r.mapped.admission_date || "—"}</TableCell>
                      <TableCell className="text-xs">{r.mapped.contract_type}</TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {Number(r.mapped.salary_base || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell className="text-xs">{r.mapped.position_id ? "✓" : "—"}</TableCell>
                      <TableCell className="text-xs">{r.mapped.cost_center_id ? "✓" : "—"}</TableCell>
                      <TableCell className="text-xs">{r.mapped.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 50 && (
                <div className="p-2 text-center text-xs text-muted-foreground border-t">
                  + {rows.length - 50} linha(s) adicionais
                </div>
              )}
            </div>
          )}

          {done && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-xs">
                Importação finalizada: <b>{done.ok}</b> cadastrado(s), <b>{done.fail}</b> falha(s).
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || validCount === 0}
          >
            <Upload size={14} className="mr-1" />
            {importing ? "Importando..." : `Importar ${validCount} colaborador(es)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
