import { useEffect, useState } from "react";
import { Activity, Wifi, Car } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import MapboxMap from "@/components/shared/MapboxMap";
import { supabase } from "@/integrations/supabase/client";

const AdminLive = () => {
  const [activeRides, setActiveRides] = useState<any[]>([]);
  const [stats, setStats] = useState({ online: 0, active: 0, waiting: 0 });

  const fetchLive = async () => {
    const { data: rides } = await supabase
      .from("rides")
      .select("*")
      .in("status", ["requested", "accepted", "in_progress"])
      .order("created_at", { ascending: false });
    
    if (rides) {
      setActiveRides(rides);
      setStats({
        online: 0,
        active: rides.filter((r) => r.status === "in_progress").length,
        waiting: rides.filter((r) => r.status === "requested").length,
      });
    }
  };

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 10000);
    return () => clearInterval(interval);
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => fetchLive())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const firstRide = activeRides[0];

  return (
    <AdminLayout title="Mapa ao Vivo" actions={
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
        <span className="text-xs font-medium text-success">Tempo real</span>
      </div>
    }>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {[
          { label: "Corridas ativas", value: String(stats.active), color: "text-info" },
          { label: "Aguardando motorista", value: String(stats.waiting), color: "text-warning" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 whitespace-nowrap">
            <span className={`text-lg font-extrabold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <MapboxMap
        className="h-[350px] lg:h-[450px]"
        origin={firstRide ? { lat: firstRide.origin_lat, lng: firstRide.origin_lng, label: "Origem" } : null}
        destination={firstRide ? { lat: firstRide.destination_lat, lng: firstRide.destination_lng, label: "Destino" } : null}
        showRoute={!!firstRide}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="p-4 border-b flex items-center gap-2">
            <Activity className="h-4 w-4 text-info" />
            <h3 className="text-sm font-bold">Corridas ativas ({activeRides.length})</h3>
          </div>
          <div className="divide-y max-h-80 overflow-y-auto">
            {activeRides.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma corrida ativa</p>}
            {activeRides.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{r.id.slice(0, 8)}</span>
                  <span className={`text-xs font-bold ${r.status === "in_progress" ? "text-success" : r.status === "accepted" ? "text-info" : "text-warning"}`}>
                    {r.status === "in_progress" ? "Em corrida" : r.status === "accepted" ? "Aceita" : "Aguardando"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{r.origin_address?.split(" - ")[0]} → {r.destination_address?.split(" - ")[0]}</p>
                <p className="text-xs font-bold mt-1">R$ {r.price?.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminLive;
