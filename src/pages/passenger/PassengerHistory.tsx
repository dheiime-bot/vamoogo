import { useEffect, useState } from "react";
import { Clock, ChevronRight } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import HomeFab from "@/components/passageiro/HomeFab";
import ReportRideIssueModal from "@/components/shared/ReportRideIssueModal";
import ReportIssueButton from "@/components/shared/ReportIssueButton";
import RideDetailsDialog from "@/components/shared/RideDetailsDialog";

import StatusBadge from "@/components/shared/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const PassengerHistory = () => {
  const { user } = useAuth();
  const [rides, setRides] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [reportRide, setReportRide] = useState<{ id: string; code: string | null; endedAt: string | null } | null>(null);
  const [detailsRideId, setDetailsRideId] = useState<string | null>(null);

  const reload = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("passenger_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setRides(data);
  };

  useEffect(() => {
    if (!user) return;
    reload();
    // 🔄 Realtime: lista atualiza sozinha quando uma corrida muda
    const channel = supabase
      .channel(`passenger-history-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `passenger_id=eq.${user.id}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = filter === "all" ? rides : rides.filter((r) => r.status === filter);
  const catLabel = (c: string) => c === "moto" ? "Moto" : c === "conforto" ? "Conforto" : "Econômico";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b p-4 pt-20">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold font-display">Minhas Corridas</h1>
          <div className="flex gap-1">
            {(["all", "completed", "cancelled"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {f === "all" ? "Todas" : f === "completed" ? "Concluídas" : "Canceladas"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma corrida encontrada</p>
          </div>
        )}
        {filtered.map((ride, i) => (
          <div
            key={ride.id}
            className="rounded-2xl border bg-card p-4 shadow-sm animate-slide-up"
            style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                {ride.ride_code && (
                  <button
                    onClick={() => setDetailsRideId(ride.id)}
                    className="text-xs font-mono font-semibold text-primary hover:underline"
                  >
                    {ride.ride_code}
                  </button>
                )}
                <p className="text-xs text-muted-foreground">{new Date(ride.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                <p className="text-xs font-medium text-muted-foreground">{catLabel(ride.category)} • {ride.distance_km} km • ~{ride.duration_minutes} min</p>
              </div>
              <StatusBadge status={ride.status as any} />
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                <p className="text-sm">{ride.origin_address?.split(" - ")[0]}</p>
              </div>
              <div className="ml-1 h-3 border-l border-dashed border-muted-foreground/30" />
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-destructive mt-1.5" />
                <p className="text-sm">{ride.destination_address?.split(" - ")[0]}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <p className="text-lg font-bold">R$ {ride.price?.toFixed(2) || "—"}</p>
              <ReportIssueButton
                endedAt={ride.completed_at || ride.cancelled_at}
                onClick={() => setReportRide({ id: ride.id, code: ride.ride_code, endedAt: ride.completed_at || ride.cancelled_at })}
              />
            </div>
          </div>
        ))}
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

      <RideDetailsDialog
        rideId={detailsRideId}
        open={!!detailsRideId}
        onClose={() => setDetailsRideId(null)}
        role="passenger"
      />

      <AppMenu role="passenger" />
      <HomeFab />
    </div>
  );
};

export default PassengerHistory;
