import { useState, useEffect } from "react";
import { Power, Wallet, Navigation, AlertTriangle, Clock, TrendingUp, Car, MapPin, Loader2, CheckCircle2, XCircle } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import MapPlaceholder from "@/components/shared/MapPlaceholder";
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

const DriverHome = () => {
  const { user, profile, driverData } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [pendingRide, setPendingRide] = useState<any>(null);
  const [todayStats, setTodayStats] = useState({ rides: 0, earnings: 0 });
  const [accepting, setAccepting] = useState(false);

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

  // Poll for pending rides when online
  useEffect(() => {
    if (!isOnline || !user) return;
    
    const fetchPending = async () => {
      const { data } = await supabase
        .from("rides")
        .select("*")
        .eq("status", "requested")
        .is("driver_id", null)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (data && data.length > 0 && !pendingRide) {
        setPendingRide(data[0]);
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, [isOnline, user, pendingRide]);

  const handleAccept = async () => {
    if (!pendingRide || !user) return;
    setAccepting(true);
    
    const { error } = await supabase
      .from("rides")
      .update({ driver_id: user.id, status: "accepted", started_at: new Date().toISOString() })
      .eq("id", pendingRide.id)
      .eq("status", "requested");
    
    setAccepting(false);
    if (error) {
      toast.error("Erro ao aceitar corrida");
    } else {
      toast.success("Corrida aceita!");
      setPendingRide(null);
    }
  };

  const handleReject = () => {
    setPendingRide(null);
    toast("Corrida recusada");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="flex items-center justify-between bg-card border-b p-4">
        <div>
          <h1 className="text-lg font-bold font-display">Olá, {displayName}</h1>
          <p className="text-xs text-muted-foreground">Categoria: {categoryLabel}</p>
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

      <div className="grid grid-cols-2 gap-3 p-4">
        <StatCard title="Saldo" value={`R$ ${balance.toFixed(2)}`} icon={Wallet} variant={lowBalance ? "warning" : "success"} />
        <StatCard title="Ganhos hoje" value={`R$ ${todayStats.earnings.toFixed(2)}`} icon={TrendingUp} variant="primary" />
        <StatCard title="Corridas hoje" value={String(todayStats.rides)} icon={Car} />
        <StatCard title="Avaliação" value={driverData?.rating?.toFixed(1) || "0.0"} icon={MapPin} subtitle="⭐⭐⭐⭐⭐" />
      </div>

      <div className="px-4">
        <MapPlaceholder className="h-[200px]" />
      </div>

      {/* Pending ride */}
      {isOnline && pendingRide && (
        <div className="mx-4 mt-4 rounded-2xl border-2 border-primary bg-card p-4 shadow-glow animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-primary">NOVA CORRIDA</span>
            <span className="text-lg font-extrabold text-primary">R$ {pendingRide.price?.toFixed(2) || "—"}</span>
          </div>
          <div className="space-y-2 mb-4">
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
              <p className="text-sm">{pendingRide.origin_address?.split(" - ")[0]}</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 rounded-full bg-destructive mt-1.5" />
              <p className="text-sm">{pendingRide.destination_address?.split(" - ")[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <Navigation className="h-3.5 w-3.5" /> {pendingRide.distance_km} km • <Clock className="h-3.5 w-3.5" /> ~{pendingRide.duration_minutes} min • {pendingRide.passenger_count} passageiro(s)
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

      {isOnline && !pendingRide && (
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
