import { useEffect, useState } from "react";
import { Activity, MapPin, RefreshCw, Zap, Loader2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import GoogleMap from "@/components/shared/GoogleMap";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminLive = () => {
  const [activeRides, setActiveRides] = useState<any[]>([]);
  const [stats, setStats] = useState({ active: 0, waiting: 0 });
  const [seeding, setSeeding] = useState(false);

  const handleSeedTestRides = async () => {
    if (seeding) return;
    if (!confirm("Disparar 5 corridas de teste agora? Elas serão criadas como 🧪 TESTE e enviadas aos motoristas online.")) return;
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-test-rides", {
        body: { count: 5, category: "economico" },
      });
      if (error) throw error;
      toast.success(`✅ ${data?.created ?? 0} corridas de teste criadas e despachadas!`);
      fetchLive();
    } catch (e: any) {
      toast.error("Falha ao criar corridas de teste: " + (e?.message || e));
    } finally {
      setSeeding(false);
    }
  };

  const fetchLive = async () => {
    const { data: rides } = await supabase
      .from("rides")
      .select("*")
      .in("status", ["requested", "accepted", "in_progress"])
      .order("created_at", { ascending: false });
    
    if (rides) {
      setActiveRides(rides);
      setStats({
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
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-medium text-success">Tempo real</span>
        </div>
        <button onClick={fetchLive} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    }>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {[
          { label: "Corridas ativas", value: String(stats.active), color: "text-info", bg: "bg-info/10" },
          { label: "Aguardando", value: String(stats.waiting), color: "text-warning", bg: "bg-warning/10" },
          { label: "Total", value: String(activeRides.length), color: "text-primary", bg: "bg-primary/10" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 whitespace-nowrap">
            <span className={`text-xl font-extrabold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Mapa em Tempo Real</h3>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Passageiros</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-info" /> Motoristas</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Incidentes</span>
          </div>
        </div>
        <GoogleMap
          className="h-[400px] lg:h-[500px] rounded-none"
          origin={firstRide ? { lat: firstRide.origin_lat, lng: firstRide.origin_lng, label: "Origem" } : null}
          destination={firstRide ? { lat: firstRide.destination_lat, lng: firstRide.destination_lng, label: "Destino" } : null}
          showRoute={!!firstRide}
        />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Activity className="h-4 w-4 text-info" />
          <h3 className="text-sm font-bold">Corridas ativas ({activeRides.length})</h3>
        </div>
        <div className="divide-y max-h-80 overflow-y-auto">
          {activeRides.length === 0 && (
            <EmptyState icon={Activity} title="Nenhuma corrida ativa" description="Quando uma corrida estiver em andamento, aparecerá aqui em tempo real." />
          )}
          {activeRides.map((r) => (
            <div key={r.id} className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold">#{r.id.slice(0, 5).toUpperCase()}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  r.status === "in_progress" ? "bg-success/10 text-success" : r.status === "accepted" ? "bg-info/10 text-info" : "bg-warning/10 text-warning"
                }`}>
                  {r.status === "in_progress" ? "Em corrida" : r.status === "accepted" ? "Aceita" : "Aguardando"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{r.origin_address?.split(" - ")[0]} → {r.destination_address?.split(" - ")[0]}</p>
              <p className="text-xs font-bold mt-1">R$ {r.price?.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminLive;
