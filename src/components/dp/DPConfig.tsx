import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDPConfig, useMutateDPConfig } from "@/hooks/useDP";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

export default function DPConfig() {
  const { data: config, isLoading } = useDPConfig();
  const mutate = useMutateDPConfig();
  const { toast } = useToast();

  const [form, setForm] = useState<any>(null);

  // Init form when config loads
  const currentForm = form ?? {
    inss_patronal_pct: config?.inss_patronal_pct ?? 20,
    rat_pct: config?.rat_pct ?? 2,
    fgts_pct: config?.fgts_pct ?? 8,
    terceiros_pct: config?.terceiros_pct ?? 5.8,
    provisao_ferias_pct: config?.provisao_ferias_pct ?? 11.11,
    provisao_13_pct: config?.provisao_13_pct ?? 8.33,
    vt_desconto_pct: config?.vt_desconto_pct ?? 6,
  };

  const handleSave = () => {
    mutate.mutate(currentForm, {
      onSuccess: () => toast({ title: "Configurações salvas" }),
    });
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  const fields = [
    { key: "inss_patronal_pct", label: "INSS Patronal (%)" },
    { key: "rat_pct", label: "RAT (%)" },
    { key: "fgts_pct", label: "FGTS (%)" },
    { key: "terceiros_pct", label: "Terceiros / Sistema S (%)" },
    { key: "provisao_ferias_pct", label: "Provisão Férias Mensal (%)" },
    { key: "provisao_13_pct", label: "Provisão 13º Mensal (%)" },
    { key: "vt_desconto_pct", label: "Desconto VT Empregado (%)" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Parâmetros do Departamento Pessoal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Configure os percentuais utilizados nos cálculos de encargos, provisões e descontos.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input
                type="number"
                step="0.01"
                value={currentForm[f.key]}
                onChange={(e) => setForm({ ...currentForm, [f.key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
        <Button onClick={handleSave} disabled={mutate.isPending}>
          <Save size={14} className="mr-1" /> {mutate.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </CardContent>
    </Card>
  );
}
