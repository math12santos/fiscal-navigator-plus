import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Check, Loader2, X, Zap, ArrowRight } from "lucide-react";
import { RULE_TEMPLATES, type RuleTemplate } from "@/data/ruleTemplates";
import { useGroupingMacrogroups, type GroupingGroup } from "@/hooks/useGroupingMacrogroups";
import { useGroupingRules, MATCH_FIELD_OPTIONS, OPERATOR_OPTIONS } from "@/hooks/useGroupingRules";
import { useToast } from "@/hooks/use-toast";

export default function SuggestedRuleTemplates() {
  const { groups, macrogroups } = useGroupingMacrogroups();
  const { rules, create: createRule } = useGroupingRules();
  const { toast } = useToast();
  const [activating, setActivating] = useState<string | null>(null);
  const [activatingAll, setActivatingAll] = useState(false);
  const [ignoredKeys, setIgnoredKeys] = useState<Set<string>>(new Set());

  // Match templates to existing groups by name
  const availableTemplates = useMemo(() => {
    const enabledGroups = groups.filter((g) => g.enabled);
    const results: { template: RuleTemplate; group: GroupingGroup; macrogroupName: string; macrogroupColor: string; key: string }[] = [];

    for (const t of RULE_TEMPLATES) {
      const group = enabledGroups.find(
        (g) => g.name.toLowerCase() === t.groupName.toLowerCase()
      );
      if (!group) continue;

      const key = `${t.groupName}-${t.match_field}-${t.operator}`;
      if (ignoredKeys.has(key)) continue;

      // Check if rule already exists
      const exists = rules.some(
        (r) => r.group_id === group.id && r.match_field === t.match_field && r.match_value === t.match_value && (r.match_keyword ?? "") === (t.match_keyword ?? "")
      );
      if (exists) continue;

      const mg = macrogroups.find((m) => m.id === group.macrogroup_id);
      results.push({ template: t, group, macrogroupName: mg?.name ?? "", macrogroupColor: mg?.color ?? "#6366f1", key });
    }
    return results;
  }, [groups, macrogroups, rules, ignoredKeys]);

  const handleActivate = async (item: typeof availableTemplates[0]) => {
    setActivating(item.key);
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
    return { field, op, val };
  };

  // Group templates by macrogroup for better organization
  const groupedByMacro = useMemo(() => {
    const map = new Map<string, typeof availableTemplates>();
    for (const item of availableTemplates) {
      const existing = map.get(item.macrogroupName) ?? [];
      existing.push(item);
      map.set(item.macrogroupName, existing);
    }
    return Array.from(map.entries());
  }, [availableTemplates]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-medium text-muted-foreground">
            Regras sugeridas baseadas nos grupos ativos
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={handleActivateAll}
          disabled={activatingAll}
        >
          {activatingAll ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          Ativar Todas ({availableTemplates.length})
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {groupedByMacro.map(([macroName, items]) => (
          <Card key={macroName} className="border-dashed">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div
                  className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: items[0].macrogroupColor + "18" }}
                >
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: items[0].macrogroupColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{macroName}</p>
                  <div className="space-y-1.5 mt-2">
                    {items.map((item) => {
                      const { field, op, val } = getConditionLabel(item.template);
                      const isActivating = activating === item.key;
                      const keywords = val.split(",").map((k) => k.trim()).filter(Boolean);

                      return (
                        <div
                          key={item.key}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-dashed bg-muted/30"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium">{item.template.ruleName}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              <Badge variant="secondary" className="text-[10px] font-normal">{item.group.name}</Badge>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">{field}</Badge>
                              <Badge variant="outline" className="text-[10px]">{op}</Badge>
                              {keywords.slice(0, 3).map((k) => (
                                <span key={k} className="text-[10px] font-mono text-muted-foreground">"{k}"</span>
                              ))}
                              {keywords.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{keywords.length - 3}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs"
                              onClick={() => handleActivate(item)}
                              disabled={isActivating || activatingAll}
                            >
                              {isActivating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              Ativar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => setIgnoredKeys((prev) => new Set(prev).add(item.key))}
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
