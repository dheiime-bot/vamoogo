import { useEffect, useState } from "react";
import { Search, X, AlertTriangle, Route } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import RideActionsMenu from "@/components/admin/rides/RideActionsMenu";
import RideDetailsModal from "@/components/admin/rides/RideDetailsModal";
import RideCancelDialog from "@/components/admin/rides/RideCancelDialog";
import RideAdjustPriceDialog from "@/components/admin/rides/RideAdjustPriceDialog";
import RideIssueDialog from "@/components/admin/rides/RideIssueDialog";
import RidePaymentDialog from "@/components/admin/rides/RidePaymentDialog";
import RideAddNoteDialog from "@/components/admin/rides/RideAddNoteDialog";

const AdminRides = () => {
  const [rides, setRides] = useState<any[]>([]);
  const [routeChanges, setRouteChanges] = useState<Record<string, { count: number; lastTo: string; lastDiff: number | null }>>({});
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Dialog state
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [cancelRide, setCancelRide] = useState<any | null>(null);
  const [adjustRide, setAdjustRide] = useState<any | null>(null);
  const [issueRide, setIssueRide] = useState<any | null>(null);
  const [paymentRide, setPaymentRide] = useState<any | null>(null);
  const [noteRide, setNoteRide] = useState<any | null>(null);

  const fetchRides = async () => {
    const { data } = await supabase
      .from("rides")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      setRides(data);
      const ids = data.map((r: any) => r.id);
      if (ids.length) {
        const { data: changes } = await supabase
          .from("ride_route_changes")
          .select("ride_id, new_destination_address, previous_price, new_price, created_at")
          .in("ride_id", ids)
          .order("created_at", { ascending: true });
        const map: Record<string, { count: number; lastTo: string; lastDiff: number | null }> = {};
        (changes || []).forEach((c: any) => {
          const cur = map[c.ride_id] || { count: 0, lastTo: "", lastDiff: null };
          cur.count += 1;
          cur.lastTo = c.new_destination_address;
          cur.lastDiff = c.previous_price != null && c.new_price != null
            ? Number(c.new_price) - Number(c.previous_price)
            : null;
          map[c.ride_id] = cur;
        });
        setRouteChanges(map);
      } else {
        setRouteChanges({});
      }
    }
  };

  useEffect(() => { fetchRides(); }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-rides")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => fetchRides())
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_route_changes" }, () => fetchRides())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Normaliza: "vamoo 1000" / "VAMOO1000" / "1000" → "VAMOO1000"
  const normalizeCode = (s: string) => {
    const cleaned = (s || "").toUpperCase().replace(/\s+/g, "");
    if (/^\d+$/.test(cleaned)) return `VAMOO${cleaned}`;
    return cleaned;
  };

  const filtered = rides.filter((r) => {
    const q = search.toLowerCase().trim();
    const codeQuery = normalizeCode(search);
    const matchSearch = !search
      || (codeQuery && r.ride_code?.toUpperCase().includes(codeQuery))
      || r.origin_address?.toLowerCase().includes(q)
      || r.destination_address?.toLowerCase().includes(q)
      || r.id?.toLowerCase().startsWith(q);
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const rideStatusMap: Record<string, "active" | "completed" | "cancelled" | "pending"> = {
    requested: "pending", accepted: "active", in_progress: "active", completed: "completed", cancelled: "cancelled",
  };

  return (
    <AdminLayout title="Corridas" actions={<span className="text-sm text-muted-foreground">{filtered.length} de {rides.length}</span>}>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            placeholder="Buscar por chave (VAMOO1000 ou 1000), endereço ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="rounded-full p-1 hover:bg-muted" title="Limpar">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
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
        {filtered.length === 0 && <EmptyState title="Nenhuma corrida encontrada" description="Ajuste os filtros ou aguarde novas corridas serem solicitadas." />}
        {filtered.map((ride, i) => (
          <div key={ride.id} className="rounded-2xl border bg-card p-4 shadow-sm animate-slide-up" style={{ animationDelay: `${i * 30}ms`, animationFillMode: "both" }}>
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {ride.ride_code && (
                    <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{ride.ride_code}</span>
                  )}
                  <span className="text-xs font-mono text-muted-foreground">{ride.id.slice(0, 8)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">{ride.category}</span>
                  <span className="text-xs text-muted-foreground">{ride.passenger_count} pass.</span>
                  {ride.issue_flag && (
                    <span className="text-[10px] font-bold uppercase rounded-full bg-warning/15 text-warning px-2 py-0.5 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {ride.issue_flag}
                    </span>
                  )}
                  {ride.payment_status && ride.payment_status !== "pending" && (
                    <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${
                      ride.payment_status === "paid" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"
                    }`}>
                      {ride.payment_status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(ride.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <StatusBadge status={rideStatusMap[ride.status] || "pending"} />
                <RideActionsMenu
                  ride={ride}
                  onView={() => setDetailsId(ride.id)}
                  onMap={() => setDetailsId(ride.id)}
                  onContact={() => setDetailsId(ride.id)}
                  onRatings={() => setDetailsId(ride.id)}
                  onPayment={() => setPaymentRide(ride)}
                  onAdjustPrice={() => setAdjustRide(ride)}
                  onIssue={() => setIssueRide(ride)}
                  onCancel={() => setCancelRide(ride)}
                  onAddNote={() => setNoteRide(ride)}
                />
              </div>
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
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="text-base font-bold">R$ {ride.price?.toFixed(2) || "—"}</p>
                  {ride.original_price && Number(ride.original_price) !== Number(ride.price) && (
                    <p className="text-[10px] text-muted-foreground line-through">R$ {Number(ride.original_price).toFixed(2)}</p>
                  )}
                </div>
                <div><p className="text-xs text-muted-foreground">Taxa</p><p className="text-sm font-semibold text-primary">R$ {ride.platform_fee?.toFixed(2) || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Líquido</p><p className="text-sm font-semibold text-success">R$ {ride.driver_net?.toFixed(2) || "—"}</p></div>
              </div>
              <button
                onClick={() => setDetailsId(ride.id)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver tudo →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modais */}
      <RideDetailsModal rideId={detailsId} onClose={() => setDetailsId(null)} />
      <RideCancelDialog
        rideId={cancelRide?.id ?? null}
        rideCode={cancelRide?.ride_code}
        onClose={() => setCancelRide(null)}
        onDone={fetchRides}
      />
      <RideAdjustPriceDialog ride={adjustRide} onClose={() => setAdjustRide(null)} onDone={fetchRides} />
      <RideIssueDialog ride={issueRide} onClose={() => setIssueRide(null)} onDone={fetchRides} />
      <RidePaymentDialog ride={paymentRide} onClose={() => setPaymentRide(null)} onDone={fetchRides} />
      <RideAddNoteDialog ride={noteRide} onClose={() => setNoteRide(null)} onDone={fetchRides} />
    </AdminLayout>
  );
};

export default AdminRides;
