import { useEffect, useState } from "react";
import { ArrowLeft, Heart, Loader2, Star, Car } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";

interface FavRow {
  id: string;
  driver_id: string;
  created_at: string;
}

interface DriverDetails {
  user_id: string;
  full_name: string | null;
  rating: number | null;
  vehicle: string | null;
  total_rides: number | null;
}

const PassengerFavoriteDrivers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<(FavRow & { driver: DriverDetails | null })[]>([]);

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
    const [{ data: drivers }, { data: profiles }] = await Promise.all([
      supabase
        .from("drivers")
        .select("user_id, rating, total_rides, vehicle_brand, vehicle_model, vehicle_color")
        .in("user_id", ids),
      supabase.from("profiles").select("user_id, full_name").in("user_id", ids),
    ]);

    const dmap = new Map((drivers || []).map((d: any) => [d.user_id, d]));
    const pmap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    setItems(
      list.map((f) => {
        const d: any = dmap.get(f.driver_id);
        const p: any = pmap.get(f.driver_id);
        return {
          ...f,
          driver: d
            ? {
                user_id: f.driver_id,
                full_name: p?.full_name || "Motorista",
                rating: d.rating,
                total_rides: d.total_rides,
                vehicle: [d.vehicle_brand, d.vehicle_model, d.vehicle_color]
                  .filter(Boolean)
                  .join(" "),
              }
            : { user_id: f.driver_id, full_name: p?.full_name || "Motorista", rating: null, total_rides: null, vehicle: null },
        };
      })
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  useRealtimeRefresh("favorite_drivers", load, "passenger-favorites");

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
              className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3"
            >
              <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
                {(f.driver?.full_name?.[0] || "M").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  {f.driver?.full_name}
                </p>
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
                </div>
                {f.driver?.vehicle && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                    <Car className="h-3 w-3 shrink-0" />
                    {f.driver.vehicle}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeFav(f.driver_id, f.driver?.full_name || "Motorista")}
                className="shrink-0 rounded-full p-2 text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Remover dos favoritos"
              >
                <Heart className="h-5 w-5 fill-current" />
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  );
};

export default PassengerFavoriteDrivers;