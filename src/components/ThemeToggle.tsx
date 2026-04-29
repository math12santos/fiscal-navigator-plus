import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export type ThemeChoice = "dark" | "light" | "system";

function systemPrefers(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitial(): ThemeChoice {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function applyResolved(choice: ThemeChoice) {
  const resolved = choice === "system" ? systemPrefers() : choice;
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(getInitial);

  // Apply + persist to localStorage + DB
  useEffect(() => {
    applyResolved(choice);
    localStorage.setItem("theme", choice);

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase
        .from("profiles")
        .update({ theme_preference: choice } as any)
        .eq("id", uid)
        .then(() => {});
    });
  }, [choice]);

  // Listen to OS preference changes when in 'system' mode
  useEffect(() => {
    if (choice !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyResolved("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [choice]);

  const cycle = useCallback(() => {
    // light → dark → light (manual)
    setChoice((c) => {
      if (c === "system") return systemPrefers() === "dark" ? "light" : "dark";
      return c === "dark" ? "light" : "dark";
    });
  }, []);

  const resetToSystem = useCallback(() => setChoice("system"), []);

  const resolved = choice === "system" ? systemPrefers() : choice;
  const isSystem = choice === "system";

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={cycle}
        className={cn(
          "relative flex items-center justify-center rounded-full p-2",
          "text-muted-foreground hover:text-foreground",
          "hover:bg-secondary transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        title={
          isSystem
            ? `Tema seguindo o sistema (${resolved === "dark" ? "escuro" : "claro"})`
            : resolved === "dark"
            ? "Ativar tema claro"
            : "Ativar tema escuro"
        }
        aria-label="Alternar tema"
      >
        {resolved === "dark" ? (
          <Moon size={18} className="text-primary" />
        ) : (
          <Sun size={18} className="text-warning" />
        )}
        {isSystem && (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background p-0.5">
            <Monitor size={10} className="text-muted-foreground" />
          </span>
        )}
      </button>
      {!isSystem && (
        <button
          onClick={resetToSystem}
          className={cn(
            "flex items-center justify-center rounded-full p-1.5",
            "text-muted-foreground/60 hover:text-foreground",
            "hover:bg-secondary transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          title="Redefinir para o padrão do sistema"
          aria-label="Redefinir tema para o padrão do sistema"
        >
          <Monitor size={14} />
        </button>
      )}
    </div>
  );
}
