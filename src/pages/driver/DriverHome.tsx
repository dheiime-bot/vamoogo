import { useState, useEffect } from "react";
import { Power, Wallet, Navigation, AlertTriangle, Clock, TrendingUp, Car, MapPin, Loader2, CheckCircle2, XCircle, Play, Flag, Phone, MessageCircle, Star } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import MapboxMap from "@/components/shared/MapboxMap";
import { Home, User, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const navItems = [
  { icon: Home, label: "Início", path: "/driver" },
  { icon: Wallet, label: "Carteira", path: "/driver/wallet" },
  { icon: History, label: "Corridas", path: "/driver/rides" },
  { icon: User, label: "Perfil", path: "/driver/profile" },
];

type DriverRideState = "idle" | "new_ride" | "going_to_passenger" | "in_ride";

const DriverHome = () => {
  const { user, profile, driverData } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [pendingRide, setPendingRide] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [todayStats, setTodayStats] = useState({ rides: 0, earnings: 0, hours: 0, acceptance: 0 });
  const [weekStats, setWeekStats] = useState({ rides: 0, hours: 0, acceptance: 0 });
  const [accepting, setAccepting] = useState(false);
  const [rideState, setRideState] = useState<DriverRideState>("idle");

  const balance = driverData?.balance ?? 0;
  const lowBalance = balance < 20;
  const displayName = profile?.full_name?.split(" ")[0] || "Motorista";
  const categoryLabel = driverData?.category === "moto" ? "Moto" : driverData?.category === "premium" ? "Premium" : "Carro";

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    supabase.from("rides").select("driver_net, price, duration_minutes").eq("driver_id", user.id).eq("status", "completed").gte("completed_at", today)
      .then(({ data }) => {
        if (data) {
          const hours = data.reduce((s, r) => s + (r.duration_minutes || 0), 0) / 60;
          setTodayStats({ rides: data.length, earnings: data.reduce((s, r) => s + (r.driver_net || 0), 0), hours: Math.round(hours * 10) / 10, acceptance: 80 });
        }
      });
  }, [user]);

  useEffect(() => {
    if (!isOnline || !user) return;
    const channel = supabase.channel("driver-rides")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rides" }, (payload) => {
        const ride = payload.new as any;
        if (ride.status === "requested" && !ride.driver_id && !pendingRide && !activeRide) {
          setPendingRide(ride); setRideState("new_ride");
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isOnline, user, pendingRide, activeRide]);

  useEffect(() => {
    if (!isOnline || !user || activeRide) return;
    const fetchPending = async () => {
      if (pendingRide) return;
      const { data } = await supabase.from("rides").select("*").eq("status", "requested").is("driver_id", null).order("created_at", { ascending: false }).limit(1);
      if (data && data.length > 0) { setPendingRide(data[0]); setRideState("new_ride"); }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 8000);
    return () => clearInterval(interval);
  }, [isOnline, user, pendingRide, activeRide]);

  const handleAccept = async () => {
    if (!pendingRide || !user) return;
    setAccepting(true);
    const { error } = await supabase.from("rides").update({ driver_id: user.id, status: "accepted" }).eq("id", pendingRide.id).eq("status", "requested");
    setAccepting(false);
    if (error) { toast.error("Erro ao aceitar"); setPendingRide(null); setRideState("idle"); }
    else { toast.success("Corrida aceita!"); setActiveRide(pendingRide); setPendingRide(null); setRideState("going_to_passenger"); }
  };

  const handleReject = () => { setPendingRide(null); setRideState("idle"); toast("Corrida recusada"); };

  const handleStartRide = async () => {
    if (!activeRide) return;
    await supabase.from("rides").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", activeRide.id);
    setActiveRide({ ...activeRide, status: "in_progress" }); setRideState("in_ride"); toast.success("Corrida iniciada!");
  };

  const handleFinishRide = async () => {
    if (!activeRide || !user) return;
    const platformFee = activeRide.platform_fee || 0;
    await supabase.from("rides").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", activeRide.id);
    if (driverData) {
      await supabase.from("drivers").update({ balance: Math.max(0, balance - platformFee), total_rides: (driverData.total_rides || 0) + 1 }).eq("user_id", user.id);
    }
    toast.success(`Corrida finalizada! Taxa: R$ ${platformFee.toFixed(2)}`);
    setActiveRide(null); setRideState("idle");
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("rides").select("driver_net").eq("driver_id", user.id).eq("status", "completed").gte("completed_at", today);
    if (data) setTodayStats(prev => ({ ...prev, rides: data.length, earnings: data.reduce((s, r) => s + (r.driver_net || 0), 0) }));
  };

  const originPoint = activeRide ? { lat: activeRide.origin_lat, lng: activeRide.origin_lng, label: "Passageiro" } : null;
  const destPoint = activeRide ? { lat: activeRide.destination_lat, lng: activeRide.destination_lng, label: "Destino" } : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with online toggle */}
      <div className="flex items-center justify-between bg-card border-b p-4">
        <div>
          <h1 className="text-lg font-bold font-display">Olá, {displayName}</h1>
          <p className="text-xs text-muted-foreground">{categoryLabel} • R$ {balance.toFixed(2)}</p>
        </div>
        <button
          onClick={() => {
            if (lowBalance && !isOnline) { toast.error("Saldo insuficiente. Recarregue!"); return; }
            setIsOnline(!isOnline);
            if (!isOnline) toast.success("Você está Online!");
          }}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
            isOnline ? "bg-success text-success-foreground shadow-glow" : "bg-muted text-muted-foreground"
          }`}
        >
          <Power className="h-4 w-4" />
          {isOnline ? "Você está Online" : "Offline"}
        </button>
      </div>

      {lowBalance && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-warning/10 border border-warning/30 p-3 animate-fade-in">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-semibold text-warning">Saldo baixo!</p>
            <p className="text-xs text-muted-foreground">Recarregue para continuar.</p>
          </div>
        </div>
      )}

      {/* Earnings banner */}
      <div className="mx-4 mt-4 rounded-2xl bg-gradient-dark p-5">
        <p className="text-xs text-muted-foreground mb-1">Current earnings</p>
        <p className="text-3xl font-extrabold text-primary-foreground">R$ {todayStats.earnings.toFixed(2)}</p>
        {/* Mini weekly chart placeholder */}
        <div className="flex items-end gap-1 h-8 mt-3">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((d, i) => (
            <div key={d} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full rounded-sm bg-primary/40" style={{ height: `${Math.random() * 20 + 5}px` }} />
              <span className="text-[8px] text-muted-foreground">{d.slice(0, 2)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: "Rides", value: String(todayStats.rides) },
            { label: "Horas", value: `${todayStats.hours}h` },
            { label: "Accept rate", value: `${todayStats.acceptance}%` },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-extrabold text-primary-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="px-4 mt-4">
        <MapboxMap
          className="h-[180px]"
          origin={rideState === "going_to_passenger" || rideState === "in_ride" ? originPoint : null}
          destination={rideState === "in_ride" ? destPoint : null}
          trackUserLocation={isOnline}
          showRoute={rideState === "going_to_passenger" || rideState === "in_ride"}
        />
      </div>

      {/* New ride card */}
      {isOnline && pendingRide && rideState === "new_ride" && (
        <div className="mx-4 mt-4 rounded-2xl border-2 border-primary bg-card p-4 shadow-glow animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-xs font-bold text-primary uppercase">Nova Corrida</span>
            </div>
            <span className="text-lg font-extrabold text-primary">R$ {pendingRide.price?.toFixed(2)}</span>
          </div>
          
          {/* Route info */}
          <div className="rounded-xl bg-muted/50 p-3 space-y-2 mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Eo-tramClemento - {pendingRide.distance_km} km</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-xs text-muted-foreground">Distância</p><p className="text-sm font-bold">{pendingRide.distance_km} km</p></div>
              <div><p className="text-xs text-muted-foreground">Valor</p><p className="text-sm font-bold text-primary">R$ {pendingRide.price?.toFixed(2)}</p></div>
            </div>
          </div>

          <div className="space-y-1.5 mb-3">
            <div className="flex items-start gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-success mt-1.5" />
              <div>
                <p className="text-xs text-muted-foreground">Local de embarque</p>
                <p className="text-sm font-medium">{pendingRide.origin_address?.split(" - ")[0]}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleReject} className="flex-1 rounded-xl border-2 border-destructive py-3 text-sm font-bold text-destructive flex items-center justify-center gap-1">
              Recusar
            </button>
            <button onClick={handleAccept} disabled={accepting} className="flex-1 rounded-xl bg-success py-3 text-sm font-bold text-success-foreground flex items-center justify-center gap-1">
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Aceitar
            </button>
          </div>
        </div>
      )}

      {/* Going to passenger */}
      {rideState === "going_to_passenger" && activeRide && (
        <div className="mx-4 mt-4 rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary">A caminho do passageiro</span>
            <span className="font-extrabold">R$ {activeRide.price?.toFixed(2)}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-success mt-0.5" />
            <p className="text-sm">{activeRide.origin_address?.split(" - ")[0]}</p>
          </div>
          <button onClick={handleStartRide} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2">
            <Play className="h-4 w-4" /> Cheguei ao local
          </button>
        </div>
      )}

      {/* In ride */}
      {rideState === "in_ride" && activeRide && (
        <div className="mx-4 mt-4 rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-success">Em corrida</span>
            <span className="font-extrabold">R$ {activeRide.price?.toFixed(2)}</span>
          </div>
          <div className="flex items-start gap-2">
            <Flag className="h-4 w-4 text-destructive mt-0.5" />
            <p className="text-sm">{activeRide.destination_address?.split(" - ")[0]}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {activeRide.distance_km} km • ~{activeRide.duration_minutes} min • Taxa: R$ {activeRide.platform_fee?.toFixed(2)}
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-destructive/5 border border-destructive/20 p-3">
            <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <p className="text-xs text-destructive font-medium">Deslize para Finalizar Corrida</p>
          </div>
          <button onClick={handleFinishRide} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2">
            <Flag className="h-4 w-4" /> Finalizar Corrida
          </button>
        </div>
      )}

      {/* Waiting */}
      {isOnline && rideState === "idle" && !pendingRide && (
        <div className="mx-4 mt-4 rounded-2xl border bg-card p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm font-medium">Aguardando corridas...</p>
          <p className="text-xs text-muted-foreground">Novas solicitações aparecerão aqui</p>
        </div>
      )}

      <BottomNav items={navItems} />
    </div>
  );
};

export default DriverHome;
