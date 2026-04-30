import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KPI_REGISTRY, SECTION_META, KpiSection as KpiSectionKey } from "./kpiRegistry";
import { useKpiPreferences } from "@/hooks/useKpiPreferences";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KpiPreferencesDialog({ open, onOpenChange }: Props) {
  const { enabledMap, setMany } = useKpiPreferences();
  const [draft, setDraft] = useState<Record<string, boolean>>(enabledMap);

  // Resync quando o dialog abrir
  useMemo(() => {
    if (open) setDraft(enabledMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const grouped = useMemo(() => {
    const map: Record<KpiSectionKey, typeof KPI_REGISTRY> = {
      receita: [], lucratividade: [], caixa: [], ar: [], ap: [], eficiencia: [], comercial: [],
    };
    for (const k of KPI_REGISTRY) map[k.section].push(k);
    return map;
  }, []);

  const toggle = (kpiId: string, value: boolean) => {
    setDraft((prev) => ({ ...prev, [kpiId]: value }));
  };

  const setSection = (section: KpiSectionKey, value: boolean) => {
    setDraft((prev) => {
      const out = { ...prev };
      grouped[section].forEach((k) => (out[k.id] = value));
      return out;
    });
  };

  const applyPreset = (preset: "essencial" | "completo") => {
    setDraft(() => {
      const out: Record<string, boolean> = {};
      const essencialIds = new Set([
        "receita_bruta", "crescimento_receita", "mrr",
        "margem_bruta", "ebitda",
        "saldo_caixa", "burn_rate", "runway",
        "pmr", "aging_recebiveis", "inadimplencia_abc",
        "pmp", "endividamento_geral",
        "opex_receita", "ponto_equilibrio",
        "cac", "churn",
      ]);
      for (const k of KPI_REGISTRY) {
        out[k.id] = preset === "completo" ? true : essencialIds.has(k.id);
      }
      return out;
    });
  };

  const save = async () => {
    const changes = Object.entries(draft)
      .filter(([id, v]) => v !== enabledMap[id])
      .map(([kpiId, enabled]) => ({ kpiId, enabled }));
    if (changes.length > 0) {
      await setMany.mutateAsync(changes);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configurar KPIs do Dashboard</DialogTitle>
          <DialogDescription>
            Ative ou desative cada KPI. Suas preferências são salvas por organização.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 pb-2">
          <Button variant="outline" size="sm" onClick={() => applyPreset("essencial")}>
            Preset: Essencial PME
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("completo")}>
            Preset: Completo
          </Button>
        </div>

        <ScrollArea className="flex-1 pr-3 -mr-3">
          <div className="space-y-5">
            {(Object.keys(grouped) as KpiSectionKey[]).map((sec) => {
              const items = grouped[sec];
              const meta = SECTION_META[sec];
              const allOn = items.every((k) => draft[k.id]);
              const allOff = items.every((k) => !draft[k.id]);
              return (
                <div key={sec} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{meta.title}</h3>
                      <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={allOn}
                        onClick={() => setSection(sec, true)}
                      >
                        Tudo
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={allOff}
                        onClick={() => setSection(sec, false)}
                      >
                        Nada
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((k) => (
                      <label
                        key={k.id}
                        className="flex items-start justify-between gap-3 rounded border bg-card/30 px-3 py-2 cursor-pointer hover:bg-accent/30"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{k.label}</p>
                          <p className="text-xs text-muted-foreground">{k.description}</p>
                        </div>
                        <Switch
                          checked={!!draft[k.id]}
                          onCheckedChange={(v) => toggle(k.id, v)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={setMany.isPending}>
            {setMany.isPending ? "Salvando…" : "Salvar preferências"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
