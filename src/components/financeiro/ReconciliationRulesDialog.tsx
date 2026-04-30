import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Wand2, Pencil } from "lucide-react";

interface Rule {
  id: string;
  name: string;
  description_pattern: string;
  match_mode: string;
  tipo: string | null;
  min_value: number | null;
  max_value: number | null;
  priority: number;
  active: boolean;
  hits: number;
  last_applied_at: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const EMPTY: Partial<Rule> = {
  name: "",
  description_pattern: "",
  match_mode: "contains",
  tipo: null,
  min_value: null,
  max_value: null,
  priority: 100,
  active: true,
};

export function ReconciliationRulesDialog({ open, onOpenChange }: Props) {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = currentOrg?.id;

  const [editing, setEditing] = useState<Partial<Rule> | null>(null);

  const rulesQuery = useQuery({
    queryKey: ["reconciliation_rules", orgId],
    queryFn: async () => {
      if (!orgId) return [] as Rule[];
      const { data, error } = await supabase
        .from("reconciliation_rules" as any)
        .select(
          "id,name,description_pattern,match_mode,tipo,min_value,max_value,priority,active,hits,last_applied_at",
        )
        .eq("organization_id", orgId)
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Rule[];
    },
    enabled: !!orgId && open,
  });

  const save = useMutation({
    mutationFn: async (rule: Partial<Rule>) => {
      if (!orgId || !user) throw new Error("Sem contexto");
      const payload = {
        name: rule.name?.trim(),
        description_pattern: rule.description_pattern?.trim(),
        match_mode: rule.match_mode || "contains",
        tipo: rule.tipo || null,
        min_value: rule.min_value ?? null,
        max_value: rule.max_value ?? null,
        priority: Number(rule.priority ?? 100),
        active: rule.active ?? true,
        organization_id: orgId,
        user_id: user.id,
      };
      if (!payload.name || !payload.description_pattern) {
        throw new Error("Nome e padrão são obrigatórios");
      }
      if (rule.id) {
        const { error } = await supabase
          .from("reconciliation_rules" as any)
          .update(payload)
          .eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("reconciliation_rules" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliation_rules", orgId] });
      setEditing(null);
      toast({ title: "Regra salva" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reconciliation_rules" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliation_rules", orgId] });
      toast({ title: "Regra removida" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Sem org");
      const { data, error } = await supabase.rpc(
        "apply_reconciliation_rules" as any,
        { p_org_id: orgId, p_only_unclassified: true },
      );
      if (error) throw error;
      return data as { rules_applied: number; entries_updated: number };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["reconciliation_rules", orgId] });
      qc.invalidateQueries({ queryKey: ["cashflow_entries"] });
      toast({
        title: "Regras aplicadas",
        description: `${r.rules_applied} regras classificaram ${r.entries_updated} lançamentos.`,
      });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Regras de Conciliação</DialogTitle>
          <DialogDescription>
            Padrões de descrição que classificam automaticamente lançamentos
            (conta contábil, centro de custo, entidade, conta bancária).
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 mb-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => apply.mutate()}
            disabled={apply.isPending || (rulesQuery.data?.length ?? 0) === 0}
          >
            {apply.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Aplicar regras agora
          </Button>
          <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova regra
          </Button>
        </div>

        {rulesQuery.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : (rulesQuery.data?.length ?? 0) === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma regra cadastrada ainda. Crie a primeira para classificar
            automaticamente lançamentos com padrões recorrentes.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prio</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Hits</TableHead>
                <TableHead></TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rulesQuery.data!.map((r) => (
                <TableRow key={r.id} className={!r.active ? "opacity-50" : ""}>
                  <TableCell className="text-xs font-mono">{r.priority}</TableCell>
                  <TableCell className="text-sm font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs font-mono max-w-[220px] truncate">
                    {r.description_pattern}
                  </TableCell>
                  <TableCell className="text-xs">{r.match_mode}</TableCell>
                  <TableCell className="text-xs">{r.tipo ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">
                    <Badge variant="outline">{r.hits}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => setEditing(r)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => {
                        if (confirm(`Remover regra "${r.name}"?`))
                          remove.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {editing && (
          <div className="mt-4 border-t pt-4 space-y-3">
            <h4 className="text-sm font-semibold">
              {editing.id ? "Editar regra" : "Nova regra"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="Ex: Energia CPFL"
                />
              </div>
              <div>
                <Label className="text-xs">Prioridade (menor = primeiro)</Label>
                <Input
                  type="number"
                  value={editing.priority ?? 100}
                  onChange={(e) =>
                    setEditing({ ...editing, priority: Number(e.target.value) })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Padrão de descrição</Label>
                <Input
                  value={editing.description_pattern ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      description_pattern: e.target.value,
                    })
                  }
                  placeholder="Ex: cpfl  ou  ^pix.*folha"
                />
              </div>
              <div>
                <Label className="text-xs">Modo</Label>
                <Select
                  value={editing.match_mode ?? "contains"}
                  onValueChange={(v) =>
                    setEditing({ ...editing, match_mode: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contém</SelectItem>
                    <SelectItem value="exact">Igual</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo (opcional)</Label>
                <Select
                  value={editing.tipo ?? "__any__"}
                  onValueChange={(v) =>
                    setEditing({ ...editing, tipo: v === "__any__" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Qualquer</SelectItem>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor mínimo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editing.min_value ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      min_value: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="—"
                />
              </div>
              <div>
                <Label className="text-xs">Valor máximo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editing.max_value ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      max_value: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="—"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
                <Label className="text-xs">Ativa</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => save.mutate(editing)}
                disabled={save.isPending}
              >
                {save.isPending && (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
