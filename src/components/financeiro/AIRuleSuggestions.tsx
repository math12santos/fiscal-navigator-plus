import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, Loader2, Zap, BarChart3 } from "lucide-react";
import { useAISuggestedRules, type AISuggestion } from "@/hooks/useAISuggestedRules";
import { useGroupingRules, MATCH_FIELD_OPTIONS, OPERATOR_OPTIONS } from "@/hooks/useGroupingRules";
import { useGroupingMacrogroups } from "@/hooks/useGroupingMacrogroups";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AIRuleSuggestions({ open, onOpenChange }: Props) {
  const { suggestions, isLoading, totalEntries, fetchSuggestions } = useAISuggestedRules();
  const { create: createRule } = useGroupingRules();
  const { groups } = useGroupingMacrogroups();
  const { toast } = useToast();
  const [applying, setApplying] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && suggestions.length === 0 && !isLoading) {
      fetchSuggestions();
    }
  };

  const findGroupId = (suggestedGroup: string): string | null => {
    const match = groups.find(
      (g) => g.name.toLowerCase() === suggestedGroup.toLowerCase()
    );
    return match?.id ?? null;
  };

  const applyRule = async (s: AISuggestion) => {
    const key = `${s.name}-${s.match_field}`;
    setApplying(key);
    try {
      await createRule.mutateAsync({
        name: s.name,
        match_field: s.match_field,
        match_value: s.match_field !== "descricao" ? (s.match_value ?? "") : "",
        operator: s.operator,
        match_keyword: s.match_field === "descricao" ? (s.match_keyword ?? s.match_value ?? "") : null,
        sub_group_field: null,
        min_items: 1,
        priority: s.priority,
        group_id: findGroupId(s.suggested_group),
        enabled: true,
      });
      setApplied((prev) => new Set(prev).add(key));
    } catch { /* handled by hook */ }
    setApplying(null);
  };

  const applyAll = async () => {
    setApplyingAll(true);
    let count = 0;
    for (const s of suggestions) {
      const key = `${s.name}-${s.match_field}`;
      if (applied.has(key)) continue;
      try {
        await createRule.mutateAsync({
          name: s.name,
          match_field: s.match_field,
          match_value: s.match_field !== "descricao" ? (s.match_value ?? "") : "",
          operator: s.operator,
          match_keyword: s.match_field === "descricao" ? (s.match_keyword ?? s.match_value ?? "") : null,
          sub_group_field: null,
          min_items: 1,
          priority: s.priority,
          group_id: findGroupId(s.suggested_group),
          enabled: true,
        });
        setApplied((prev) => new Set(prev).add(key));
        count++;
      } catch { /* continue */ }
    }
    toast({ title: `${count} regras da IA aplicadas` });
    setApplyingAll(false);
  };

  const pendingCount = suggestions.filter((s) => !applied.has(`${s.name}-${s.match_field}`)).length;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Sugestões da IA
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando lançamentos com IA...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground space-y-3">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm">Nenhuma sugestão disponível.</p>
            <Button variant="outline" size="sm" onClick={fetchSuggestions}>
              Tentar Novamente
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {totalEntries} lançamentos analisados · {suggestions.length} sugestões
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchSuggestions} disabled={isLoading}>
                  Reanalisar
                </Button>
                {pendingCount > 0 && (
                  <Button size="sm" onClick={applyAll} disabled={applyingAll}>
                    {applyingAll ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    Aplicar Todas ({pendingCount})
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {suggestions.map((s) => {
                const key = `${s.name}-${s.match_field}`;
                const isApplied = applied.has(key);
                const isApplying = applying === key;
                const fieldLabel = MATCH_FIELD_OPTIONS.find((o) => o.value === s.match_field)?.label ?? s.match_field;
                const opLabel = OPERATOR_OPTIONS.find((o) => o.value === s.operator)?.label ?? s.operator;
                const val = s.match_field === "descricao" ? (s.match_keyword ?? s.match_value ?? "") : (s.match_value ?? "");
                const groupId = findGroupId(s.suggested_group);

                return (
                  <div
                    key={key}
                    className={`flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors ${
                      isApplied ? "bg-primary/5 border-primary/20" : "bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">IA</Badge>
                        <span className="text-sm font-medium">{s.name}</span>
                        {!groupId && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                            Grupo não encontrado
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fieldLabel} <span className="font-medium">{opLabel}</span> "{val.length > 50 ? val.slice(0, 50) + "…" : val}"
                        {" → "}
                        <span className="font-medium">{s.suggested_group}</span>
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>~{s.coverage} lançamentos cobertos</span>
                        <span>Prioridade: {s.priority}</span>
                      </div>
                    </div>
                    <Button
                      variant={isApplied ? "ghost" : "outline"}
                      size="sm"
                      className="shrink-0 h-8"
                      onClick={() => applyRule(s)}
                      disabled={isApplied || isApplying || applyingAll}
                    >
                      {isApplied ? (
                        <>
                          <Check size={14} className="text-primary" />
                          <span className="text-xs">Aplicada</span>
                        </>
                      ) : isApplying ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <span className="text-xs">Aplicar</span>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
