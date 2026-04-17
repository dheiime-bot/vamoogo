import { useEffect, useState } from "react";
import { Clock, ChevronRight } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import NotificationBell from "@/components/shared/NotificationBell";

import StatusBadge from "@/components/shared/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const PassengerHistory = () => {
  const { user } = useAuth();
  const [rides, setRides] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("rides")
      .select("*")
      .eq("passenger_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setRides(data); });
  }, [user]);

  const filtered = filter === "all" ? rides : rides.filter((r) => r.status === filter);
  const catLabel = (c: string) => c === "moto" ? "Moto" : c === "conforto" ? "Conforto" : "Econômico";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b p-4">
        <div className="flex items-center justify-between">
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
                  <p className="text-xs font-mono font-semibold text-primary">{ride.ride_code}</p>
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
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>

      <AppMenu role="passenger" />
      <NotificationBell />
      <UserMenu role="passenger" />
    </div>
  );
};

export default PassengerHistory;
