import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, CheckCircle2 } from "lucide-react";
import { useJuridicoProcesses, useJuridicoSettlements } from "@/hooks/useJuridico";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

export function JuridicoSettlementsTab() {
  const { list: processList } = useJuridicoProcesses();
  const { list, create, approve } = useJuridicoSettlements();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    process_id: "",
    numero_acordo: "",
    valor_total: 0,
    qtd_parcelas: 1,
    data_primeira_parcela: "",
    observacoes: "",
  });

  const installments = useMemo(() => {
    const total = Number(form.valor_total) || 0;
    const qtd = Number(form.qtd_parcelas) || 1;
    if (!form.data_primeira_parcela || qtd <= 0) return [];
    const valorParcela = Math.round((total / qtd) * 100) / 100;
    const base = new Date(form.data_primeira_parcela);
    return Array.from({ length: qtd }).map((_, i) => {
      const d = new Date(base);
      d.setMonth(d.getMonth() + i);
      const isLast = i === qtd - 1;
      const valor = isLast ? Math.round((total - valorParcela * (qtd - 1)) * 100) / 100 : valorParcela;
      return {
        numero_parcela: i + 1,
        valor,
        data_vencimento: d.toISOString().slice(0, 10),
      };
    });
  }, [form]);

  const submit = () => {
    if (!form.process_id || !form.data_primeira_parcela || installments.length === 0) return;
    create.mutate(
      { ...form, valor_total: Number(form.valor_total), installments },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ process_id: "", numero_acordo: "", valor_total: 0, qtd_parcelas: 1, data_primeira_parcela: "", observacoes: "" });
        },
      },
    );
  };

  const procMap = new Map((processList.data ?? []).map((p) => [p.id, p]));
  const data = list.data ?? [];

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Acordos</CardTitle>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Acordo
          </Button>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum acordo cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Acordo</th>
                    <th>Processo</th>
                    <th className="text-right">Valor</th>
                    <th className="text-center">Parcelas</th>
                    <th>1ª Parcela</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((s) => {
                    const proc = procMap.get(s.process_id);
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2">{s.numero_acordo || s.id.slice(0, 8)}</td>
                        <td>{proc?.numero_cnj || proc?.numero_interno || "—"}</td>
                        <td className="text-right">{fmt(Number(s.valor_total))}</td>
                        <td className="text-center">{s.qtd_parcelas}</td>
                        <td>{new Date(s.data_primeira_parcela).toLocaleDateString("pt-BR")}</td>
                        <td><Badge variant="outline">{s.status}</Badge></td>
                        <td className="text-right">
                          {s.status === "proposto" ? (
                            <Button size="sm" variant="outline" onClick={() => approve.mutate(s.id)} disabled={approve.isPending}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar e lançar no caixa
                            </Button>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Lançado</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Acordo</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Processo</Label>
              <Select value={form.process_id} onValueChange={(v) => setForm({ ...form, process_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um processo..." /></SelectTrigger>
                <SelectContent>
                  {(processList.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.numero_cnj || p.numero_interno || p.id.slice(0, 8)} — {p.parte_contraria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nº do Acordo</Label>
              <Input value={form.numero_acordo} onChange={(e) => setForm({ ...form, numero_acordo: e.target.value })} />
            </div>
            <div>
              <Label>Valor Total (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Qtd. Parcelas</Label>
              <Input type="number" min={1} value={form.qtd_parcelas} onChange={(e) => setForm({ ...form, qtd_parcelas: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Data 1ª Parcela</Label>
              <Input type="date" value={form.data_primeira_parcela} onChange={(e) => setForm({ ...form, data_primeira_parcela: e.target.value })} />
            </div>
          </div>

          {installments.length > 0 && (
            <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium mb-1">Prévia das parcelas:</p>
              {installments.map((i) => (
                <div key={i.numero_parcela} className="flex justify-between text-xs py-0.5">
                  <span>Parcela {i.numero_parcela} — {new Date(i.data_vencimento).toLocaleDateString("pt-BR")}</span>
                  <span className="font-medium">{fmt(i.valor)}</span>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending || !form.process_id}>
              {create.isPending ? "Salvando..." : "Criar Acordo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
