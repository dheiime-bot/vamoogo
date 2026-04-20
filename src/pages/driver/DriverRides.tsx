/**
 * DriverRides — Histórico real de corridas do motorista logado.
 * Lê tudo de `rides` (status completed/cancelled) e calcula:
 *  - Resumos: hoje, semana, mês (somatório de driver_net)
 *  - Lista de corridas com origem, destino, valores, taxa e líquido
 */
import { useEffect, useState } from "react";
import { Clock, Navigation } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import DriverEarningsChip from "@/components/driver/DriverEarningsChip";
import DriverHomeFab from "@/components/driver/DriverHomeFab";
import ReportRideIssueModal from "@/components/shared/ReportRideIssueModal";
import ReportIssueButton from "@/components/shared/ReportIssueButton";

import StatusBadge from "@/components/shared/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Ride = {
  id: string;
  ride_code: string | null;
  origin_address: string;
  destination_address: string;
  price: number | null;
  platform_fee: number | null;
  driver_net: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  passenger_count: number;
  rating: number | null;
  rating_comment: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  status: "completed" | "cancelled" | "requested" | "accepted" | "in_progress";
  created_at: string;
};

const formatBRL = (n: number | null | undefined) =>
  n != null ? `R$ ${Number(n).toFixed(2).replace(".", ",")}` : "—";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const DriverRides = () => {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportRide, setReportRide] = useState<{ id: string; code: string | null; endedAt: string | null } | null>(null);

  const reload = async () => {
    if (!user) return;
    const ridesRes = await supabase
      .from("rides")
      .select("id, ride_code, origin_address, destination_address, price, platform_fee, driver_net, distance_km, duration_minutes, passenger_count, rating, rating_comment, status, created_at, completed_at, cancelled_at")
      .eq("driver_id", user.id)
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (ridesRes.data) setRides(ridesRes.data as any);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    reload();
    // 🔄 Realtime: atualiza histórico do motorista sem recarregar
    const channel = supabase
      .channel(`driver-rides-history-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `driver_id=eq.${user.id}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b p-4 pt-20">
        <h1 className="text-lg font-bold">Minhas Corridas</h1>
        <p className="text-xs text-muted-foreground">Histórico completo de corridas — veja seus ganhos por período na Carteira</p>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : rides.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma corrida realizada ainda</p>
          </div>
        ) : (
          rides.map((ride, i) => (
            <div
              key={ride.id}
              className="rounded-2xl border bg-card p-4 shadow-sm animate-slide-up"
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-sm font-bold font-mono text-primary">{ride.ride_code || `#${ride.id.slice(0, 8).toUpperCase()}`}</span>
                  <p className="text-xs text-muted-foreground">{formatDate(ride.created_at)}</p>
                </div>
                <StatusBadge status={ride.status as any} />
              </div>
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <p className="text-sm truncate">{ride.origin_address}</p>
                </div>
                <div className="ml-1 h-2 border-l border-dashed border-muted-foreground/30" />
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <p className="text-sm truncate">{ride.destination_address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Navigation className="h-3 w-3" />
                  {ride.distance_km ? `${Number(ride.distance_km).toFixed(1)} km` : "—"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {ride.duration_minutes ? `${ride.duration_minutes} min` : "—"}
                </span>
                <span>{ride.passenger_count} pass.</span>
              </div>
              {ride.status === "completed" && (
                <div className="flex items-center justify-between border-t pt-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Valor</p>
                      <p className="text-sm font-bold">{formatBRL(ride.price)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Taxa</p>
                      <p className="text-xs text-destructive">-{formatBRL(ride.platform_fee)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Líquido</p>
                    <p className="text-base font-extrabold text-success">{formatBRL(ride.driver_net)}</p>
                  </div>
                </div>
              )}
              <div className="mt-3 flex justify-end border-t pt-2">
                <ReportIssueButton
                  endedAt={ride.completed_at || ride.cancelled_at}
                  onClick={() => setReportRide({ id: ride.id, code: ride.ride_code, endedAt: ride.completed_at || ride.cancelled_at })}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {reportRide && (
        <ReportRideIssueModal
          open={!!reportRide}
          onClose={() => setReportRide(null)}
          rideId={reportRide.id}
          rideCode={reportRide.code}
          rideEndedAt={reportRide.endedAt}
        />
      )}

      <AppMenu role="driver" />
      <DriverEarningsChip />
      <DriverHomeFab />

    </div>
  );
};

export default DriverRides;
