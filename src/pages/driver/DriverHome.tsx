import { useState, useEffect } from "react";
import { Power, Wallet, Navigation, AlertTriangle, Clock, TrendingUp, Car, MapPin, Loader2, CheckCircle2, XCircle, Play, Flag } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import MapboxMap from "@/components/shared/MapboxMap";
import StatCard from "@/components/shared/StatCard";
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
  const [todayStats, setTodayStats] = useState({ rides: 0, earnings: 0 });
  const [accepting, setAccepting] = useState(false);
  const [rideState, setRideState] = useState<DriverRideState>("idle");

  const balance = driverData?.balance ?? 0;
  const lowBalance = balance < 20;
  const displayName = profile?.full_name?.split(" ")[0] || "Motorista";
  const categoryLabel = driverData?.category === "moto" ? "Moto" : driverData?.category === "premium" ? "Premium" : "Carro";

  // Fetch today's stats
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("rides")
      .select("driver_net, price")
      .eq("driver_id", user.id)
      .eq("status", "completed")
      .gte("completed_at", today)
      .then(({ data }) => {
        if (data) {
          setTodayStats({
            rides: data.length,
            earnings: data.reduce((sum, r) => sum + (r.driver_net || 0), 0),
          });
        }
      });
  }, [user]);

  // Realtime: listen for new ride requests
  useEffect(() => {
    if (!isOnline || !user) return;

    const channel = supabase
      .channel("driver-rides")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "rides",
      }, (payload) => {
        const ride = payload.new as any;
        if (ride.status === "requested" && !ride.driver_id && !pendingRide && !activeRide) {
          setPendingRide(ride);
          setRideState("new_ride");
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOnline, user, pendingRide, activeRide]);

  // Also poll for pending rides (backup)
  useEffect(() => {
    if (!isOnline || !user || activeRide) return;
    
    const fetchPending = async () => {
      if (pendingRide) return;
      const { data } = await supabase
        .from("rides")
        .select("*")
        .eq("status", "requested")
        .is("driver_id", null)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        setPendingRide(data[0]);
        setRideState("new_ride");
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 8000);
    return () => clearInterval(interval);
  }, [isOnline, user, pendingRide, activeRide]);

  const handleAccept = async () => {
    if (!pendingRide || !user) return;
    setAccepting(true);
    
    const { error } = await supabase
      .from("rides")
      .update({ driver_id: user.id, status: "accepted" })
      .eq("id", pendingRide.id)
      .eq("status", "requested");
    
    setAccepting(false);
    if (error) {
      toast.error("Erro ao aceitar corrida");
      setPendingRide(null);
      setRideState("idle");
    } else {
      toast.success("Corrida aceita! Vá até o passageiro.");
      setActiveRide(pendingRide);
      setPendingRide(null);
      setRideState("going_to_passenger");
    }
  };

  const handleReject = () => {
    setPendingRide(null);
    setRideState("idle");
    toast("Corrida recusada");
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    await supabase.from("rides").update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    }).eq("id", activeRide.id);
    setActiveRide({ ...activeRide, status: "in_progress" });
    setRideState("in_ride");
    toast.success("Corrida iniciada!");
  };

  const handleFinishRide = async () => {
    if (!activeRide || !user) return;
    
    const platformFee = activeRide.platform_fee || 0;
    
    // Update ride
    await supabase.from("rides").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", activeRide.id);

    // Deduct fee from driver balance
    if (driverData) {
      await supabase.from("drivers").update({
        balance: Math.max(0, balance - platformFee),
        total_rides: (driverData.total_rides || 0) + 1,
      }).eq("user_id", user.id);
    }

    toast.success(`Corrida finalizada! Taxa: R$ ${platformFee.toFixed(2)}`);
    setActiveRide(null);
    setRideState("idle");
    
    // Refresh stats
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("rides").select("driver_net").eq("driver_id", user.id).eq("status", "completed").gte("completed_at", today);
    if (data) setTodayStats({ rides: data.length, earnings: data.reduce((s, r) => s + (r.driver_net || 0), 0) });
  };

  const originPoint = activeRide ? { lat: activeRide.origin_lat, lng: activeRide.origin_lng, label: "Passageiro" } : null;
  const destPoint = activeRide ? { lat: activeRide.destination_lat, lng: activeRide.destination_lng, label: "Destino" } : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="flex items-center justify-between bg-card border-b p-4">
        <div>
          <h1 className="text-lg font-bold font-display">Olá, {displayName}</h1>
          <p className="text-xs text-muted-foreground">
            {categoryLabel} • Saldo: R$ {balance.toFixed(2)}
          </p>
        </div>
        <button
          onClick={() => {
            if (lowBalance && !isOnline) {
              toast.error("Saldo insuficiente. Recarregue para ficar online.");
              return;
            }
            setIsOnline(!isOnline);
            if (!isOnline) toast.success("Você está online! Aguardando corridas...");
          }}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${
            isOnline ? "bg-success text-success-foreground shadow-glow" : "bg-muted text-muted-foreground"
          }`}
        >
          <Power className="h-4 w-4" />
          {isOnline ? "Online" : "Offline"}
        </button>
      </div>

      {lowBalance && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-warning/10 border border-warning/30 p-3 animate-fade-in">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-semibold text-warning">Saldo baixo!</p>
            <p className="text-xs text-muted-foreground">Recarregue para continuar aceitando corridas.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <StatCard title="Saldo" value={`R$ ${balance.toFixed(2)}`} icon={Wallet} variant={lowBalance ? "warning" : "success"} />
        <StatCard title="Ganhos hoje" value={`R$ ${todayStats.earnings.toFixed(2)}`} icon={TrendingUp} variant="primary" />
        <StatCard title="Corridas hoje" value={String(todayStats.rides)} icon={Car} />
        <StatCard title="Avaliação" value={driverData?.rating?.toFixed(1) || "0.0"} icon={MapPin} subtitle="⭐" />
      </div>

      {/* Map */}
      <div className="px-4">
        <MapboxMap
          className="h-[200px]"
          origin={rideState === "going_to_passenger" ? originPoint : rideState === "in_ride" ? originPoint : null}
          destination={rideState === "in_ride" ? destPoint : rideState === "going_to_passenger" ? originPoint : null}
          trackUserLocation={isOnline}
          showRoute={rideState === "going_to_passenger" || rideState === "in_ride"}
        />
      </div>

      {/* New ride card */}
      {isOnline && pendingRide && rideState === "new_ride" && (
        <div className="mx-4 mt-4 rounded-2xl border-2 border-primary bg-card p-4 shadow-glow animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-primary uppercase">Nova Corrida</span>
            <span className="text-lg font-extrabold text-primary">R$ {pendingRide.price?.toFixed(2) || "—"}</span>
          </div>
          <div className="space-y-2 mb-3">
            <div className="flex items-start gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-success mt-1.5" />
              <p className="text-sm">{pendingRide.origin_address?.split(" - ")[0]}</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive mt-1.5" />
              <p className="text-sm">{pendingRide.destination_address?.split(" - ")[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <Navigation className="h-3.5 w-3.5" /> {pendingRide.distance_km} km • <Clock className="h-3.5 w-3.5" /> ~{pendingRide.duration_minutes} min • {pendingRide.passenger_count} pass.
          </div>
          <div className="flex gap-2">
            <button onClick={handleReject} className="flex-1 rounded-xl border border-destructive/30 py-3 text-sm font-bold text-destructive flex items-center justify-center gap-1">
              <XCircle className="h-4 w-4" /> Recusar
            </button>
            <button onClick={handleAccept} disabled={accepting} className="flex-1 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow flex items-center justify-center gap-1">
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Aceitar
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
          <button onClick={handleStartRide} className="w-full rounded-xl bg-success py-3 text-sm font-bold text-success-foreground flex items-center justify-center gap-2">
            <Play className="h-4 w-4" /> Iniciar Corrida
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
