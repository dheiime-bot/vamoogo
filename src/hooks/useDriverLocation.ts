/**
 * useDriverLocation
 * Hook que mantém a posição do motorista atualizada na tabela driver_locations
 * via watchPosition do navegador. Faz upsert a cada movimento significativo (>= 10m)
 * ou no máximo a cada 8s. Para de transmitir quando isOnline = false.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Options {
  driverId: string | undefined;
  isOnline: boolean;
  category: "moto" | "car" | "premium" | undefined;
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
      return;
    }

    if (!navigator.geolocation) return;

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
    };

    // 1ª posição imediatamente
    navigator.geolocation.getCurrentPosition(
      (pos) => broadcast(pos.coords),
      (err) => console.warn("Geo error:", err),
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Watch contínuo
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => broadcast(pos.coords),
      (err) => console.warn("Watch error:", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [driverId, isOnline, category]);
}
