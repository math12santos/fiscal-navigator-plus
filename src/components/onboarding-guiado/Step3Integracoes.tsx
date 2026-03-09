import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Upload, FileSpreadsheet, Building2, Plug, CheckCircle2, Loader2, X, Eye,
} from "lucide-react";
import { StepHeader } from "./StepHeader";

interface Step3Props {
  data: Record<string, any>;
  onChange: (d: Record<string, any>) => void;
}

const SYSTEM_FIELDS = [
  { value: "data", label: "Data" },
  { value: "descricao", label: "Descrição" },
  { value: "valor", label: "Valor" },
  { value: "tipo", label: "Tipo (Receita/Despesa)" },
  { value: "conta", label: "Conta" },
  { value: "centro_custo", label: "Centro de Custo" },
  { value: "ignorar", label: "Ignorar" },
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter
  const firstLine = lines[0];
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolons > commas ? ";" : ",";

  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) =>
    line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""))
  );
  return { headers, rows };
}

type Phase = "sources" | "upload" | "mapping" | "preview" | "done";

export function Step3Integracoes({ data, onChange }: Step3Props) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("sources");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [imports, setImports] = useState<any[]>([]);
  const [loadingImports, setLoadingImports] = useState(true);

  // Fetch existing imports
  useEffect(() => {
    if (!currentOrg) return;
    (async () => {
      setLoadingImports(true);
      const { data: imp } = await supabase
        .from("data_imports" as any)
        .select("*")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false });
      setImports((imp as any[]) || []);
      setLoadingImports(false);
    })();
  }, [currentOrg]);

  // Sync onChange
  useEffect(() => {
    const totalRows = imports.reduce((s: number, i: any) => s + (i.row_count || 0), 0);
    onChange({
      imports_count: imports.length,
      total_rows_imported: totalRows,
      last_import_date: imports[0]?.created_at?.slice(0, 10) || null,
    });
  }, [imports.length]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      if (h.length === 0) {
        toast({ title: "Arquivo vazio ou inválido", variant: "destructive" });
        return;
      }
      setHeaders(h);
      setRows(r);
      // Auto-init mapping
      const init: Record<string, string> = {};
      h.forEach((col) => {
        const lower = col.toLowerCase();
        if (lower.includes("data") || lower.includes("date")) init[col] = "data";
        else if (lower.includes("descri") || lower.includes("hist")) init[col] = "descricao";
        else if (lower.includes("valor") || lower.includes("value") || lower.includes("amount")) init[col] = "valor";
        else if (lower.includes("tipo") || lower.includes("type")) init[col] = "tipo";
        else if (lower.includes("conta") || lower.includes("account")) init[col] = "conta";
        else if (lower.includes("centro") || lower.includes("cost")) init[col] = "centro_custo";
        else init[col] = "ignorar";
      });
      setMapping(init);
      setPhase("mapping");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const mappedPreview = rows.slice(0, 5).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      const target = mapping[h];
      if (target && target !== "ignorar") {
        obj[target] = row[i] || "";
      }
    });
    return obj;
  });

  const handleConfirmMapping = async () => {
    if (!user || !currentOrg) return;
    setSaving(true);

    // Insert import record
    const { data: importRec, error: importErr } = await supabase
      .from("data_imports" as any)
      .insert({
        organization_id: currentOrg.id,
        user_id: user.id,
        file_name: fileName,
        source_type: "spreadsheet",
        row_count: rows.length,
        column_mapping: mapping,
        status: "mapped",
      } as any)
      .select()
      .single();

    if (importErr || !importRec) {
      toast({ title: "Erro ao salvar importação", variant: "destructive" });
      setSaving(false);
      return;
    }

    const importId = (importRec as any).id;

    // Insert rows in batches of 100
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map((row, idx) => {
        const raw: Record<string, string> = {};
        const mapped: Record<string, string> = {};
        headers.forEach((h, ci) => {
          raw[h] = row[ci] || "";
          const target = mapping[h];
          if (target && target !== "ignorar") mapped[target] = row[ci] || "";
        });
        return {
          import_id: importId,
          row_index: i + idx,
          raw_data: raw,
          mapped_data: mapped,
          status: "valid",
        };
      });

      const { error } = await supabase
        .from("data_import_rows" as any)
        .insert(batch as any);

      if (error) {
        console.error("Error inserting rows batch:", error);
      }
    }

    // Mark as imported
    await supabase
      .from("data_imports" as any)
      .update({ status: "imported", imported_at: new Date().toISOString() } as any)
      .eq("id", importId);

    toast({ title: "Importação concluída!", description: `${rows.length} linhas importadas.` });
    setImports((prev) => [{ ...(importRec as any), status: "imported", row_count: rows.length }, ...prev]);
    setSaving(false);
    setPhase("done");
  };

  const resetUpload = () => {
    setPhase("sources");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
  };

  return (
    <div className="space-y-6">
      <StepHeader
        stepNumber={3}
        fallbackTitle="Integrações"
        fallbackDescription="Conecte fontes de dados ao sistema. Comece importando planilhas."
        fallbackIcon={Plug}
      />

      {/* Source cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={`cursor-pointer border-2 transition-colors ${
            phase !== "sources" && phase !== "done"
              ? "border-primary bg-primary/5"
              : "hover:border-primary/50"
          }`}
          onClick={() => phase === "sources" && setPhase("upload")}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <Badge variant="default">Ativo</Badge>
            </div>
            <CardTitle className="text-base">Importação Manual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Upload de CSV com mapeamento DE/PARA
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <Badge variant="secondary">Em breve</Badge>
            </div>
            <CardTitle className="text-base">Bancos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Open Banking, OFX, CSV bancário
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Plug className="h-8 w-8 text-muted-foreground" />
              <Badge variant="secondary">Em breve</Badge>
            </div>
            <CardTitle className="text-base">ERPs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Conta Azul, Omie, Bling, TOTVS
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upload area */}
      {phase === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload de Planilha</CardTitle>
            <CardDescription>Arraste um arquivo CSV ou clique para selecionar</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Arraste seu arquivo CSV aqui ou <span className="text-primary underline">clique para selecionar</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">Suporta arquivos .csv (separados por vírgula ou ponto-e-vírgula)</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Mapping */}
      {phase === "mapping" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Mapeamento DE/PARA</CardTitle>
                <CardDescription>
                  Arquivo: {fileName} — {rows.length} linhas detectadas
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={resetUpload}>
                <X size={16} className="mr-1" /> Cancelar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mapping selects */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Associe cada coluna da planilha a um campo do sistema:
              </p>
              <div className="grid gap-3">
                {headers.map((header) => (
                  <div key={header} className="flex items-center gap-4">
                    <span className="w-48 text-sm font-mono bg-muted px-3 py-2 rounded truncate" title={header}>
                      {header}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={mapping[header] || "ignorar"}
                      onValueChange={(v) => setMapping((prev) => ({ ...prev, [header]: v }))}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Eye size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Preview (5 primeiras linhas)</span>
              </div>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {SYSTEM_FIELDS.filter((f) => f.value !== "ignorar" && Object.values(mapping).includes(f.value)).map((f) => (
                        <TableHead key={f.value}>{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedPreview.map((row, i) => (
                      <TableRow key={i}>
                        {SYSTEM_FIELDS.filter((f) => f.value !== "ignorar" && Object.values(mapping).includes(f.value)).map((f) => (
                          <TableCell key={f.value} className="text-sm">
                            {row[f.value] || "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetUpload}>Cancelar</Button>
              <Button onClick={handleConfirmMapping} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 size={16} className="mr-2" />}
                Confirmar e Importar ({rows.length} linhas)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Done */}
      {phase === "done" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Importação concluída!</p>
                <p className="text-sm text-muted-foreground">
                  {rows.length} linhas importadas de "{fileName}"
                </p>
              </div>
              <Button variant="outline" size="sm" className="ml-auto" onClick={resetUpload}>
                Importar outra planilha
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous imports */}
      {imports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Importações Realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Linhas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((imp: any) => (
                    <TableRow key={imp.id}>
                      <TableCell className="font-mono text-sm">{imp.file_name}</TableCell>
                      <TableCell>{imp.row_count}</TableCell>
                      <TableCell>
                        <Badge variant={imp.status === "imported" ? "default" : "secondary"}>
                          {imp.status === "imported" ? "Importado" : imp.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(imp.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
