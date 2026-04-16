/**
 * useFareEstimate
 * Calcula preço real usando Google Distance Matrix + tabela `tariffs` do banco.
 * Faz debounce automático e devolve { distanceKm, durationMin, price, loading }.
 *
 * Fórmula:
 *   price = (base_fare + per_km*km + per_minute*min) * region_multiplier
 *         + (passengers - 1) * passenger_extra
 *   price = max(price, min_fare)
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMapsKey } from "@/hooks/useGoogleMapsKey";

type Cat = "moto" | "car" | "premium";

interface Point { lat: number; lng: number }

interface Tariff {
  category: Cat;
  base_fare: number;
  per_km: number;
  per_minute: number;
  min_fare: number;
  region_multiplier: number;
  passenger_extra: number;
}

interface Result {
  distanceKm: number | null;
  durationMin: number | null;
  price: number | null;
  loading: boolean;
  error: string | null;
}

const haversineKm = (a: Point, b: Point) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const computePrice = (km: number, min: number, passengers: number, t: Tariff) => {
  const base = (t.base_fare + t.per_km * km + t.per_minute * min) * t.region_multiplier;
  const extras = Math.max(0, passengers - 1) * t.passenger_extra;
  const total = Math.max(base + extras, t.min_fare);
  return Math.round(total * 100) / 100;
};

export const useFareEstimate = (
  origin: Point | null,
  destination: Point | null,
  category: Cat,
  passengers: number = 1,
  waypoints: Point[] = []
): Result => {
  const { key } = useGoogleMapsKey();
  const [state, setState] = useState<Result>({
    distanceKm: null,
    durationMin: null,
    price: null,
    loading: false,
    error: null,
  });

  // Serializa waypoints para uso estável em deps
  const wpKey = waypoints.map((w) => `${w.lat.toFixed(5)},${w.lng.toFixed(5)}`).join("|");

  useEffect(() => {
    if (!origin || !destination) {
      setState({ distanceKm: null, durationMin: null, price: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    const timer = setTimeout(async () => {
      try {
        // 1) Buscar tarifa da categoria (default region)
        const { data: tariffData, error: tErr } = await supabase
          .from("tariffs")
          .select("category,base_fare,per_km,per_minute,min_fare,region_multiplier,passenger_extra")
          .eq("category", category)
          .eq("region", "default")
          .maybeSingle();

        if (tErr) throw tErr;
        const tariff: Tariff = (tariffData as any) || {
          category,
          base_fare: 5,
          per_km: 1.8,
          per_minute: 0.45,
          min_fare: 12,
          region_multiplier: 1,
          passenger_extra: 2,
        };

        // 2) Sequência completa de pontos: origem → paradas → destino
        const sequence: Point[] = [origin, ...waypoints, destination];

        // 3) Tentar Distance Matrix por trecho (somando). Fallback: haversine + estimativa.
        let km: number | null = null;
        let min: number | null = null;

        const g = (window as any).google;
        if (key && g?.maps?.DistanceMatrixService) {
          try {
            const svc = new g.maps.DistanceMatrixService();
            let totalMeters = 0;
            let totalSeconds = 0;
            for (let i = 0; i < sequence.length - 1; i++) {
              const a = sequence[i];
              const b = sequence[i + 1];
              const res: any = await new Promise((resolve, reject) => {
                svc.getDistanceMatrix(
                  {
                    origins: [{ lat: a.lat, lng: a.lng }],
                    destinations: [{ lat: b.lat, lng: b.lng }],
                    travelMode: g.maps.TravelMode.DRIVING,
                    unitSystem: g.maps.UnitSystem.METRIC,
                  },
                  (r: any, status: string) =>
                    status === "OK" ? resolve(r) : reject(new Error(`DM:${status}`))
                );
              });
              const elem = res?.rows?.[0]?.elements?.[0];
              if (elem && elem.status === "OK") {
                totalMeters += elem.distance.value;
                totalSeconds += elem.duration.value;
              } else {
                throw new Error("Trecho sem rota");
              }
            }
            km = Math.round((totalMeters / 1000) * 10) / 10;
            min = Math.round(totalSeconds / 60);
          } catch (e) {
            console.warn("DistanceMatrix falhou, usando haversine:", e);
          }
        }

        if (km == null || min == null) {
          let totalKm = 0;
          for (let i = 0; i < sequence.length - 1; i++) {
            totalKm += haversineKm(sequence[i], sequence[i + 1]);
          }
          km = Math.round(totalKm * 10) / 10;
          min = Math.max(3, Math.round(km * 2.5)); // ~24 km/h média urbana
        }

        const price = computePrice(km, min, passengers, tariff);
        if (!cancelled) {
          setState({ distanceKm: km, durationMin: min, price, loading: false, error: null });
        }
      } catch (e: any) {
        if (!cancelled) {
          setState({
            distanceKm: null,
            durationMin: null,
            price: null,
            loading: false,
            error: e?.message || "Erro ao calcular tarifa",
          });
        }
      }
    }, 350); // debounce

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, category, passengers, key, wpKey]);

  return state;
};
