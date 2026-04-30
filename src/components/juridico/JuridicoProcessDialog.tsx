import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJuridicoProcesses } from "@/hooks/useJuridico";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialData?: any;
}

const empty = {
  numero_cnj: "",
  numero_interno: "",
  natureza: "civel",
  classe: "",
  assunto: "",
  polo: "passivo",
  parte_contraria: "",
  parte_contraria_documento: "",
  comarca: "",
  uf: "",
  vara: "",
  tribunal: "",
  instancia: "primeira",
  status: "ativo",
  fase: "",
  probabilidade: "possivel",
  valor_causa: 0,
  valor_estimado_perda: 0,
  valor_depositado: 0,
  data_distribuicao: "",
  data_citacao: "",
  data_proxima_audiencia: "",
  advogado_responsavel: "",
  escritorio_externo: "",
  observacoes: "",
};

export function JuridicoProcessDialog({ open, onOpenChange, initialData }: Props) {
  const { upsert } = useJuridicoProcesses();
  const [form, setForm] = useState<any>(empty);

  useEffect(() => {
    if (open) setForm(initialData ? { ...empty, ...initialData } : empty);
  }, [open, initialData]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = () => {
    const payload: any = { ...form };
    ["data_distribuicao", "data_citacao", "data_proxima_audiencia"].forEach((k) => {
      if (payload[k] === "") payload[k] = null;
    });
    payload.valor_causa = Number(payload.valor_causa) || 0;
    payload.valor_estimado_perda = Number(payload.valor_estimado_perda) || 0;
    payload.valor_depositado = Number(payload.valor_depositado) || 0;
    upsert.mutate(payload, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Processo" : "Novo Processo"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Nº CNJ</Label>
            <Input value={form.numero_cnj} onChange={(e) => set("numero_cnj", e.target.value)} />
          </div>
          <div>
            <Label>Nº Interno</Label>
            <Input value={form.numero_interno} onChange={(e) => set("numero_interno", e.target.value)} />
          </div>
          <div>
            <Label>Natureza</Label>
            <Select value={form.natureza} onValueChange={(v) => set("natureza", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="civel">Cível</SelectItem>
                <SelectItem value="trabalhista">Trabalhista</SelectItem>
                <SelectItem value="tributario">Tributário</SelectItem>
                <SelectItem value="criminal">Criminal</SelectItem>
                <SelectItem value="administrativo">Administrativo</SelectItem>
                <SelectItem value="familia">Família</SelectItem>
                <SelectItem value="consumidor">Consumidor</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Polo</Label>
            <Select value={form.polo} onValueChange={(v) => set("polo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo (autor)</SelectItem>
                <SelectItem value="passivo">Passivo (réu)</SelectItem>
                <SelectItem value="terceiro_interessado">Terceiro Interessado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Parte Contrária</Label>
            <Input value={form.parte_contraria} onChange={(e) => set("parte_contraria", e.target.value)} />
          </div>

          <div>
            <Label>Comarca</Label>
            <Input value={form.comarca} onChange={(e) => set("comarca", e.target.value)} />
          </div>
          <div>
            <Label>UF</Label>
            <Input maxLength={2} value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>Vara / Tribunal</Label>
            <Input value={form.vara} onChange={(e) => set("vara", e.target.value)} />
          </div>

          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem>
                <SelectItem value="arquivado">Arquivado</SelectItem>
                <SelectItem value="extinto">Extinto</SelectItem>
                <SelectItem value="transitado_julgado">Transitado em Julgado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Instância</Label>
            <Select value={form.instancia} onValueChange={(v) => set("instancia", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="primeira">1ª Instância</SelectItem>
                <SelectItem value="segunda">2ª Instância</SelectItem>
                <SelectItem value="superior">Tribunal Superior</SelectItem>
                <SelectItem value="extraordinaria">Extraordinária</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Probabilidade de Perda</Label>
            <Select value={form.probabilidade} onValueChange={(v) => set("probabilidade", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="remota">Remota</SelectItem>
                <SelectItem value="possivel">Possível</SelectItem>
                <SelectItem value="provavel">Provável</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Valor da Causa (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_causa} onChange={(e) => set("valor_causa", e.target.value)} />
          </div>
          <div>
            <Label>Valor Estimado de Perda (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_estimado_perda} onChange={(e) => set("valor_estimado_perda", e.target.value)} />
          </div>
          <div>
            <Label>Valor Depositado (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_depositado} onChange={(e) => set("valor_depositado", e.target.value)} />
          </div>

          <div>
            <Label>Data de Distribuição</Label>
            <Input type="date" value={form.data_distribuicao || ""} onChange={(e) => set("data_distribuicao", e.target.value)} />
          </div>
          <div>
            <Label>Data de Citação</Label>
            <Input type="date" value={form.data_citacao || ""} onChange={(e) => set("data_citacao", e.target.value)} />
          </div>
          <div>
            <Label>Próxima Audiência</Label>
            <Input
              type="datetime-local"
              value={form.data_proxima_audiencia ? String(form.data_proxima_audiencia).slice(0, 16) : ""}
              onChange={(e) => set("data_proxima_audiencia", e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <Label>Advogado Responsável</Label>
            <Input value={form.advogado_responsavel} onChange={(e) => set("advogado_responsavel", e.target.value)} />
          </div>
          <div>
            <Label>Escritório Externo</Label>
            <Input value={form.escritorio_externo} onChange={(e) => set("escritorio_externo", e.target.value)} />
          </div>

          <div className="md:col-span-3">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
