/**
 * useDriverLocation
 * Hook que mantém a posição do motorista atualizada na tabela driver_locations
 * via watchPosition do navegador. Faz upsert a cada movimento significativo (>= 10m)
 * ou no máximo a cada 8s. Para de transmitir quando isOnline = false.
 *
 * Também marca is_online=false automaticamente ao fechar a aba (beforeunload)
 * e expõe `lastSyncAt` para a UI exibir o heartbeat.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Options {
  driverId: string | undefined;
  isOnline: boolean;
  category: "moto" | "economico" | "conforto" | undefined;
  onBlocked?: (message: string) => void;
}

const MIN_INTERVAL_MS = 8000;
const MIN_DISTANCE_M = 10;

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

export function useDriverLocation({ driverId, isOnline, category }: Options) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

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
        await supabase.from("driver_locations").upsert(
          {
            driver_id: driverId,
            lat,
            lng,
            is_online: true,
            category,
          },
          { onConflict: "driver_id" }
        );
        setLastSyncAt(Date.now());
      }
    })();

    if (!navigator.geolocation) {
      console.warn("Geolocalização não suportada pelo navegador.");
      return;
    }

    const broadcast = async (coords: GeolocationCoordinates) => {
      const now = Date.now();
      const last = lastSentRef.current;
      if (last) {
        const dist = distanceMeters(coords, { lat: last.lat, lng: last.lng });
        if (dist < MIN_DISTANCE_M && now - last.ts < MIN_INTERVAL_MS) return;
      }
      lastSentRef.current = { lat: coords.latitude, lng: coords.longitude, ts: now };
      await supabase.from("driver_locations").upsert(
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
      setLastSyncAt(Date.now());
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => broadcast(pos.coords),
      (err) => console.warn("Geo error (getCurrentPosition):", err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => broadcast(pos.coords),
      (err) => console.warn("Watch error:", err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
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
