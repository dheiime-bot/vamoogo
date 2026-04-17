import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Verifica se o usuário atual possui uma permissão (módulo + ação).
 * - Master tem todas as permissões.
 * - Caso contrário, consulta role_permissions + user_permissions (override).
 */
export const usePermission = (module: string, action: string) => {
  const { user, roles, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (authLoading) return;
      if (!user) { setAllowed(false); setLoading(false); return; }
      if (roles.includes("master")) { setAllowed(true); setLoading(false); return; }
      setLoading(true);
      const { data, error } = await supabase.rpc("has_permission", {
        _user_id: user.id, _module: module, _action: action,
      });
      if (cancelled) return;
      setAllowed(!error && data === true);
      setLoading(false);
    };
    check();
    return () => { cancelled = true; };
  }, [user, roles, module, action, authLoading]);

  return { allowed, loading };
};

export const useIsMaster = () => {
  const { roles } = useAuth();
  return roles.includes("master");
};
