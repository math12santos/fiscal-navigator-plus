import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { useSuppliers } from "@/hooks/useCompras";
import { SupplierFormDialog } from "./SupplierFormDialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const STATUS: Record<string, { label: string; variant: any }> = {
  ativo: { label: "Ativo", variant: "default" },
  inativo: { label: "Inativo", variant: "outline" },
  bloqueado: { label: "Bloqueado", variant: "destructive" },
  em_homologacao: { label: "Em homologação", variant: "secondary" },
};

export function SuppliersTab() {
  const { suppliers, isLoading, remove } = useSuppliers();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter((s: any) =>
      [s.razao_social, s.nome_fantasia, s.documento, s.email].some((v) =>
        (v || "").toLowerCase().includes(term),
      ),
    );
  }, [suppliers, q]);

  return (
    <SectionCard
      title="Fornecedores"
      description="Cadastro homologado de fornecedores para uso em Compras."
      actions={
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Novo fornecedor
        </Button>
      }
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por razão social, CNPJ ou e-mail..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razão Social</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Avaliação</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum fornecedor cadastrado.</TableCell></TableRow>
            ) : (
              filtered.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.razao_social}</div>
                    {s.nome_fantasia && <div className="text-xs text-muted-foreground">{s.nome_fantasia}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{s.documento || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {s.contato_nome && <div>{s.contato_nome}</div>}
                    {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS[s.status]?.variant || "outline"}>
                      {STATUS[s.status]?.label || s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{s.avaliacao ? "★".repeat(s.avaliacao) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir fornecedor?")) remove.mutate(s.id); }}>
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

      <SupplierFormDialog open={open} onOpenChange={setOpen} initial={editing} />
    </SectionCard>
  );
}
