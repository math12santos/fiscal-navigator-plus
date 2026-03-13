import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Check, Loader2, Zap } from "lucide-react";
import { RULE_TEMPLATES, type RuleTemplate } from "@/data/ruleTemplates";
import { useGroupingMacrogroups, type GroupingGroup } from "@/hooks/useGroupingMacrogroups";
import { useGroupingRules, type GroupingRule, MATCH_FIELD_OPTIONS, OPERATOR_OPTIONS } from "@/hooks/useGroupingRules";
import { useToast } from "@/hooks/use-toast";

export default function SuggestedRuleTemplates() {
  const { groups, macrogroups } = useGroupingMacrogroups();
  const { rules, create: createRule } = useGroupingRules();
  const { toast } = useToast();
  const [activating, setActivating] = useState<string | null>(null);
  const [activatingAll, setActivatingAll] = useState(false);

  // Match templates to existing groups by name
  const availableTemplates = useMemo(() => {
    const enabledGroups = groups.filter((g) => g.enabled);
    const results: { template: RuleTemplate; group: GroupingGroup; macrogroupName: string }[] = [];

    for (const t of RULE_TEMPLATES) {
      const group = enabledGroups.find(
        (g) => g.name.toLowerCase() === t.groupName.toLowerCase()
      );
      if (!group) continue;

      // Check if rule already exists
      const exists = rules.some(
        (r) => r.group_id === group.id && r.match_field === t.match_field && r.match_value === t.match_value && (r.match_keyword ?? "") === (t.match_keyword ?? "")
      );
      if (exists) continue;

      const mg = macrogroups.find((m) => m.id === group.macrogroup_id);
      results.push({ template: t, group, macrogroupName: mg?.name ?? "" });
    }
    return results;
  }, [groups, macrogroups, rules]);

  if (availableTemplates.length === 0) return null;

  const handleActivate = async (item: typeof availableTemplates[0]) => {
    const key = `${item.template.groupName}-${item.template.match_field}`;
    setActivating(key);
    try {
      await createRule.mutateAsync({
        name: item.template.ruleName,
        match_field: item.template.match_field,
        match_value: item.template.match_value,
        operator: item.template.operator,
        match_keyword: item.template.match_keyword,
        sub_group_field: item.template.sub_group_field,
        min_items: item.template.min_items,
        priority: item.template.priority,
        group_id: item.group.id,
        enabled: true,
      });
    } catch {
      // toast handled by hook
    } finally {
      setActivating(null);
    }
  };

  const handleActivateAll = async () => {
    setActivatingAll(true);
    let count = 0;
    for (const item of availableTemplates) {
      try {
        await createRule.mutateAsync({
          name: item.template.ruleName,
          match_field: item.template.match_field,
          match_value: item.template.match_value,
          operator: item.template.operator,
          match_keyword: item.template.match_keyword,
          sub_group_field: item.template.sub_group_field,
          min_items: item.template.min_items,
          priority: item.template.priority,
          group_id: item.group.id,
          enabled: true,
        });
        count++;
      } catch { /* continue */ }
    }
    toast({ title: `${count} regras criadas com sucesso` });
    setActivatingAll(false);
  };

  const getConditionLabel = (t: RuleTemplate) => {
    const field = MATCH_FIELD_OPTIONS.find((o) => o.value === t.match_field)?.label ?? t.match_field;
    const op = OPERATOR_OPTIONS.find((o) => o.value === t.operator)?.label ?? t.operator;
    const val = t.match_field === "descricao" ? (t.match_keyword ?? "") : t.match_value;
    return { field, op, val: val.length > 40 ? val.slice(0, 40) + "…" : val };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Regras Sugeridas
            <Badge variant="secondary" className="text-[10px]">{availableTemplates.length}</Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleActivateAll}
            disabled={activatingAll}
          >
            {activatingAll ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Ativar Todas
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Templates pré-configurados baseados nos grupos ativos. Ative individualmente ou todas de uma vez.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {availableTemplates.slice(0, 12).map((item) => {
            const { field, op, val } = getConditionLabel(item.template);
            const key = `${item.template.groupName}-${item.template.match_field}`;
            const isActivating = activating === key;

            return (
              <div
                key={key}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge variant="outline" className="text-[10px] shrink-0">Sugerido</Badge>
                    <span className="text-xs font-medium truncate">{item.template.ruleName}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {field} {op} "{val}" → <span className="font-medium">{item.macrogroupName} → {item.group.name}</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 px-2"
                  onClick={() => handleActivate(item)}
                  disabled={isActivating || activatingAll}
                >
                  {isActivating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  <span className="text-xs ml-1">Ativar</span>
                </Button>
              </div>
            );
          })}
        </div>
        {availableTemplates.length > 12 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            +{availableTemplates.length - 12} templates disponíveis (use "Ativar Todas")
          </p>
        )}
      </CardContent>
    </Card>
  );
}
