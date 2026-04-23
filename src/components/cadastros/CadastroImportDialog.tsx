import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export type CadastroKind = "fornecedor" | "cliente" | "produto" | "servico";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: CadastroKind;
}

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
}

const ENTITY_FIELDS: FieldDef[] = [
  { key: "name", label: "Nome / Razão Social", required: true },
  { key: "document_type", label: "Tipo Documento", hint: "CNPJ ou CPF" },
  { key: "document_number", label: "Documento" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefone" },
  { key: "contact_person", label: "Contato" },
  { key: "address_street", label: "Endereço" },
  { key: "address_number", label: "Número" },
  { key: "address_complement", label: "Complemento" },
  { key: "address_neighborhood", label: "Bairro" },
  { key: "address_city", label: "Cidade" },
  { key: "address_state", label: "UF" },
  { key: "address_zip", label: "CEP" },
  { key: "payment_condition", label: "Condição Pagamento" },
  { key: "credit_limit", label: "Limite Crédito" },
  { key: "bank_name", label: "Banco" },
  { key: "bank_agency", label: "Agência" },
  { key: "bank_account", label: "Conta" },
  { key: "bank_pix", label: "Chave PIX" },
  { key: "notes", label: "Observações" },
];

const PRODUCT_FIELDS: FieldDef[] = [
  { key: "code", label: "Código", required: true },
  { key: "name", label: "Nome", required: true },
  { key: "unit", label: "Unidade", hint: "un, mês, kg..." },
  { key: "unit_price", label: "Valor Unitário" },
  { key: "category", label: "Categoria" },
  { key: "description", label: "Descrição" },
  { key: "ncm", label: "NCM" },
  { key: "cest", label: "CEST" },
];

function getFields(kind: CadastroKind): FieldDef[] {
  return kind === "fornecedor" || kind === "cliente" ? ENTITY_FIELDS : PRODUCT_FIELDS;
}

function getTable(kind: CadastroKind): "entities" | "products" {
  return kind === "fornecedor" || kind === "cliente" ? "entities" : "products";
}

function getKindLabel(kind: CadastroKind) {
  return { fornecedor: "Fornecedores", cliente: "Clientes", produto: "Produtos", servico: "Serviços" }[kind];
}

function parseNumber(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

interface ParsedRow {
  index: number;
  data: Record<string, any>;
  errors: string[];
}

export default function CadastroImportDialog({ open, onOpenChange, kind }: Props) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fields = useMemo(() => getFields(kind), [kind]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);

  const reset = () => {
    setRows([]);
    setFileName("");
    setImported(0);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const downloadTemplate = () => {
    const headers = fields.map((f) => f.label);
    const example = fields.map((f) => {
      if (f.key === "document_type") return "CNPJ";
      if (f.key === "name") return kind === "fornecedor" ? "Fornecedor Exemplo Ltda" : kind === "cliente" ? "Cliente Exemplo Ltda" : "Produto Exemplo";
      if (f.key === "code") return kind === "produto" ? "PROD001" : "SERV001";
      if (f.key === "unit") return kind === "servico" ? "mês" : "un";
      if (f.key === "unit_price") return 100;
      return "";
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `template_${kind}.xlsx`);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setImported(0);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (json.length < 2) {
      toast({ title: "Arquivo vazio", description: "O arquivo precisa ter cabeçalho + ao menos 1 linha.", variant: "destructive" });
      return;
    }
    const headers = (json[0] as string[]).map((h) => String(h ?? "").trim().toLowerCase());
    // Map header label -> field key
    const labelMap = new Map<string, string>();
    fields.forEach((f) => labelMap.set(f.label.toLowerCase(), f.key));
    // also accept exact key match
    fields.forEach((f) => labelMap.set(f.key, f.key));

    const colMap: (string | null)[] = headers.map((h) => labelMap.get(h) ?? null);

    const parsed: ParsedRow[] = [];
    for (let i = 1; i < json.length; i++) {
      const raw = json[i] as any[];
      if (!raw || raw.every((c) => c === "" || c == null)) continue;
      const data: Record<string, any> = {};
      colMap.forEach((key, idx) => {
        if (!key) return;
        const v = raw[idx];
        if (v === "" || v == null) return;
        if (key === "unit_price" || key === "credit_limit") {
          const n = parseNumber(v);
          if (n != null) data[key] = n;
        } else {
          data[key] = String(v).trim();
        }
      });
      const errors: string[] = [];
      fields.filter((f) => f.required).forEach((f) => {
        if (!data[f.key]) errors.push(`${f.label} é obrigatório`);
      });
      parsed.push({ index: i, data, errors });
    }
    setRows(parsed);
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  const runImport = async () => {
    if (!user || !currentOrg?.id) return;
    if (validRows.length === 0) {
      toast({ title: "Nada para importar", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const table = getTable(kind);
      const payload = validRows.map((r) => {
        const base: Record<string, any> = {
          ...r.data,
          user_id: user.id,
          organization_id: currentOrg.id,
          active: true,
        };
        if (table === "entities") {
          base.type = kind === "fornecedor" ? "fornecedor" : "cliente";
          if (!base.document_type) base.document_type = "CNPJ";
        } else {
          base.type = kind === "produto" ? "produto" : "servico";
          if (!base.unit) base.unit = kind === "servico" ? "mês" : "un";
          if (base.unit_price == null) base.unit_price = 0;
        }
        return base;
      });

      // Insert in chunks of 200
      const CHUNK = 200;
      let done = 0;
      for (let i = 0; i < payload.length; i += CHUNK) {
        const slice = payload.slice(i, i + CHUNK);
        const { error } = await (supabase.from(table) as any).insert(slice);
        if (error) throw error;
        done += slice.length;
        setImported(done);
      }

      qc.invalidateQueries({ queryKey: [table === "entities" ? "entities" : "products"] });
      toast({ title: "Importação concluída", description: `${done} registros importados.` });
      handleClose(false);
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar {getKindLabel(kind)}</DialogTitle>
          <DialogDescription>
            Baixe o template, preencha as colunas e envie de volta. Aceita .xlsx e .csv.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download size={16} className="mr-2" /> Baixar template
            </Button>
            <div className="flex-1 min-w-[200px]">
              <Label className="cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md hover:bg-accent transition">
                  <Upload size={16} />
                  <span className="text-sm">{fileName || "Selecionar arquivo .xlsx ou .csv"}</span>
                </div>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </Label>
            </div>
          </div>

          <Alert>
            <FileSpreadsheet size={16} />
            <AlertDescription>
              Os cabeçalhos do arquivo devem corresponder aos nomes das colunas do template.{" "}
              Campos obrigatórios:{" "}
              <strong>{fields.filter((f) => f.required).map((f) => f.label).join(", ")}</strong>.
            </AlertDescription>
          </Alert>

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 size={12} /> {validRows.length} válidas
                </Badge>
                {invalidRows.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle size={12} /> {invalidRows.length} com erros
                  </Badge>
                )}
                {importing && imported > 0 && (
                  <span className="text-muted-foreground">Importando {imported}/{validRows.length}…</span>
                )}
              </div>

              <div className="border rounded-md max-h-[40vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                      {fields.slice(0, 5).map((f) => (
                        <TableHead key={f.key}>{f.label}</TableHead>
                      ))}
                      <TableHead>Erros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 100).map((r) => (
                      <TableRow key={r.index} className={r.errors.length ? "bg-destructive/5" : ""}>
                        <TableCell className="text-muted-foreground">{r.index}</TableCell>
                        <TableCell>
                          {r.errors.length ? (
                            <Badge variant="destructive" className="text-xs">erro</Badge>
                          ) : (
                            <Badge variant="default" className="text-xs">ok</Badge>
                          )}
                        </TableCell>
                        {fields.slice(0, 5).map((f) => (
                          <TableCell key={f.key} className="text-xs">
                            {String(r.data[f.key] ?? "—")}
                          </TableCell>
                        ))}
                        <TableCell className="text-xs text-destructive">
                          {r.errors.join("; ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > 100 && (
                  <div className="p-2 text-center text-xs text-muted-foreground border-t">
                    … exibindo 100 de {rows.length} linhas
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button onClick={runImport} disabled={importing || validRows.length === 0}>
            {importing ? "Importando…" : `Importar ${validRows.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
