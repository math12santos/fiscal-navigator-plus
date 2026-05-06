import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package, UserPlus } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { useITKits } from "@/hooks/useITKits";
import { KitFormDialog } from "./KitFormDialog";
import { AssignKitDialog } from "./AssignKitDialog";

export function KitsTab() {
  const { list, removeKit } = useITKits();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignKit, setAssignKit] = useState<any>(null);

  const rows = list.data ?? [];

  return (
    <div className="space-y-4">
      <SectionCard
        icon={Package}
        title="Kits de equipamentos"
        description="Templates de pacotes (ex: Kit Dev, Kit Vendedor) para alocação rápida a colaboradores."
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Novo kit
          </Button>
        }
      >
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3">Kit</th>
                <th className="p-3">Composição</th>
                <th className="p-3">Itens</th>
                <th className="p-3 text-right w-56">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!list.isLoading && rows.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum kit cadastrado.</td></tr>
              )}
              {rows.map((k: any) => {
                const items = k.items ?? [];
                const totalItems = items.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0);
                return (
                  <tr key={k.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{k.name}</div>
                      {k.description && <div className="text-xs text-muted-foreground">{k.description}</div>}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {items.map((i: any) => (
                          <Badge key={i.id} variant="secondary" className="text-xs">
                            {i.quantity}× {i.equipment_type.replace(/_/g, " ")}
                            {i.equipment_subtype ? ` · ${i.equipment_subtype.replace(/_/g, " ")}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 tabular-nums">{totalItems}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => { setAssignKit(k); setAssignOpen(true); }}>
                          <UserPlus className="h-4 w-4 mr-1" />Atribuir
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(k); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover este kit?")) removeKit.mutate(k.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <KitFormDialog open={open} onOpenChange={setOpen} initial={editing} />
      <AssignKitDialog open={assignOpen} onOpenChange={setAssignOpen} kit={assignKit} />
    </div>
  );
}
