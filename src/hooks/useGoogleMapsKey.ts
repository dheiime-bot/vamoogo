import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cachedKey: string | null = null;
let pendingPromise: Promise<string | null> | null = null;

/** Hook que recupera (e cacheia) a chave do Google Maps via edge function. */
export const useGoogleMapsKey = () => {
  const [key, setKey] = useState<string | null>(cachedKey);
  const [loading, setLoading] = useState(!cachedKey);

  useEffect(() => {
    if (cachedKey) {
      setKey(cachedKey);
      setLoading(false);
      return;
    }
    if (!pendingPromise) {
      pendingPromise = supabase.functions
        .invoke("get-google-maps-key")
        .then(({ data, error }) => {
          if (!error && data?.key) {
            cachedKey = data.key;
            return data.key as string;
          }
          return null;
        });
    }
    pendingPromise.then((k) => {
      setKey(k);
      setLoading(false);
    });
  }, []);

  return { key, loading };
};
