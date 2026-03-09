import { useState, useEffect } from "react";
import { useContracts, type ContractInput } from "@/hooks/useContracts";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Loader2 } from "lucide-react";

interface Props {
  data: Record<string, any>;
  onChange: (d: Record<string, any>) => void;
}

const TIPO_LABELS: Record<string, string> = {
  receita: "Receita",
  despesa: "Despesa",
  investimento: "Investimento",
};

const RECORRENCIA_LABELS: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  unico: "Único",
};

export function Step5Contratos({ data, onChange }: Props) {
  const { contracts, isLoading, create } = useContracts();
  const [showForm, setShowForm] = useState(false);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("despesa");
  const [valor, setValor] = useState("");
  const [recorrencia, setRecorrencia] = useState("mensal");
  const [dataInicio, setDataInicio] = useState("");

  // Sync progress
  useEffect(() => {
    const totalValor = contracts.reduce((sum, c) => sum + (c.valor || 0), 0);
    const newData = { contracts_count: contracts.length, total_valor: totalValor };
    if (newData.contracts_count !== data.contracts_count || newData.total_valor !== data.total_valor) {
      onChange(newData);
    }
  }, [contracts.length, contracts.reduce((s, c) => s + (c.valor || 0), 0)]);

  const handleAdd = () => {
    if (!nome || !valor) return;
    const input: ContractInput = {
      nome,
      tipo,
      valor: parseFloat(valor),
      valor_base: parseFloat(valor),
      tipo_recorrencia: recorrencia,
      data_inicio: dataInicio || null,
      data_fim: null,
      prazo_indeterminado: true,
      vencimento: dataInicio || null,
      status: "ativo",
      notes: null,
      entity_id: null,
      product_id: null,
      dia_vencimento: null,
      tipo_reajuste: null,
      indice_reajuste: null,
      percentual_reajuste: null,
      periodicidade_reajuste: null,
      proximo_reajuste: null,
      natureza_financeira: null,
      impacto_resultado: null,
      cost_center_id: null,
      responsavel_interno: null,
      area_responsavel: null,
      sla_revisao_dias: null,
      finalidade: null,
      operacao: null,
      subtipo_operacao: null,
      rendimento_mensal_esperado: null,
      intervalo_personalizado: null,
    };
    create.mutate(input);
    setNome("");
    setValor("");
    setDataInicio("");
    setShowForm(false);
  };

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Cadastro de Contratos</h2>
            <p className="text-sm text-muted-foreground">Registre contratos que impactam o fluxo de caixa</p>
          </div>
        </div>

        <Accordion type="multiple" defaultValue={["contracts"]} className="space-y-2">
          <AccordionItem value="contracts" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                <span className="font-medium">Contratos</span>
                <Badge variant="secondary">{contracts.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhum contrato cadastrado.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Recorrência</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.slice(0, 20).map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell>{TIPO_LABELS[c.tipo] || c.tipo}</TableCell>
                          <TableCell className="text-right">{fmt(c.valor)}</TableCell>
                          <TableCell>{RECORRENCIA_LABELS[c.tipo_recorrencia] || c.tipo_recorrencia}</TableCell>
                          <TableCell>
                            <Badge variant={c.status === "ativo" ? "default" : "secondary"}>
                              {c.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
                  <Plus size={14} className="mr-1" /> Adicionar Contrato Rápido
                </Button>
              </div>

              {showForm && (
                <div className="grid grid-cols-2 gap-2 mt-3 p-3 border rounded-lg bg-muted/30">
                  <Input placeholder="Nome do contrato" value={nome} onChange={(e) => setNome(e.target.value)} />
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="investimento">Investimento</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} />
                  <Select value={recorrencia} onValueChange={setRecorrencia}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                      <SelectItem value="unico">Único</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="date" placeholder="Data início" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                  <div className="flex justify-end items-end">
                    <Button size="sm" onClick={handleAdd} disabled={create.isPending}>
                      {create.isPending ? <Loader2 className="animate-spin" size={14} /> : "Salvar"}
                    </Button>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
