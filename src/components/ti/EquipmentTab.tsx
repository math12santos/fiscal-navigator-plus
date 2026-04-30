import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, QrCode, ArrowLeftRight, Eye } from "lucide-react";
import { useITEquipment } from "@/hooks/useITEquipment";
import { EquipmentFormDialog } from "./EquipmentFormDialog";
import { EquipmentQRDialog } from "./EquipmentQRDialog";
import { MovementDialog } from "./MovementDialog";
import { EquipmentDetailDialog } from "./EquipmentDetailDialog";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_TONE: Record<string, string> = {
  ativo: "bg-success/15 text-success",
  em_uso: "bg-success/15 text-success",
  disponivel: "bg-primary/15 text-primary",
  em_manutencao: "bg-warning/15 text-warning",
  extraviado: "bg-destructive/15 text-destructive",
  baixado: "bg-muted text-muted-foreground",
  vendido: "bg-muted text-muted-foreground",
  inativo: "bg-muted text-muted-foreground",
};

export function EquipmentTab() {
  const { list, upsert, remove } = useITEquipment();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrEq, setQrEq] = useState<any>(null);

  const rows = useMemo(() => {
    const t = q.toLowerCase().trim();
    return (list.data ?? []).filter((e: any) =>
      !t || [e.name, e.patrimonial_code, e.brand, e.model, e.serial_number].filter(Boolean).some((x: string) => x.toLowerCase().includes(t))
    );
  }, [list.data, q]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, código, série..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Novo equipamento</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3">Código</th>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Valor aquisição</th>
                  <th className="p-3 w-32 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
                {!list.isLoading && rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum equipamento cadastrado.</td></tr>}
                {rows.map((e: any) => (
                  <tr key={e.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-mono">{e.patrimonial_code}</td>
                    <td className="p-3">
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{[e.brand, e.model].filter(Boolean).join(" ")}</div>
                    </td>
                    <td className="p-3 capitalize">{e.equipment_type?.replace(/_/g, " ")}</td>
                    <td className="p-3"><Badge className={STATUS_TONE[e.status] ?? ""}>{e.status?.replace(/_/g, " ")}</Badge></td>
                    <td className="p-3">{fmt(Number(e.acquisition_value || 0))}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setQrEq(e); setQrOpen(true); }}><QrCode className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir este equipamento?")) remove.mutate(e.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <EquipmentFormDialog open={open} onOpenChange={setOpen} initial={editing} onSave={(v) => upsert.mutate(v)} />
      <EquipmentQRDialog open={qrOpen} onOpenChange={setQrOpen} equipment={qrEq} />
    </div>
  );
}
