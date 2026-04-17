/**
 * useLiveEta
 * Calcula ETA (minutos) e distância (km) ao vivo entre 2 pontos usando Google Distance Matrix,
 * com fallback haversine. Atualiza quando o ponto de origem (ex.: GPS do motorista) muda
 * significativamente (>= 80m) ou a cada 25s. Devolve null enquanto não houver dado.
 */
import { useEffect, useRef, useState } from "react";
import { useGoogleMapsKey } from "@/hooks/useGoogleMapsKey";

interface Point { lat: number; lng: number }

const haversineKm = (a: Point, b: Point) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export function useLiveEta(from: Point | null, to: Point | null, enabled = true) {
  const { key } = useGoogleMapsKey();
  const [eta, setEta] = useState<{ minutes: number; km: number } | null>(null);
  const lastFromRef = useRef<Point | null>(null);
  const lastTsRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !from || !to) { setEta(null); return; }

    // Throttle: só recalcula se moveu >= 80m OU passou 25s
    const last = lastFromRef.current;
    const now = Date.now();
    if (last) {
      const moved = haversineKm(last, from) * 1000;
      if (moved < 80 && now - lastTsRef.current < 25_000) return;
    }
    lastFromRef.current = from;
    lastTsRef.current = now;

    let cancelled = false;
    const compute = async () => {
      const g = (window as any).google;
      if (key && g?.maps?.DistanceMatrixService) {
        try {
          const svc = new g.maps.DistanceMatrixService();
          const res: any = await new Promise((resolve, reject) => {
            svc.getDistanceMatrix(
              {
                origins: [{ lat: from.lat, lng: from.lng }],
                destinations: [{ lat: to.lat, lng: to.lng }],
                travelMode: g.maps.TravelMode.DRIVING,
                unitSystem: g.maps.UnitSystem.METRIC,
              },
              (r: any, status: string) => (status === "OK" ? resolve(r) : reject(new Error(status)))
            );
          });
          const elem = res?.rows?.[0]?.elements?.[0];
          if (elem?.status === "OK" && !cancelled) {
            setEta({
              minutes: Math.max(1, Math.round(elem.duration.value / 60)),
              km: Math.round((elem.distance.value / 1000) * 10) / 10,
            });
            return;
          }
        } catch (e) {
          // fallback abaixo
        }
      }
      if (!cancelled) {
        const km = Math.round(haversineKm(from, to) * 10) / 10;
        setEta({ minutes: Math.max(1, Math.round(km * 2.5)), km });
      }
    };
    compute();
  }, [from?.lat, from?.lng, to?.lat, to?.lng, enabled, key]);

  return eta;
}
