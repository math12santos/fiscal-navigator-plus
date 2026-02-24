import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSystemModules } from "@/hooks/useSystemModules";
import { Loader2, LayoutGrid, Check } from "lucide-react";

interface Props {
  organizationId: string;
  onComplete: () => void;
}

export default function OnboardingModules({ organizationId, onComplete }: Props) {
  const { data: systemModules = [], isLoading: loadingModules } = useSystemModules();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Only show globally enabled modules, exclude config-like modules
  const availableModules = systemModules.filter(
    (m) => m.enabled && !["configuracoes", "integracoes"].includes(m.module_key)
  );

  const toggleModule = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0) {
      toast({ title: "Selecione ao menos um módulo", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const rows = availableModules.map((m) => ({
        organization_id: organizationId,
        module_key: m.module_key,
        enabled: selected.has(m.module_key),
      }));

      const { error } = await supabase
        .from("organization_modules" as any)
        .upsert(rows, { onConflict: "organization_id,module_key" });

      if (error) throw error;

      // Mark onboarding completed
      await supabase
        .from("organizations")
        .update({ onboarding_completed: true } as any)
        .eq("id", organizationId);

      toast({ title: "Módulos configurados com sucesso!" });
      onComplete();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loadingModules) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="glass-card p-8 w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <LayoutGrid className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Ativar Módulos</h1>
          <p className="text-sm text-muted-foreground">
            Selecione os módulos que deseja utilizar na sua empresa. Você pode alterar isso depois nas Configurações.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availableModules.map((m) => {
            const isSelected = selected.has(m.module_key);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleModule(m.module_key)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-muted-foreground/30"
                }`}
              >
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {isSelected && <Check className="h-4 w-4" />}
                </div>
                <span className="font-medium text-foreground">{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-2">
          <p className="text-sm text-muted-foreground">
            {selected.size} módulo{selected.size !== 1 ? "s" : ""} selecionado{selected.size !== 1 ? "s" : ""}
          </p>
          <Button onClick={handleSubmit} disabled={selected.size === 0 || loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Concluir"}
          </Button>
        </div>
      </div>
    </div>
  );
}
