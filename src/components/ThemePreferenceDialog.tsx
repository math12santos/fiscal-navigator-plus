import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Theme = "light" | "dark";

interface Props {
  open: boolean;
  onChosen: (theme: Theme) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem("theme", theme);
}

export function ThemePreferenceDialog({ open, onChosen }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Theme>("dark");
  const [saving, setSaving] = useState(false);

  // Live preview as the user hovers/selects
  useEffect(() => {
    if (open) applyTheme(selected);
  }, [selected, open]);

  const handleConfirm = async () => {
    if (!user) return;
    setSaving(true);
    applyTheme(selected);
    const { error } = await supabase
      .from("profiles")
      .update({ theme_preference: selected } as any)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar preferência", description: error.message, variant: "destructive" });
      return;
    }
    onChosen(selected);
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* bloqueado: precisa escolher */ }}>
      <DialogContent
        className="max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Bem-vindo(a) ao Colli FinCore</DialogTitle>
          <DialogDescription>
            Para começar, escolha o tema visual que você prefere usar no sistema.
            Você poderá alterar depois a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <button
            type="button"
            onClick={() => setSelected("light")}
            className={cn(
              "relative rounded-xl border-2 p-6 text-left transition-all",
              "hover:border-primary/60",
              selected === "light" ? "border-primary ring-2 ring-primary/30" : "border-border"
            )}
          >
            {selected === "light" && (
              <span className="absolute top-3 right-3 rounded-full bg-primary text-primary-foreground p-1">
                <Check className="h-4 w-4" />
              </span>
            )}
            <div className="flex items-center gap-3 mb-3">
              <Sun className="h-6 w-6 text-warning" />
              <span className="font-semibold">Tema Claro</span>
            </div>
            <div className="rounded-md bg-white border border-slate-200 p-4 space-y-2">
              <div className="h-2 w-2/3 rounded bg-slate-300" />
              <div className="h-2 w-1/2 rounded bg-slate-200" />
              <div className="h-6 w-20 rounded bg-teal-600 mt-3" />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Claro e leve, ideal para ambientes bem iluminados.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelected("dark")}
            className={cn(
              "relative rounded-xl border-2 p-6 text-left transition-all",
              "hover:border-primary/60",
              selected === "dark" ? "border-primary ring-2 ring-primary/30" : "border-border"
            )}
          >
            {selected === "dark" && (
              <span className="absolute top-3 right-3 rounded-full bg-primary text-primary-foreground p-1">
                <Check className="h-4 w-4" />
              </span>
            )}
            <div className="flex items-center gap-3 mb-3">
              <Moon className="h-6 w-6 text-primary" />
              <span className="font-semibold">Tema Escuro</span>
            </div>
            <div className="rounded-md bg-slate-900 border border-slate-700 p-4 space-y-2">
              <div className="h-2 w-2/3 rounded bg-slate-600" />
              <div className="h-2 w-1/2 rounded bg-slate-700" />
              <div className="h-6 w-20 rounded bg-teal-400 mt-3" />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Sofisticado e confortável para uso prolongado.
            </p>
          </button>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Salvando..." : "Confirmar e continuar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
