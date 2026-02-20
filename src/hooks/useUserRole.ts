import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserRole() {
  const { user } = useAuth();
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsMaster(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      const { data, error } = await supabase.rpc("has_role" as any, {
        _user_id: user.id,
        _role: "master",
      });
      if (!error && data === true) {
        setIsMaster(true);
      } else {
        setIsMaster(false);
      }
      setLoading(false);
    };

    check();
  }, [user]);

  return { isMaster, loading };
}
