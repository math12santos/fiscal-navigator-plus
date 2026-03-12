import type { GroupingMacrogroup, GroupingGroup } from "@/hooks/useGroupingMacrogroups";
import type { GroupingRule } from "@/hooks/useGroupingRules";

export interface HierarchyInfo {
  macrogroupId: string;
  macrogroupName: string;
  macrogroupIcon: string;
  macrogroupColor: string;
  groupId: string;
  groupName: string;
  ruleName: string;
}

const UNCLASSIFIED_ID = "__unclassified__";
const UNCLASSIFIED_GROUP_ID = "__unclassified_group__";

export const UNCLASSIFIED_MACROGROUP: HierarchyInfo = {
  macrogroupId: UNCLASSIFIED_ID,
  macrogroupName: "Não Classificado",
  macrogroupIcon: "HelpCircle",
  macrogroupColor: "#94a3b8",
  groupId: UNCLASSIFIED_GROUP_ID,
  groupName: "Sem Grupo",
  ruleName: "",
};

/**
 * Resolves the full hierarchy path for an entry:
 * entry → matching rule → group → macrogroup
 */
export function resolveHierarchy(
  entry: any,
  getMatchingRule: (entry: any) => GroupingRule | null,
  getGroupLabel: (entry: any) => string,
  groups: GroupingGroup[],
  macrogroups: GroupingMacrogroup[]
): HierarchyInfo {
  const rule = getMatchingRule(entry);

  if (!rule) {
    // No rule match — use entry's own label as group name
    const label = entry.categoria || entry.source || "Outros";
    return {
      ...UNCLASSIFIED_MACROGROUP,
      groupName: label,
      groupId: `${UNCLASSIFIED_GROUP_ID}__${label}`,
    };
  }

  // Rule matched — resolve group and macrogroup
  if (rule.group_id) {
    const group = groups.find((g) => g.id === rule.group_id);
    if (group) {
      const mg = macrogroups.find((m) => m.id === group.macrogroup_id);
      if (mg) {
        return {
          macrogroupId: mg.id,
          macrogroupName: mg.name,
          macrogroupIcon: mg.icon,
          macrogroupColor: mg.color,
          groupId: group.id,
          groupName: group.name,
          ruleName: rule.name,
        };
      }
    }
  }

  // Rule exists but no group_id linked — put under "Não Classificado" macrogroup
  return {
    ...UNCLASSIFIED_MACROGROUP,
    groupId: `rule__${rule.name}`,
    groupName: rule.name,
    ruleName: rule.name,
  };
}

export interface MacrogroupBucket {
  info: HierarchyInfo;
  groups: Map<string, { info: HierarchyInfo; entries: any[]; total: number }>;
  entries: any[];
  total: number;
}

/**
 * Groups entries into a 3-level hierarchy: Macrogroup → Group → Entries
 */
export function buildHierarchy(
  entries: any[],
  getMatchingRule: (entry: any) => GroupingRule | null,
  getGroupLabel: (entry: any) => string,
  groups: GroupingGroup[],
  macrogroups: GroupingMacrogroup[],
  valueKey = "valor_previsto"
): MacrogroupBucket[] {
  const mgMap = new Map<string, MacrogroupBucket>();

  for (const entry of entries) {
    const hi = resolveHierarchy(entry, getMatchingRule, getGroupLabel, groups, macrogroups);
    const val = Number(entry[valueKey] ?? 0);

    if (!mgMap.has(hi.macrogroupId)) {
      mgMap.set(hi.macrogroupId, {
        info: hi,
        groups: new Map(),
        entries: [],
        total: 0,
      });
    }
    const mgBucket = mgMap.get(hi.macrogroupId)!;
    mgBucket.total += val;
    mgBucket.entries.push(entry);

    if (!mgBucket.groups.has(hi.groupId)) {
      mgBucket.groups.set(hi.groupId, { info: hi, entries: [], total: 0 });
    }
    const grpBucket = mgBucket.groups.get(hi.groupId)!;
    grpBucket.total += val;
    grpBucket.entries.push(entry);
  }

  // Sort macrogroups: classified first (by macrogroup order), unclassified last
  const sorted = Array.from(mgMap.values()).sort((a, b) => {
    if (a.info.macrogroupId === UNCLASSIFIED_ID) return 1;
    if (b.info.macrogroupId === UNCLASSIFIED_ID) return -1;
    const aIdx = macrogroups.findIndex((m) => m.id === a.info.macrogroupId);
    const bIdx = macrogroups.findIndex((m) => m.id === b.info.macrogroupId);
    return aIdx - bIdx;
  });

  return sorted;
}
