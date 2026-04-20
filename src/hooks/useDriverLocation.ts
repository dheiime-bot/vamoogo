/**
 * useDriverLocation
 * Hook que mantém a posição do motorista atualizada na tabela driver_locations
 * via watchPosition do navegador. Faz upsert a cada movimento significativo (>= 3m)
 * ou no máximo a cada 2.5s. Para de transmitir quando isOnline = false.
 *
 * Também marca is_online=false automaticamente ao fechar a aba (beforeunload)
 * e expõe `lastSyncAt` para a UI exibir o heartbeat.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Options {
  driverId: string | undefined;
  isOnline: boolean;
  category: "moto" | "economico" | "conforto" | undefined;
  onBlocked?: (message: string) => void;
}

const MIN_INTERVAL_MS = 2500;
const MIN_DISTANCE_M = 3;

function distanceMeters(a: GeolocationCoordinates, b: { lat: number; lng: number }) {
  const r = 6371000;
  const dLat = ((b.lat - a.latitude) * Math.PI) / 180;
  const dLng = ((b.lng - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useDriverLocation({ driverId, isOnline, category, onBlocked }: Options) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const errorToastRef = useRef<number>(0);

  const handleGeoError = (err: GeolocationPositionError, context: string) => {
    console.warn(`Geo error (${context}):`, err.code, err.message);
    // Throttle: 1 toast a cada 30s no máximo
    const now = Date.now();
    if (now - errorToastRef.current < 30000) return;
    errorToastRef.current = now;
    if (err.code === err.PERMISSION_DENIED) {
      toast.error("Permissão de GPS negada. Habilite a localização nas configurações do navegador.", { duration: 8000 });
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      toast.error("GPS indisponível. Verifique se a localização do dispositivo está ligada.");
    } else if (err.code === err.TIMEOUT) {
      toast.error("Tempo esgotado ao obter GPS. Tentando novamente...");
    }
  };

  // Auto-offline ao fechar/ocultar a aba
  useEffect(() => {
    if (!driverId || !isOnline || !category) return;

    const markOffline = () => {
      try {
        const url = `https://xsbvfwxyxgnkfkafxtaa.supabase.co/rest/v1/driver_locations?on_conflict=driver_id`;
        const body = JSON.stringify({
          driver_id: driverId,
          is_online: false,
          lat: lastSentRef.current?.lat ?? 0,
          lng: lastSentRef.current?.lng ?? 0,
          category,
        });
        const blob = new Blob([body], { type: "application/json" });
        // sendBeacon não permite headers customizados; o melhor esforço é via fetch keepalive
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzYnZmd3h5eGdua2ZrYWZ4dGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjI5NzQsImV4cCI6MjA5MTM5ODk3NH0.4N9iepKAVEWq7wvPJ21kDH_AvWdXSHcwCpBshWMXjNA",
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

  useEffect(() => {
    if (!driverId || !category) return;

    // Quando ficar offline → marca offline no banco e para o watch
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
          { onConflict: "driver_id" }
        )
        .then(() => {});
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setLastSyncAt(null);
      return;
    }

    // ⚡ Marca online com a última posição conhecida (cache em memória ou banco).
    // SÓ marca is_online=true se tivermos lat/lng VÁLIDOS (≠ 0). Senão aguardamos o GPS.
    (async () => {
      let lat = lastSentRef.current?.lat;
      let lng = lastSentRef.current?.lng;
      if (!lat || !lng) {
        const { data } = await supabase
          .from("driver_locations")
          .select("lat,lng")
          .eq("driver_id", driverId)
          .maybeSingle();
        if (data && data.lat && data.lng && Number(data.lat) !== 0 && Number(data.lng) !== 0) {
          lat = Number(data.lat);
          lng = Number(data.lng);
          lastSentRef.current = { lat, lng, ts: Date.now() };
        }
      }
      if (lat && lng && lat !== 0 && lng !== 0) {
        const { error } = await supabase.from("driver_locations").upsert(
          {
            driver_id: driverId,
            lat,
            lng,
            is_online: true,
            category,
          },
          { onConflict: "driver_id" }
        );
        if (error) {
          const { isGuardError } = await import("@/lib/guardErrors");
          if (isGuardError(error)) onBlocked?.(error.message!);
          else console.warn("driver_locations upsert error:", error.message);
          return;
        }
        setLastSyncAt(Date.now());
      }
    })();

    if (!navigator.geolocation) {
      console.warn("Geolocalização não suportada pelo navegador.");
      toast.error("Geolocalização não suportada por este navegador");
      return;
    }

    const broadcast = async (coords: GeolocationCoordinates) => {
      const now = Date.now();
      const last = lastSentRef.current;
      if (last) {
        const dist = distanceMeters(coords, { lat: last.lat, lng: last.lng });
        if (dist < MIN_DISTANCE_M && now - last.ts < MIN_INTERVAL_MS) {
          // Mesmo sem upsert, marca heartbeat local para a UI mostrar GPS vivo.
          setLastSyncAt(now);
          return;
        }
      }
      lastSentRef.current = { lat: coords.latitude, lng: coords.longitude, ts: now };
      const { error } = await supabase.from("driver_locations").upsert(
        {
          driver_id: driverId,
          lat: coords.latitude,
          lng: coords.longitude,
          heading: coords.heading ?? 0,
          is_online: true,
          category,
        },
        { onConflict: "driver_id" }
      );
      if (error) {
        const { isGuardError } = await import("@/lib/guardErrors");
        if (isGuardError(error)) onBlocked?.(error.message!);
        return;
      }
      setLastSyncAt(Date.now());
    };

    // Verifica permissão proativamente (quando suportado pelo navegador)
    (async () => {
      try {
        // @ts-ignore - geolocation é válido em navigator.permissions
        const status = await navigator.permissions?.query({ name: "geolocation" });
        if (status?.state === "denied") {
          toast.error("Permissão de GPS bloqueada. Habilite nas configurações do navegador para ficar online.", { duration: 8000 });
          return;
        }
      } catch { /* navegador sem Permissions API — segue normal */ }
    })();

    // Primeira leitura: alta precisão com fallback para baixa precisão
    navigator.geolocation.getCurrentPosition(
      (pos) => broadcast(pos.coords),
      (err) => {
        if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
          // Fallback: baixa precisão (mais rápido, funciona em desktops sem GPS dedicado)
          navigator.geolocation.getCurrentPosition(
            (pos) => broadcast(pos.coords),
            (err2) => handleGeoError(err2, "getCurrentPosition fallback"),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
          );
        } else {
          handleGeoError(err, "getCurrentPosition");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60 * 1000 }
    );

    // Watch contínuo: alta precisão (se falhar repetidamente, o callback de erro alerta)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => broadcast(pos.coords),
      (err) => handleGeoError(err, "watchPosition"),
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 8000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [driverId, isOnline, category]);

  return { lastSyncAt };
}
