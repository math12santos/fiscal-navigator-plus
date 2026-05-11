import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { usePurchaseRequests, STATUS_REQUEST } from "@/hooks/useCompras";
import { PurchaseRequestFormDialog } from "./PurchaseRequestFormDialog";

const fmtBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RequestsTab() {
  const { requests, isLoading, remove } = usePurchaseRequests();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return requests;
    return requests.filter((r: any) =>
      [r.codigo, r.descricao, r.categoria, r.tipo_compra].some((v) => (v || "").toLowerCase().includes(t)),
    );
  }, [requests, q]);

  return (
    <SectionCard
      title="Solicitações de Compra"
      description="Cadastre, classifique e acompanhe pedidos de compra desde o rascunho até a aprovação."
      actions={
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Nova solicitação
        </Button>
      }
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por código, descrição..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma solicitação cadastrada.</TableCell></TableRow>
            ) : (
              filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.descricao || "—"}</div>
                    {r.fora_orcamento && <Badge variant="destructive" className="mt-1">Fora do orçamento</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{r.tipo_compra}</TableCell>
                  <TableCell className="text-right">{fmtBRL(Number(r.valor_estimado) || 0)}</TableCell>
                  <TableCell className="text-xs capitalize">{r.prioridade}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_REQUEST[r.status]?.variant || "outline"}>
                      {STATUS_REQUEST[r.status]?.label || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => { if (confirm("Excluir solicitação?")) remove.mutate(r.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PurchaseRequestFormDialog open={open} onOpenChange={setOpen} initial={editing} />
    </SectionCard>
  );
}
