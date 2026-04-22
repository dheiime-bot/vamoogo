/**
 * useCityCache
 * Quando o usuário concede GPS, dispara em background a edge function
 * `cache-city-places` para indexar todos os locais (supermercados, farmácias,
 * restaurantes etc.) num raio em torno da posição. Idempotente — a função
 * pula execuções recentes (< 30 dias) automaticamente via city_sync_log.
 *
 * Também marca em localStorage para evitar disparar mais de uma vez por sessão.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "vmg:city_cache_triggered";

export function useCityCache(coords: { lat: number; lng: number } | null, opts?: { radius?: number }) {
  const triggered = useRef(false);

  useEffect(() => {
    if (!coords || triggered.current) return;
    // chave reduzida (~1km) para agrupar
    const key = `${coords.lat.toFixed(2)},${coords.lng.toFixed(2)}`;
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached === key) {
      triggered.current = true;
      return;
    }

    triggered.current = true;
    sessionStorage.setItem(SESSION_KEY, key);

    // Dispara em background — não bloqueia UI
    supabase.functions
      .invoke("cache-city-places", {
        body: {
          lat: coords.lat,
          lng: coords.lng,
          radius: opts?.radius ?? 8000,
          cityKey: key,
        },
      })
      .then(({ data, error }) => {
        if (error) {
          console.warn("[useCityCache] erro:", error);
          return;
        }
        // sucesso silencioso — sem logs em loop
        void data;
      })
      .catch((e) => console.warn("[useCityCache] falha:", e));
  }, [coords?.lat, coords?.lng, opts?.radius]);
}
