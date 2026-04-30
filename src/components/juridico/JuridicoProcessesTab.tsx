import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useJuridicoProcesses } from "@/hooks/useJuridico";
import { JuridicoProcessDialog } from "./JuridicoProcessDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

const probColor: Record<string, string> = {
  remota: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  possivel: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  provavel: "bg-red-500/10 text-red-700 dark:text-red-300",
};

export function JuridicoProcessesTab() {
  const { list, remove } = useJuridicoProcesses();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const data = (list.data ?? []).filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.numero_cnj?.toLowerCase().includes(s) ||
      p.numero_interno?.toLowerCase().includes(s) ||
      p.parte_contraria?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Processos</CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Novo Processo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum processo cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Nº CNJ / Interno</th>
                    <th>Parte Contrária</th>
                    <th>Natureza</th>
                    <th>Status</th>
                    <th>Risco</th>
                    <th className="text-right">V. Causa</th>
                    <th className="text-right">Provisão</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2">
                        <div className="font-medium">{p.numero_cnj || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.numero_interno}</div>
                      </td>
                      <td>{p.parte_contraria || "—"}</td>
                      <td className="capitalize">{p.natureza}</td>
                      <td><Badge variant="outline">{p.status}</Badge></td>
                      <td>
                        <Badge className={probColor[p.probabilidade]}>{p.probabilidade}</Badge>
                      </td>
                      <td className="text-right">{fmt(Number(p.valor_causa))}</td>
                      <td className="text-right font-medium">{fmt(Number(p.valor_provisionado))}</td>
                      <td className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <JuridicoProcessDialog open={open} onOpenChange={setOpen} initialData={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. Acordos e despesas vinculados também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) remove.mutate(deleting);
                setDeleting(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
