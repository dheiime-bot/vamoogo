import { useEffect, useState } from "react";
import { ArrowLeft, Heart, Loader2, Star, Car, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface FavRow {
  id: string;
  driver_id: string;
  created_at: string;
}

interface DriverDetails {
  user_id: string;
  full_name: string | null;
  selfie_url: string | null;
  rating: number | null;
  vehicle: string | null;
  vehicle_plate: string | null;
  total_rides: number | null;
  is_online: boolean;
  distance_km: number | null;
}

const PassengerFavoriteDrivers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<(FavRow & { driver: DriverDetails | null })[]>([]);
  const [selected, setSelected] = useState<DriverDetails | null>(null);
  const [maxKm, setMaxKm] = useState<number>(5);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  // (sem estado de loading do botão — navegação é instantânea)

  // Geolocalização do passageiro
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Lê configuração admin
  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "favorite_call_max_km")
      .maybeSingle()
      .then(({ data }) => {
        const v = Number((data as any)?.value);
        if (!Number.isNaN(v) && v > 0) setMaxKm(v);
      });
  }, []);

  const load = async () => {
    if (!user?.id) return;
    const { data: favs } = await supabase
      .from("favorite_drivers")
      .select("id, driver_id, created_at")
      .eq("passenger_id", user.id)
      .order("created_at", { ascending: false });

    const list = (favs as FavRow[]) || [];
    if (list.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const ids = list.map((f) => f.driver_id);
    const { data: details } = await supabase.rpc("get_favorite_driver_details", {
      _driver_ids: ids,
      _passenger_lat: pos?.lat ?? null,
      _passenger_lng: pos?.lng ?? null,
    });
    const dmap = new Map((details || []).map((d: any) => [d.user_id, d]));

    setItems(
      list.map((f) => {
        const d: any = dmap.get(f.driver_id);
        return {
          ...f,
          driver: {
            user_id: f.driver_id,
            full_name: d?.full_name || "Motorista",
            selfie_url: d?.selfie_url || null,
            rating: d?.rating ?? null,
            total_rides: d?.total_rides ?? null,
            vehicle: [d?.vehicle_brand, d?.vehicle_model, d?.vehicle_color]
              .filter(Boolean)
              .join(" ") || null,
            vehicle_plate: d?.vehicle_plate || null,
            is_online: !!d?.is_online,
            distance_km: d?.distance_km != null ? Number(d.distance_km) : null,
          },
        };
      })
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id, pos?.lat, pos?.lng]);

  useRealtimeRefresh("favorite_drivers", load, "passenger-favorites");

  // 🔴 Realtime: status (online/offline + posição) dos motoristas favoritos.
  // Reconsulta a RPC sempre que driver_locations dos favoritos mudar.
  useEffect(() => {
    if (!user?.id || items.length === 0) return;
    const driverIds = items.map((i) => i.driver_id);
    const channel = supabase
      .channel("fav-driver-locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        (payload) => {
          const did = (payload.new as any)?.driver_id || (payload.old as any)?.driver_id;
          if (did && driverIds.includes(did)) load();
        }
      )
      .subscribe();
    // Re-poll leve a cada 20s como rede de segurança
    const t = setInterval(load, 20_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, items.map((i) => i.driver_id).join(",")]);

  const removeFav = async (driverId: string, name: string) => {
    if (!confirm(`Remover ${name} dos favoritos?`)) return;
    const { error } = await supabase.rpc("passenger_toggle_favorite_driver", {
      _driver_id: driverId,
    });
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Removido dos favoritos");
    load();
  };

  const callDriver = (driverId: string, name: string, photo: string | null) => {
    // Salva o motorista pré-selecionado para a tela de pedido de corrida
    try {
      sessionStorage.setItem(
        "preferred_driver",
        JSON.stringify({ id: driverId, name, photo, ts: Date.now() })
      );
    } catch {}
    toast.success(`Chamando ${name}…`);
    navigate("/passenger?preferred=" + encodeURIComponent(driverId));
  };

  const canCall = (d: DriverDetails | null) =>
    !!d && d.is_online && d.distance_km != null && d.distance_km <= maxKm;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate("/passenger")}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-display font-bold">Motoristas favoritos</h1>
      </header>

      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Heart className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-semibold">Sua lista está vazia</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ao final de cada corrida, toque no coração para favoritar o motorista.
            </p>
          </div>
        ) : (
          items.map((f) => (
            <article
              key={f.id}
              className="rounded-2xl border border-border bg-card p-4 space-y-3"
            >
              <div
                onClick={() => f.driver && setSelected(f.driver)}
                className="flex items-center gap-3 cursor-pointer"
              >
              {f.driver?.selfie_url ? (
                <img
                  src={f.driver.selfie_url}
                  alt={f.driver.full_name || "Motorista"}
                  className="h-12 w-12 rounded-full object-cover shrink-0 border border-border"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
                  {(f.driver?.full_name?.[0] || "M").toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">
                    {f.driver?.full_name}
                  </p>
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      f.driver?.is_online ? "bg-success animate-pulse" : "bg-muted-foreground/40"
                    }`}
                    aria-label={f.driver?.is_online ? "online" : "offline"}
                  />
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  {f.driver?.rating != null && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-warning fill-warning" />
                      {Number(f.driver.rating).toFixed(2)}
                    </span>
                  )}
                  {f.driver?.total_rides != null && (
                    <span>{f.driver.total_rides} corridas</span>
                  )}
                  {f.driver?.is_online && f.driver?.distance_km != null && (
                    <span>{f.driver.distance_km.toFixed(1)} km</span>
                  )}
                </div>
                {f.driver?.vehicle && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                    <Car className="h-3 w-3 shrink-0" />
                    {f.driver.vehicle}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFav(f.driver_id, f.driver?.full_name || "Motorista");
                }}
                className="shrink-0 rounded-full p-2 text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Remover dos favoritos"
              >
                <Heart className="h-5 w-5 fill-current" />
              </button>
              </div>

              <button
                disabled={!canCall(f.driver)}
                onClick={() =>
                  callDriver(
                    f.driver_id,
                    f.driver?.full_name || "Motorista",
                    f.driver?.selfie_url || null
                  )
                }
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground shadow-glow disabled:bg-muted disabled:bg-none disabled:text-muted-foreground disabled:shadow-none disabled:cursor-not-allowed transition-all"
              >
                <Phone className="h-4 w-4" />
                {!f.driver?.is_online
                  ? "Offline"
                  : f.driver?.distance_km == null
                  ? "Sem localização"
                  : f.driver.distance_km > maxKm
                  ? `Longe (${f.driver.distance_km.toFixed(1)} km > ${maxKm} km)`
                  : `Chamar (${f.driver.distance_km.toFixed(1)} km)`}
              </button>
            </article>
          ))
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          {selected && (
            <div className="flex flex-col items-center text-center p-6">
              {selected.selfie_url ? (
                <img
                  src={selected.selfie_url}
                  alt={selected.full_name || "Motorista"}
                  className="h-24 w-24 rounded-full object-cover border-4 border-primary/20 shadow-lg"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-3xl shadow-lg">
                  {(selected.full_name?.[0] || "M").toUpperCase()}
                </div>
              )}
              <h2 className="mt-4 text-lg font-display font-bold">
                {selected.full_name}
              </h2>

              <div className="mt-3 flex items-center gap-4 text-sm">
                {selected.rating != null && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-warning fill-warning" />
                    <span className="font-semibold">
                      {Number(selected.rating).toFixed(2)}
                    </span>
                  </div>
                )}
                {selected.total_rides != null && (
                  <div className="text-muted-foreground">
                    {selected.total_rides} corridas
                  </div>
                )}
              </div>

              {selected.vehicle && (
                <div className="mt-4 w-full rounded-xl border border-border bg-muted/40 p-3 text-left">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Car className="h-3.5 w-3.5" />
                    Veículo
                  </div>
                  <p className="mt-1 text-sm font-medium">{selected.vehicle}</p>
                  {selected.vehicle_plate && (
                    <p className="mt-0.5 text-xs font-mono text-muted-foreground">
                      {selected.vehicle_plate}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PassengerFavoriteDrivers;