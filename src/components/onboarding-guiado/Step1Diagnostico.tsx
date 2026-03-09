import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Building2, BarChart3, FileText, Cpu } from "lucide-react";

interface Props {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const MATURITY_LABELS: Record<number, string> = {
  1: "Controle básico",
  2: "Financeiro estruturado",
  3: "Controladoria",
  4: "Governança financeira",
  5: "Gestão orientada por dados",
};

function calculateMaturity(answers: Record<string, string>): number {
  let score = 0;
  // Estrutura
  if (answers.num_empresas === "2-5") score += 1;
  if (answers.num_empresas === "6+") score += 2;
  if (answers.tem_holding === "sim") score += 1;
  // Maturidade financeira
  if (answers.controle_caixa === "erp") score += 2;
  else if (answers.controle_caixa === "planilha") score += 1;
  if (answers.auditoria === "sim") score += 2;
  if (answers.dre === "gerencial") score += 2;
  else if (answers.dre === "integrada") score += 3;
  // Tecnologia
  if (answers.usa_erp === "sim") score += 1;

  if (score <= 2) return 1;
  if (score <= 4) return 2;
  if (score <= 6) return 3;
  if (score <= 8) return 4;
  return 5;
}

export function Step1Diagnostico({ data, onChange }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(data?.answers || {});
  const maturityLevel = calculateMaturity(answers);

  useEffect(() => {
    onChange({ answers, maturity_level: maturityLevel });
  }, [answers]);

  const set = (key: string, val: string) => setAnswers((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Diagnóstico Inicial</h2>
        <p className="text-muted-foreground mt-1">
          Avalie o nível de maturidade financeira da sua empresa
        </p>
      </div>

      {/* Seção Estrutura */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 size={18} className="text-primary" /> Estrutura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Quantas empresas existem no grupo?</Label>
            <RadioGroup value={answers.num_empresas || ""} onValueChange={(v) => set("num_empresas", v)}>
              <div className="flex items-center gap-2"><RadioGroupItem value="1" id="ne1" /><Label htmlFor="ne1">1</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="2-5" id="ne2" /><Label htmlFor="ne2">2 a 5</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="6+" id="ne3" /><Label htmlFor="ne3">6 ou mais</Label></div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>Existe holding?</Label>
            <RadioGroup value={answers.tem_holding || ""} onValueChange={(v) => set("tem_holding", v)}>
              <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="th1" /><Label htmlFor="th1">Sim</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="th2" /><Label htmlFor="th2">Não</Label></div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>Quantos CNPJs existem?</Label>
            <RadioGroup value={answers.num_cnpjs || ""} onValueChange={(v) => set("num_cnpjs", v)}>
              <div className="flex items-center gap-2"><RadioGroupItem value="1" id="nc1" /><Label htmlFor="nc1">1</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="2-5" id="nc2" /><Label htmlFor="nc2">2 a 5</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="6+" id="nc3" /><Label htmlFor="nc3">6 ou mais</Label></div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Maturidade */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 size={18} className="text-primary" /> Maturidade do Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Como o fluxo de caixa é controlado atualmente?</Label>
            <RadioGroup value={answers.controle_caixa || ""} onValueChange={(v) => set("controle_caixa", v)}>
              <div className="flex items-center gap-2"><RadioGroupItem value="nenhum" id="cc0" /><Label htmlFor="cc0">Sem controle</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="planilha" id="cc1" /><Label htmlFor="cc1">Planilha</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="erp" id="cc2" /><Label htmlFor="cc2">ERP</Label></div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Sistema financeiro */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={18} className="text-primary" /> Sistema Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Existe processo de auditoria dos pagamentos?</Label>
            <RadioGroup value={answers.auditoria || ""} onValueChange={(v) => set("auditoria", v)}>
              <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="au1" /><Label htmlFor="au1">Sim</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="au2" /><Label htmlFor="au2">Não</Label></div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>Existe DRE gerencial mensal?</Label>
            <RadioGroup value={answers.dre || ""} onValueChange={(v) => set("dre", v)}>
              <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="dr0" /><Label htmlFor="dr0">Não existe controle</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="gerencial" id="dr1" /><Label htmlFor="dr1">Sim, DRE gerencial</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="integrada" id="dr2" /><Label htmlFor="dr2">Sim, integrada à DRE contábil</Label></div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Tecnologia */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu size={18} className="text-primary" /> Tecnologia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Utiliza algum ERP?</Label>
            <RadioGroup value={answers.usa_erp || ""} onValueChange={(v) => set("usa_erp", v)}>
              <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="ue1" /><Label htmlFor="ue1">Sim</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="ue2" /><Label htmlFor="ue2">Não</Label></div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {Object.keys(answers).length >= 3 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nível de Maturidade Estimado</p>
                <p className="text-xl font-bold text-foreground">
                  Nível {maturityLevel} — {MATURITY_LABELS[maturityLevel]}
                </p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2 border-primary text-primary">
                {maturityLevel}/5
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
