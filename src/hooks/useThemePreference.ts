import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Reads `profiles.theme_preference` for the logged user.
 * - If NULL  → returns showDialog=true (force first-login choice).
 * - If set   → syncs <html> class + localStorage to match the DB value
 *              (DB wins so the choice follows the user across devices).
 */
export function useThemePreference() {
  const { user, loading: authLoading } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const pref = (data as any)?.theme_preference as "light" | "dark" | null | undefined;

      if (!pref) {
        setShowDialog(true);
      } else {
        const root = document.documentElement;
        if (pref === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
        localStorage.setItem("theme", pref);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { showDialog, dismissDialog: () => setShowDialog(false), ready };
}
