import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

let cachedToken: string | null = null;

export const useMapboxToken = () => {
  const [token, setToken] = useState<string | null>(cachedToken);
  const [loading, setLoading] = useState(!cachedToken);

  useEffect(() => {
    if (cachedToken) return;
    supabase.functions
      .invoke("get-mapbox-token")
      .then(({ data, error }) => {
        if (!error && data?.token) {
          cachedToken = data.token;
          setToken(data.token);
        }
        setLoading(false);
      });
  }, []);

  return { token, loading };
};
