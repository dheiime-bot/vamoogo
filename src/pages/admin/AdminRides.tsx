import { useEffect, useState } from "react";
import { Search, Eye, XCircle, Play, Flag, ArrowRightLeft } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import StatusBadge from "@/components/shared/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminRides = () => {
  const [rides, setRides] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchRides = async () => {
    const { data } = await supabase
      .from("rides")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setRides(data);
  };

  useEffect(() => { fetchRides(); }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-rides")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => fetchRides())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateRide = async (id: string, update: any, msg: string) => {
    await supabase.from("rides").update(update).eq("id", id);
    toast.success(msg);
    fetchRides();
  };

  const filtered = rides.filter((r) => {
    const matchSearch = !search || r.origin_address?.toLowerCase().includes(search.toLowerCase()) || r.destination_address?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const rideStatusMap: Record<string, "active" | "completed" | "cancelled" | "pending"> = {
    requested: "pending", accepted: "active", in_progress: "active", completed: "completed", cancelled: "cancelled",
  };

  return (
    <AdminLayout title="Corridas">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar por endereço..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {["all", "requested", "accepted", "in_progress", "completed", "cancelled"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {s === "all" ? "Todas" : s === "requested" ? "Solicitadas" : s === "accepted" ? "Aceitas" : s === "in_progress" ? "Em andamento" : s === "completed" ? "Concluídas" : "Canceladas"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma corrida encontrada</p>}
        {filtered.map((ride, i) => (
          <div key={ride.id} className="rounded-2xl border bg-card p-4 shadow-sm animate-slide-up" style={{ animationDelay: `${i * 30}ms`, animationFillMode: "both" }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{ride.id.slice(0, 8)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">{ride.category}</span>
                  <span className="text-xs text-muted-foreground">{ride.passenger_count} pass.</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(ride.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <StatusBadge status={rideStatusMap[ride.status] || "pending"} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-success" /><p className="text-sm truncate">{ride.origin_address?.split(" - ")[0]}</p></div>
                <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-destructive" /><p className="text-sm truncate">{ride.destination_address?.split(" - ")[0]}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Distância</span><p className="font-medium">{ride.distance_km} km</p></div>
                <div><span className="text-muted-foreground">Duração</span><p className="font-medium">{ride.duration_minutes} min</p></div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-4">
                <div><p className="text-xs text-muted-foreground">Valor</p><p className="text-base font-bold">R$ {ride.price?.toFixed(2) || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Taxa</p><p className="text-sm font-semibold text-primary">R$ {ride.platform_fee?.toFixed(2) || "—"}</p></div>
              </div>
              <div className="flex gap-1">
                {ride.status === "requested" && (
                  <button onClick={() => updateRide(ride.id, { status: "cancelled", cancelled_at: new Date().toISOString() }, "Corrida cancelada")} className="rounded-lg p-1.5 hover:bg-destructive/10" title="Cancelar">
                    <XCircle className="h-4 w-4 text-destructive" />
                  </button>
                )}
                {ride.status === "accepted" && (
                  <button onClick={() => updateRide(ride.id, { status: "in_progress", started_at: new Date().toISOString() }, "Corrida iniciada")} className="rounded-lg p-1.5 hover:bg-success/10" title="Iniciar">
                    <Play className="h-4 w-4 text-success" />
                  </button>
                )}
                {ride.status === "in_progress" && (
                  <button onClick={() => updateRide(ride.id, { status: "completed", completed_at: new Date().toISOString() }, "Corrida finalizada")} className="rounded-lg p-1.5 hover:bg-primary/10" title="Finalizar">
                    <Flag className="h-4 w-4 text-primary" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminRides;
