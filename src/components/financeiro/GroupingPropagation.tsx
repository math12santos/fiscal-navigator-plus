import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useHolding } from "@/contexts/HoldingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGroupingMacrogroups } from "@/hooks/useGroupingMacrogroups";
import { useGroupingRules } from "@/hooks/useGroupingRules";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Copy, Layers, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

type PropagationType = "macrogroups" | "rules" | "all";

export default function GroupingPropagation() {
  const { isHolding, subsidiaryOrgs } = useHolding();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const { macrogroups, groups } = useGroupingMacrogroups();
  const { rules } = useGroupingRules();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [propagationType, setPropagationType] = useState<PropagationType>("all");
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
  const [isPropagating, setIsPropagating] = useState(false);

  if (!isHolding || subsidiaryOrgs.length === 0) return null;

  const openDialog = (type: PropagationType) => {
    setPropagationType(type);
    setSelectedOrgIds(new Set(subsidiaryOrgs.map((o) => o.id)));
    setDialogOpen(true);
  };

  const toggleOrg = (id: string) => {
    setSelectedOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedOrgIds.size === subsidiaryOrgs.length) {
      setSelectedOrgIds(new Set());
    } else {
      setSelectedOrgIds(new Set(subsidiaryOrgs.map((o) => o.id)));
    }
  };

  const propagate = async () => {
    if (!user || !currentOrg || selectedOrgIds.size === 0) return;
    setIsPropagating(true);

    try {
      const targetOrgIds = Array.from(selectedOrgIds);
      const shouldPropagateMacrogroups = propagationType === "macrogroups" || propagationType === "all";
      const shouldPropagateRules = propagationType === "rules" || propagationType === "all";

      for (const targetOrgId of targetOrgIds) {
        if (shouldPropagateMacrogroups) {
          // Delete existing macrogroups and groups in target
          const { data: existingMg } = await supabase
            .from("grouping_macrogroups" as any)
            .select("id")
            .eq("organization_id", targetOrgId);

          if (existingMg && (existingMg as any[]).length > 0) {
            const mgIds = (existingMg as any[]).map((m: any) => m.id);
            await supabase
              .from("grouping_groups" as any)
              .delete()
              .in("macrogroup_id", mgIds);
            await supabase
              .from("grouping_macrogroups" as any)
              .delete()
              .eq("organization_id", targetOrgId);
          }

          // Copy macrogroups
          const mgIdMap = new Map<string, string>();

          for (const mg of macrogroups) {
            const { data: newMg, error: mgErr } = await supabase
              .from("grouping_macrogroups" as any)
              .insert({
                organization_id: targetOrgId,
                user_id: user.id,
                name: mg.name,
                icon: mg.icon,
                color: mg.color,
                order_index: mg.order_index,
                enabled: mg.enabled,
              })
              .select()
              .single();

            if (mgErr) throw mgErr;
            mgIdMap.set(mg.id, (newMg as any).id);
          }

          // Copy groups
          const groupIdMap = new Map<string, string>();

          for (const g of groups) {
            const newMgId = mgIdMap.get(g.macrogroup_id);
            if (!newMgId) continue;

            const { data: newG, error: gErr } = await supabase
              .from("grouping_groups" as any)
              .insert({
                macrogroup_id: newMgId,
                organization_id: targetOrgId,
                user_id: user.id,
                name: g.name,
                order_index: g.order_index,
                enabled: g.enabled,
              })
              .select()
              .single();

            if (gErr) throw gErr;
            groupIdMap.set(g.id, (newG as any).id);
          }

          // If propagating rules too, we need the group mapping
          if (shouldPropagateRules) {
            await propagateRulesToOrg(targetOrgId, groupIdMap);
          }
        } else if (shouldPropagateRules) {
          // Rules only — delete existing rules in target and copy
          await supabase
            .from("grouping_rules" as any)
            .delete()
            .eq("organization_id", targetOrgId);

          // Without macrogroup propagation, group_id mapping is not available,
          // so we null out group_id references
          for (const rule of rules) {
            const { error } = await supabase
              .from("grouping_rules" as any)
              .insert({
                organization_id: targetOrgId,
                user_id: user.id,
                name: rule.name,
                match_field: rule.match_field,
                match_value: rule.match_value,
                sub_group_field: rule.sub_group_field,
                min_items: rule.min_items,
                enabled: rule.enabled,
                priority: rule.priority,
                group_id: null,
                operator: rule.operator,
                match_keyword: rule.match_keyword,
              });
            if (error) throw error;
          }
        }
      }

      toast({
        title: "Propagação concluída",
        description: `Configurações propagadas para ${targetOrgIds.length} empresa(s).`,
      });
      setDialogOpen(false);
    } catch (err: any) {
      console.error("Propagation error:", err);
      toast({
        title: "Erro na propagação",
        description: err.message || "Ocorreu um erro ao propagar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsPropagating(false);
    }
  };

  async function propagateRulesToOrg(targetOrgId: string, groupIdMap: Map<string, string>) {
    // Delete existing rules
    await supabase
      .from("grouping_rules" as any)
      .delete()
      .eq("organization_id", targetOrgId);

    for (const rule of rules) {
      const newGroupId = rule.group_id ? (groupIdMap.get(rule.group_id) ?? null) : null;
      const { error } = await supabase
        .from("grouping_rules" as any)
        .insert({
          organization_id: targetOrgId,
          user_id: user!.id,
          name: rule.name,
          match_field: rule.match_field,
          match_value: rule.match_value,
          sub_group_field: rule.sub_group_field,
          min_items: rule.min_items,
          enabled: rule.enabled,
          priority: rule.priority,
          group_id: newGroupId,
          operator: rule.operator,
          match_keyword: rule.match_keyword,
        });
      if (error) throw error;
    }
  }

  const typeLabel = {
    macrogroups: "Macrogrupos e Grupos",
    rules: "Regras de Classificação",
    all: "Macrogrupos, Grupos e Regras",
  };

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Propagar para o Grupo</span>
            <Badge variant="secondary" className="text-[10px]">Holding</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Replique a configuração de aglutinação desta holding para as subsidiárias do grupo.
            A configuração existente nas empresas de destino será substituída.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => openDialog("macrogroups")}
              disabled={macrogroups.length === 0}
            >
              <Layers size={14} /> Propagar Macrogrupos
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => openDialog("rules")}
              disabled={rules.length === 0}
            >
              <FileText size={14} /> Propagar Regras
            </Button>
            <Button
              size="sm"
              className="text-xs"
              onClick={() => openDialog("all")}
              disabled={macrogroups.length === 0 && rules.length === 0}
            >
              <Copy size={14} /> Propagar Tudo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Propagar Aglutinação</DialogTitle>
            <DialogDescription>
              Selecione as empresas que receberão a configuração de <strong>{typeLabel[propagationType]}</strong>.
              A configuração existente será substituída.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Empresas do grupo</span>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
                {selectedOrgIds.size === subsidiaryOrgs.length ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            </div>

            <div className="max-h-[300px] overflow-auto border rounded-md">
              {subsidiaryOrgs.map((org) => (
                <label
                  key={org.id}
                  className="flex items-center gap-3 px-3 py-2.5 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedOrgIds.has(org.id)}
                    onCheckedChange={() => toggleOrg(org.id)}
                  />
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{org.name}</span>
                </label>
              ))}
            </div>

            <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-md bg-muted/50">
              <p><strong>Resumo da propagação:</strong></p>
              {(propagationType === "macrogroups" || propagationType === "all") && (
                <p>• {macrogroups.length} macrogrupo(s), {groups.length} grupo(s)</p>
              )}
              {(propagationType === "rules" || propagationType === "all") && (
                <p>• {rules.length} regra(s) de classificação</p>
              )}
              <p>→ Para {selectedOrgIds.size} empresa(s)</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPropagating}>
              Cancelar
            </Button>
            <Button onClick={propagate} disabled={isPropagating || selectedOrgIds.size === 0}>
              {isPropagating ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Propagando...
                </>
              ) : (
                <>
                  <Copy size={14} /> Confirmar Propagação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
