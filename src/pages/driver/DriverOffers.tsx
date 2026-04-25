/**
 * DriverOffers — lista de corridas disponíveis para o motorista.
 * Combina:
 *  - Ofertas direcionadas ao motorista (ride_offers status=pending, não expiradas)
 *  - Corridas em status 'requested' próximas (raio definido), como fallback
 *
 * Cada item tem botões Aceitar / Recusar.
 * Aceitar usa update atômico em rides (driver_id IS NULL + status=requested) para
 * garantir que apenas 1 motorista vença a disputa.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Car, MapPin, Clock, Loader2, CheckCircle2, XCircle, RefreshCw, Power } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import DriverEarningsChip from "@/components/driver/DriverEarningsChip";
import { isGuardError, guardErrorMessage } from "@/lib/guardErrors";
import DriverHomeFab from "@/components/driver/DriverHomeFab";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { formatBRL } from "@/lib/brFormat";

const MAX_KM = 20;

type Ride = {
  id: string;
  ride_code: string;
  status: string;
  origin_address: string;
  destination_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  passenger_count: number | null;
  category: string;
  price: number | null;
  driver_net: number | null;
  payment_method: string | null;
  created_at: string;
  stops: Array<{ name?: string; address?: string; lat?: number; lng?: number }> | null;
};

type Item = {
  ride: Ride;
  source: "offer" | "open";
  offerId?: string;
  expiresAt?: string;
  distanceKm?: number | null;
};

const haversine = (a: [number, number], b: [number, number]) => {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const DriverOffers = () => {
  const { user, driverData } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Mantém localização viva enquanto está nessa tela
  useDriverLocation({ driverId: user?.id, isOnline, category: driverData?.category });

  // Lê última posição do motorista (ou GPS do navegador)
  useEffect(() => {
    if (!user) return;
    supabase
      .from("driver_locations")
      .select("lat,lng,is_online")
      .eq("driver_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.lat && data?.lng) setCoords({ lat: data.lat, lng: data.lng });
        if (typeof data?.is_online === "boolean") setIsOnline(data.is_online);
      });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [user]);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const nowIso = new Date().toISOString();
    const category = driverData?.category;

    // 1) Ofertas direcionadas pendentes (não expiradas)
    const { data: offers } = await supabase
      .from("ride_offers")
      .select("id,ride_id,expires_at,distance_to_pickup_km,rides(*)")
      .eq("driver_id", user.id)
      .eq("status", "pending")
      .gte("expires_at", nowIso)
      .order("created_at", { ascending: false });

    const offerItems: Item[] = (offers || [])
      .filter((o: any) => o.rides && o.rides.status === "requested")
      .map((o: any) => ({
        ride: o.rides,
        source: "offer",
        offerId: o.id,
        expiresAt: o.expires_at,
        distanceKm: o.distance_to_pickup_km,
      }));

    // 2) Corridas abertas próximas (mesma categoria do motorista)
    const { data: openRides } = await supabase
      .from("rides")
      .select("*")
      .eq("status", "requested")
      .is("driver_id", null)
      .eq(category ? "category" : "id", category || "")
      .order("created_at", { ascending: false })
      .limit(20);

    const usedIds = new Set(offerItems.map((i) => i.ride.id));
    const openItems: Item[] = (openRides || [])
      .filter((r: any) => !usedIds.has(r.id))
      .map((r: any): Item => {
        const dist =
          coords && r.origin_lat && r.origin_lng
            ? haversine([coords.lat, coords.lng], [r.origin_lat, r.origin_lng])
            : null;
        return { ride: r, source: "open", distanceKm: dist };
      })
      .filter((i) => i.distanceKm == null || i.distanceKm <= MAX_KM);

    setItems([...offerItems, ...openItems]);
    setLoading(false);
  }, [user, driverData?.category, coords]);

  useEffect(() => { reload(); }, [reload]);

  // Realtime: ofertas e corridas
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`driver-offers-list-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_offers", filter: `driver_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, reload]);

  const handleAccept = async (item: Item) => {
    if (!user) return;
    setAccepting(item.ride.id);
    const { data: updated, error } = await supabase
      .from("rides")
      .update({ driver_id: user.id, status: "accepted" })
      .eq("id", item.ride.id)
      .eq("status", "requested")
      .is("driver_id", null)
      .select()
      .single();

    if (error || !updated) {
      if (error && isGuardError(error)) {
        console.error(guardErrorMessage(error, "Não foi possível aceitar a corrida"));
      } else {
        console.error("Outro motorista já aceitou esta corrida");
      }
      setAccepting(null);
      reload();
      return;
    }
    if (item.offerId) {
      await supabase
        .from("ride_offers")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", item.offerId);
    }
    setAccepting(null);
    navigate("/motorista");
  };

  const handleReject = async (item: Item) => {
    if (item.offerId) {
      await supabase
        .from("ride_offers")
        .update({ status: "rejected", responded_at: new Date().toISOString() })
        .eq("id", item.offerId);
    }
    setItems((prev) => prev.filter((i) => i.ride.id !== item.ride.id));
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.source !== b.source) return a.source === "offer" ? -1 : 1;
      return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
    });
  }, [items]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppMenu role="driver" />
      <DriverEarningsChip />
      <DriverHomeFab />

      <div className="px-4 pt-20 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold font-display">Corridas disponíveis</h1>
            <p className="text-xs text-muted-foreground">Ofertas e corridas próximas em tempo real</p>
          </div>
          <button
            onClick={reload}
            className="rounded-full p-2.5 bg-card border border-border hover:bg-muted transition-colors"
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : "text-foreground"}`} />
          </button>
        </div>

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
            <Car className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-sm font-semibold text-foreground">Sem corridas no momento</p>
            <p className="text-xs text-muted-foreground mt-1">
              Mantenha-se online — novas corridas aparecem aqui automaticamente.
            </p>
            {!isOnline && (
              <button
                onClick={() => navigate("/motorista")}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-primary text-primary-foreground px-4 py-2 text-xs font-bold"
              >
                <Power className="h-3.5 w-3.5" /> Ficar online
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item) => {
              const r = item.ride;
              const earning = Number(r.driver_net ?? r.price ?? 0);
              const isOffer = item.source === "offer";
              return (
                <div
                  key={`${item.source}-${r.id}`}
                  className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden animate-slide-up"
                >
                  <div className={`flex items-center justify-between px-4 py-2 ${isOffer ? "bg-primary/10" : "bg-muted/40"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isOffer ? "text-primary" : "text-muted-foreground"}`}>
                        {isOffer ? "★ Oferta direta" : "Corrida próxima"}
                      </span>
                      {item.distanceKm != null && (
                        <span className="text-[10px] text-muted-foreground">
                          • {item.distanceKm.toFixed(1)} km até você
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-extrabold text-success">{formatBRL(earning)}</span>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="mt-1 h-2 w-2 rounded-full bg-success shrink-0" />
                        <p className="text-sm text-foreground line-clamp-1">{r.origin_address}</p>
                      </div>
                      {Array.isArray(r.stops) && r.stops.length > 0 && (
                        <>
                          {r.stops.map((s: any, i: number) => (
                            <div key={i}>
                              <div className="ml-1 border-l-2 border-dashed border-border h-3" />
                              <div className="flex gap-2 items-start">
                                <div className="mt-1 h-2 w-2 rounded-full bg-warning shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[9px] font-semibold uppercase text-warning">Parada {i + 1}</p>
                                  <p className="text-sm text-foreground line-clamp-1">{s?.address || s?.name || "—"}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      <div className="ml-1 border-l-2 border-dashed border-border h-3" />
                      <div className="flex gap-2">
                        <MapPin className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-foreground line-clamp-1">{r.destination_address}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{r.passenger_count ?? 1} passageiro(s) • {r.payment_method || "—"}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleReject(item)}
                        disabled={accepting === r.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" /> Recusar
                      </button>
                      <button
                        onClick={() => handleAccept(item)}
                        disabled={accepting === r.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        {accepting === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Aceitar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverOffers;
