import { useMemo, useState, useCallback } from "react";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useGroupingRules } from "@/hooks/useGroupingRules";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface OrphanItem {
  type: "category" | "cost_center" | "pattern";
  value: string;
  frequency: number;
  total: number;
  suggestedAction: "create_category" | "create_cost_center" | "create_rule";
}

const IGNORED_STORAGE_KEY = (orgId: string) => `fincore_ignored_orphans_${orgId}`;

export function useStructureDiscovery() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? "";
  const { entries: saidaEntries } = useFinanceiro("saida");
  const { entries: entradaEntries } = useFinanceiro("entrada");
  const { accounts } = useChartOfAccounts();
  const { costCenters } = useCostCenters();
  const { rules } = useGroupingRules();

  const allEntries = useMemo(() => [...saidaEntries, ...entradaEntries], [saidaEntries, entradaEntries]);

  const [ignoredKeys, setIgnoredKeys] = useState<Set<string>>(() => {
    if (!orgId) return new Set();
    try {
      const stored = localStorage.getItem(IGNORED_STORAGE_KEY(orgId));
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const ignore = useCallback((key: string) => {
    setIgnoredKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      if (orgId) localStorage.setItem(IGNORED_STORAGE_KEY(orgId), JSON.stringify([...next]));
      return next;
    });
  }, [orgId]);

  const clearIgnored = useCallback(() => {
    setIgnoredKeys(new Set());
    if (orgId) localStorage.removeItem(IGNORED_STORAGE_KEY(orgId));
  }, [orgId]);

  const accountNames = useMemo(() => new Set(accounts.map(a => a.name.toLowerCase())), [accounts]);
  const costCenterIds = useMemo(() => new Set(costCenters.map(c => c.id)), [costCenters]);
  const costCenterNames = useMemo(() => new Set(costCenters.map(c => c.name.toLowerCase())), [costCenters]);
  const ruleMatchValues = useMemo(() => {
    const s = new Set<string>();
    rules.forEach(r => {
      if (r.match_field === "categoria") {
        r.match_value.split(",").forEach(v => s.add(v.trim().toLowerCase()));
      }
    });
    return s;
  }, [rules]);

  const orphans = useMemo(() => {
    const catMap = new Map<string, { count: number; total: number }>();
    const patternMap = new Map<string, { count: number; total: number }>();

    allEntries.forEach(e => {
      const cat = (e as any).categoria as string | null;
      const val = Number(e.valor_previsto) || 0;

      // Orphan categories
      if (cat && cat.trim()) {
        const catLower = cat.trim().toLowerCase();
        if (!accountNames.has(catLower) && !ruleMatchValues.has(catLower)) {
          const existing = catMap.get(cat.trim()) || { count: 0, total: 0 };
          catMap.set(cat.trim(), { count: existing.count + 1, total: existing.total + Math.abs(val) });
        }
      }

      // Recurring description patterns (5+ occurrences without rule)
      const desc = (e as any).descricao as string | null;
      if (desc && desc.trim()) {
        // Normalize: take first 40 chars lowercase
        const normalized = desc.trim().substring(0, 40).toLowerCase();
        const existing = patternMap.get(normalized) || { count: 0, total: 0 };
        patternMap.set(normalized, { count: existing.count + 1, total: existing.total + Math.abs(val) });
      }
    });

    const items: OrphanItem[] = [];

    // Add orphan categories
    catMap.forEach((data, value) => {
      const key = `cat:${value}`;
      if (!ignoredKeys.has(key) && data.count >= 1) {
        items.push({
          type: "category",
          value,
          frequency: data.count,
          total: data.total,
          suggestedAction: "create_category",
        });
      }
    });

    // Add recurring patterns (5+ occurrences, no matching rule)
    patternMap.forEach((data, normalized) => {
      if (data.count >= 5) {
        const hasRule = rules.some(r => {
          if (r.match_field !== "descricao") return false;
          const kw = (r.match_keyword || "").toLowerCase();
          return kw && normalized.includes(kw);
        });
        const key = `pat:${normalized}`;
        if (!hasRule && !ignoredKeys.has(key)) {
          items.push({
            type: "pattern",
            value: normalized,
            frequency: data.count,
            total: data.total,
            suggestedAction: "create_rule",
          });
        }
      }
    });

    // Sort by frequency desc
    items.sort((a, b) => b.frequency - a.frequency);
    return items;
  }, [allEntries, accountNames, ruleMatchValues, rules, ignoredKeys]);

  const orphanCategories = useMemo(() => orphans.filter(o => o.type === "category"), [orphans]);
  const orphanPatterns = useMemo(() => orphans.filter(o => o.type === "pattern"), [orphans]);

  return {
    orphans,
    orphanCategories,
    orphanPatterns,
    totalOrphans: orphans.length,
    ignore,
    clearIgnored,
    ignoredCount: ignoredKeys.size,
  };
}
