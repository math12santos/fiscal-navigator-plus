import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function getInitialTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={cn(
        "relative flex items-center justify-center rounded-full p-2",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-secondary transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      aria-label="Alternar tema"
    >
      {theme === "dark" ? (
        <Moon size={18} className="text-primary transition-transform duration-200" />
      ) : (
        <Sun size={18} className="text-warning transition-transform duration-200" />
      )}
    </button>
  );
}
