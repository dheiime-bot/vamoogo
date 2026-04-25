/**
 * useDriverLocation
 * Mantém a posição do motorista atualizada na tabela driver_locations.
 *
 * Consome o GPS singleton global (`gpsTracker`), que já está rodando desde o
 * boot do app — assim, quando `isOnline=true`, o primeiro upsert acontece
 * EM MILISSEGUNDOS (sem esperar o navegador "acordar" o GPS).
 *
 * Regras:
 *  - Faz upsert imediato com a última posição em cache ao ficar online.
 *  - Em movimento, faz upsert quando deslocou >= 3m OU passaram >= 2.5s.
 *  - Para de transmitir quando isOnline = false e marca offline no banco.
 *  - Marca offline ao fechar/ocultar a aba (beforeunload / pagehide).
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isGuardError } from "@/lib/guardErrors";
import {
  initGpsTracker,
  subscribeGps,
  getLastFix,
  refreshGpsNow,
  type GpsFix,
} from "@/lib/gpsTracker";

interface Options {
  driverId: string | undefined;
  isOnline: boolean;
  category: "moto" | "economico" | "conforto" | undefined;
  onBlocked?: (message: string) => void;
}

const MIN_INTERVAL_MS = 2500;
const MIN_DISTANCE_M = 3;

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useDriverLocation({ driverId, isOnline, category, onBlocked }: Options) {
  const lastSentRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const permissionToastRef = useRef<number>(0);

  // Garante que o tracker global está vivo desde o primeiro render.
  useEffect(() => {
    initGpsTracker();
  }, []);

  // Verifica permissão proativamente.
  useEffect(() => {
    if (!isOnline) return;
    (async () => {
      try {
        // @ts-ignore - geolocation é válido em navigator.permissions
        const status = await navigator.permissions?.query({ name: "geolocation" });
        if (status?.state === "denied") {
          const now = Date.now();
          if (now - permissionToastRef.current > 30000) {
            permissionToastRef.current = now;
            toast.error(
              "Permissão de GPS bloqueada. Habilite nas configurações do navegador para ficar online.",
              { duration: 8000 },
            );
          }
        }
      } catch {
        /* navegador sem Permissions API — segue normal */
      }
    })();
  }, [isOnline]);

  // Auto-offline ao fechar/ocultar a aba
  useEffect(() => {
    if (!driverId || !isOnline || !category) return;

    const markOffline = () => {
      try {
        const url = `https://xsbvfwxyxgnkfkafxtaa.supabase.co/rest/v1/motorista_locations?on_conflict=driver_id`;
        const body = JSON.stringify({
          driver_id: driverId,
          is_online: false,
          lat: lastSentRef.current?.lat ?? 0,
          lng: lastSentRef.current?.lng ?? 0,
          category,
        });
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
            "apikey":
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzYnZmd3h5eGdua2ZrYWZ4dGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjI5NzQsImV4cCI6MjA5MTM5ODk3NH0.4N9iepKAVEWq7wvPJ21kDH_AvWdXSHcwCpBshWMXjNA",
          },
          body,
          keepalive: true,
        }).catch(() => {});
      } catch (_) {}
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") markOffline();
    };

    window.addEventListener("beforeunload", markOffline);
    window.addEventListener("pagehide", markOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("beforeunload", markOffline);
      window.removeEventListener("pagehide", markOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [driverId, isOnline, category]);

  // Stream principal: assina o tracker global e faz upsert no banco
  useEffect(() => {
    if (!driverId || !category) return;

    // Ficou OFFLINE → marca offline e encerra.
    if (!isOnline) {
      supabase
        .from("driver_locations")
        .upsert(
          {
            driver_id: driverId,
            is_online: false,
            lat: lastSentRef.current?.lat ?? 0,
            lng: lastSentRef.current?.lng ?? 0,
            category,
          },
          { onConflict: "driver_id" },
        )
        .then(() => {});
      setLastSyncAt(null);
      return;
    }

    let cancelled = false;

    const broadcast = async (fix: GpsFix, force = false) => {
      const now = Date.now();
      const last = lastSentRef.current;
      if (!force && last) {
        const dist = distanceMeters(fix, last);
        if (dist < MIN_DISTANCE_M && now - last.ts < MIN_INTERVAL_MS) {
          // Heartbeat local para a UI (sem hit no banco).
          setLastSyncAt(now);
          return;
        }
      }
      lastSentRef.current = { lat: fix.lat, lng: fix.lng, ts: now };
      const { error } = await supabase.from("driver_locations").upsert(
        {
          driver_id: driverId,
          lat: fix.lat,
          lng: fix.lng,
          heading: fix.heading ?? 0,
          is_online: true,
          category,
        },
        { onConflict: "driver_id" },
      );
      if (cancelled) return;
      if (error) {
        if (isGuardError(error)) onBlocked?.(error.message!);
        else console.warn("driver_locations upsert error:", error.message);
        return;
      }
      setLastSyncAt(Date.now());
    };

    // 1) Se já temos um fix em cache → upsert IMEDIATO (milissegundos).
    const cached = getLastFix();
    if (cached) {
      void broadcast(cached, true);
    } else {
      // 2) Sem cache: tenta marcar online com a última posição salva no banco
      //    para não ficar invisível para passageiros enquanto o GPS retorna.
      (async () => {
        const { data } = await supabase
          .from("driver_locations")
          .select("lat,lng")
          .eq("driver_id", driverId)
          .maybeSingle();
        if (cancelled) return;
        if (data && data.lat && data.lng && Number(data.lat) !== 0 && Number(data.lng) !== 0) {
          const lat = Number(data.lat);
          const lng = Number(data.lng);
          lastSentRef.current = { lat, lng, ts: Date.now() };
          await supabase.from("driver_locations").upsert(
            {
              driver_id: driverId,
              lat,
              lng,
              is_online: true,
              category,
            },
            { onConflict: "driver_id" },
          );
          if (!cancelled) setLastSyncAt(Date.now());
        }
      })();
    }

    // 3) Pede uma leitura fresca imediata (não bloqueia o broadcast acima).
    refreshGpsNow();

    // 4) Inscreve no stream contínuo: cada nova posição faz upsert (com throttle).
    const unsubscribe = subscribeGps((fix) => {
      void broadcast(fix);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [driverId, isOnline, category]);

  return { lastSyncAt };
}
