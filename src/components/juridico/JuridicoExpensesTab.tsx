import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Send } from "lucide-react";
import { useJuridicoExpenses, useJuridicoProcesses } from "@/hooks/useJuridico";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

export function JuridicoExpensesTab() {
  const { list: procList } = useJuridicoProcesses();
  const { list, upsert, postToCashflow } = useJuridicoExpenses();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    process_id: "",
    tipo: "honorario",
    descricao: "",
    valor: 0,
    data_despesa: new Date().toISOString().slice(0, 10),
    data_vencimento: "",
  });

  const submit = () => {
    if (!form.process_id) return;
    const payload = { ...form, valor: Number(form.valor) };
    if (!payload.data_vencimento) payload.data_vencimento = null;
    upsert.mutate(payload, {
      onSuccess: () => {
        setOpen(false);
        setForm({ process_id: "", tipo: "honorario", descricao: "", valor: 0, data_despesa: new Date().toISOString().slice(0, 10), data_vencimento: "" });
      },
    });
  };

  const procMap = new Map((procList.data ?? []).map((p) => [p.id, p]));
  const data = list.data ?? [];

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Despesas Processuais</CardTitle>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Despesa
          </Button>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Data</th>
                    <th>Processo</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th className="text-right">Valor</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((e) => {
                    const proc = procMap.get(e.process_id);
                    return (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-2">{new Date(e.data_despesa).toLocaleDateString("pt-BR")}</td>
                        <td>{proc?.numero_cnj || proc?.numero_interno || "—"}</td>
                        <td className="capitalize">{e.tipo}</td>
                        <td>{e.descricao}</td>
                        <td className="text-right">{fmt(Number(e.valor))}</td>
                        <td>
                          {e.posted_to_cashflow ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">No fluxo</Badge>
                          ) : (
                            <Badge variant="outline">Pendente</Badge>
                          )}
                        </td>
                        <td className="text-right">
                          {!e.posted_to_cashflow && (
                            <Button size="sm" variant="outline" onClick={() => postToCashflow.mutate(e.id)}>
                              <Send className="h-3 w-3 mr-1" /> Lançar
                            </Button>
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
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Despesa Processual</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Processo</Label>
              <Select value={form.process_id} onValueChange={(v) => setForm({ ...form, process_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(procList.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.numero_cnj || p.numero_interno || p.id.slice(0, 8)} — {p.parte_contraria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="honorario">Honorário</SelectItem>
                  <SelectItem value="custas">Custas</SelectItem>
                  <SelectItem value="deposito_judicial">Depósito Judicial</SelectItem>
                  <SelectItem value="pericia">Perícia</SelectItem>
                  <SelectItem value="preposto">Preposto</SelectItem>
                  <SelectItem value="viagem">Viagem</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </div>
            <div>
              <Label>Data da Despesa</Label>
              <Input type="date" value={form.data_despesa} onChange={(e) => setForm({ ...form, data_despesa: e.target.value })} />
            </div>
            <div>
              <Label>Data de Vencimento</Label>
              <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={upsert.isPending || !form.process_id}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
