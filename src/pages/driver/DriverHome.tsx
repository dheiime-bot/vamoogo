import { useState, useEffect } from "react";
import { Power, Wallet, AlertTriangle, Car, MapPin, Loader2, Play, Flag, Phone, MessageCircle, Star, Clock, X } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import GoogleMap from "@/components/shared/GoogleMap";
import { Home, User, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { toast } from "sonner";

const navItems = [
  { icon: Home, label: "Início", path: "/driver" },
  { icon: Wallet, label: "Carteira", path: "/driver/wallet" },
  { icon: History, label: "Corridas", path: "/driver/rides" },
  { icon: User, label: "Perfil", path: "/driver/profile" },
];

type DriverRideState = "idle" | "offer" | "going_to_passenger" | "arrived" | "in_ride";

const paymentLabels: Record<string, string> = { cash: "Dinheiro", pix: "Pix", debit: "Débito", credit: "Crédito" };

const playOfferSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const beep = (freq: number, start: number, dur = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    beep(880, 0); beep(1320, 0.22); beep(1760, 0.44);
    setTimeout(() => ctx.close(), 1000);
  } catch (e) { /* ignore */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
};

const DriverHome = () => {
  const { user, profile, driverData } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [pendingOffer, setPendingOffer] = useState<any>(null);
  const [pendingRide, setPendingRide] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [todayStats, setTodayStats] = useState({ rides: 0, earnings: 0, hours: 0 });
  const [rideState, setRideState] = useState<DriverRideState>("idle");
  const [offerCountdown, setOfferCountdown] = useState(15);

  const balance = driverData?.balance ?? 0;
  const lowBalance = balance < 5;
  const displayName = profile?.full_name?.split(" ")[0] || "Motorista";
  const categoryLabel = driverData?.category === "moto" ? "Moto" : driverData?.category === "premium" ? "Premium" : "Carro";

  // Faz broadcast da posição GPS quando online
  useDriverLocation({ driverId: user?.id, isOnline, category: driverData?.category });

  // Stats do dia
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    supabase.from("rides")
      .select("driver_net, duration_minutes")
      .eq("driver_id", user.id).eq("status", "completed")
      .gte("completed_at", today)
      .then(({ data }) => {
        if (data) {
          const hours = data.reduce((s, r) => s + (r.duration_minutes || 0), 0) / 60;
          setTodayStats({
            rides: data.length,
            earnings: data.reduce((s, r) => s + Number(r.driver_net || 0), 0),
            hours: Math.round(hours * 10) / 10,
          });
        }
      });
  }, [user, activeRide]);

  // Recupera corrida ativa ao montar (caso o motorista recarregue)
  useEffect(() => {
    if (!user) return;
    supabase.from("rides").select("*")
      .eq("driver_id", user.id).in("status", ["accepted", "in_progress"])
      .order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const r = data[0];
          setActiveRide(r);
          setRideState(r.status === "in_progress" ? "in_ride" : "going_to_passenger");
        }
      });
  }, [user]);

  // Realtime: novas ofertas
  useEffect(() => {
    if (!isOnline || !user) return;

    const checkExisting = async () => {
      const { data } = await supabase.from("ride_offers").select("*, rides(*)")
        .eq("driver_id", user.id).eq("status", "pending")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1);
      if (data && data.length > 0 && !pendingOffer && !activeRide) {
        const offer = data[0];
        setPendingOffer(offer);
        setPendingRide(offer.rides);
        setRideState("offer");
      }
    };
    checkExisting();

    const channel = supabase.channel(`driver-offers-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "ride_offers", filter: `driver_id=eq.${user.id}` },
        async (payload) => {
          if (activeRide || pendingOffer) return;
          const offer = payload.new as any;
          // Busca a corrida associada
          const { data: ride } = await supabase.from("rides").select("*").eq("id", offer.ride_id).single();
          if (!ride || ride.status !== "requested") return;
          setPendingOffer(offer);
          setPendingRide(ride);
          setRideState("offer");
          toast.success("Nova corrida! 🚗");
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOnline, user, pendingOffer, activeRide]);

  // Countdown da oferta + auto-reject ao expirar
  useEffect(() => {
    if (rideState !== "offer" || !pendingOffer) return;
    setOfferCountdown(15);
    const expiresAt = new Date(pendingOffer.expires_at).getTime();
    const interval = setInterval(() => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setOfferCountdown(left);
      if (left <= 0) {
        setPendingOffer(null);
        setPendingRide(null);
        setRideState("idle");
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [rideState, pendingOffer]);

  const handleAccept = async () => {
    if (!pendingOffer || !pendingRide || !user) return;

    // Tenta atualizar a corrida (atomic — só 1 motorista consegue)
    const { data: updated, error } = await supabase.from("rides")
      .update({ driver_id: user.id, status: "accepted" })
      .eq("id", pendingRide.id)
      .eq("status", "requested")
      .is("driver_id", null)
      .select().single();

    if (error || !updated) {
      toast.error("Outro motorista já aceitou");
      setPendingOffer(null); setPendingRide(null); setRideState("idle");
      return;
    }

    // Marca a oferta como aceita
    await supabase.from("ride_offers").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", pendingOffer.id);

    setActiveRide(updated);
    setPendingOffer(null);
    setPendingRide(null);
    setRideState("going_to_passenger");
    toast.success("Corrida aceita! 🚗");
  };

  const handleReject = async () => {
    if (!pendingOffer) return;
    await supabase.from("ride_offers").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("id", pendingOffer.id);
    setPendingOffer(null); setPendingRide(null); setRideState("idle");
    toast("Corrida recusada");
  };

  const handleArrived = async () => {
    if (!activeRide) return;
    setRideState("arrived");
    toast.success("Você chegou ao local de embarque!");
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    await supabase.from("rides")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", activeRide.id);
    setActiveRide({ ...activeRide, status: "in_progress" });
    setRideState("in_ride");
    toast.success("Corrida iniciada!");
  };

  const handleFinishRide = async () => {
    if (!activeRide || !user) return;
    const platformFee = Number(activeRide.platform_fee || 0);
    await supabase.from("rides")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", activeRide.id);
    if (driverData) {
      await supabase.from("drivers")
        .update({
          balance: Math.max(0, Number(balance) - platformFee),
          total_rides: (driverData.total_rides || 0) + 1,
        })
        .eq("user_id", user.id);
    }
    toast.success(`Corrida finalizada! Taxa: R$ ${platformFee.toFixed(2)}`);
    setActiveRide(null);
    setRideState("idle");
  };

  const handleToggleOnline = () => {
    if (lowBalance && !isOnline) {
      toast.error("Saldo insuficiente. Recarregue para ficar online!");
      return;
    }
    setIsOnline(!isOnline);
    if (!isOnline) toast.success("Você está Online! Aguardando corridas...");
    else toast("Você está Offline");
  };

  const originPoint = activeRide
    ? { lat: Number(activeRide.origin_lat), lng: Number(activeRide.origin_lng), label: "Passageiro" }
    : null;
  const destPoint = activeRide
    ? { lat: Number(activeRide.destination_lat), lng: Number(activeRide.destination_lng), label: "Destino" }
    : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="flex items-center justify-between bg-card border-b p-4">
        <div>
          <h1 className="text-lg font-bold font-display">Olá, {displayName}</h1>
          <p className="text-xs text-muted-foreground">{categoryLabel} • Saldo: R$ {Number(balance).toFixed(2)}</p>
        </div>
        <button
          onClick={handleToggleOnline}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
            isOnline ? "bg-success text-success-foreground shadow-glow" : "bg-muted text-muted-foreground"
          }`}
        >
          <Power className="h-4 w-4" />
          {isOnline ? "Online" : "Offline"}
        </button>
      </div>

      {lowBalance && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-warning/10 border border-warning/30 p-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-semibold text-warning">Saldo baixo!</p>
            <p className="text-xs text-muted-foreground">Recarregue para ficar online.</p>
          </div>
        </div>
      )}

      {/* Earnings */}
      <div className="mx-4 mt-4 rounded-2xl bg-gradient-dark p-5">
        <p className="text-xs text-muted-foreground mb-1">Ganhos hoje</p>
        <p className="text-3xl font-extrabold text-primary-foreground">R$ {todayStats.earnings.toFixed(2)}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: "Corridas", value: String(todayStats.rides) },
            { label: "Horas", value: `${todayStats.hours}h` },
            { label: "Categoria", value: categoryLabel },
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
        <GoogleMap
          className="h-[200px]"
          origin={(rideState === "going_to_passenger" || rideState === "arrived" || rideState === "in_ride") ? originPoint : null}
          destination={rideState === "in_ride" ? destPoint : null}
          trackUserLocation={isOnline && !activeRide}
          showRoute={rideState === "going_to_passenger" || rideState === "in_ride"}
        />
      </div>

      {/* OFERTA recebida */}
      {rideState === "offer" && pendingRide && pendingOffer && (
        <div className="mx-4 mt-4 rounded-2xl border-2 border-primary bg-card p-4 shadow-glow animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Clock className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-bold text-primary uppercase">Nova Corrida</span>
            </div>
            <span className="text-2xl font-extrabold tabular-nums text-warning">{offerCountdown}s</span>
          </div>

          <div className="rounded-xl bg-muted/50 p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Você ganha</span>
              <span className="text-2xl font-extrabold text-success">R$ {Number(pendingRide.driver_net).toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Até passageiro</p>
                <p className="text-sm font-bold">{Number(pendingOffer.distance_to_pickup_km).toFixed(1)} km</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Corrida</p>
                <p className="text-sm font-bold">{pendingRide.distance_km} km</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Pagamento</p>
                <p className="text-sm font-bold">{paymentLabels[pendingRide.payment_method] || "—"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-start gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-success mt-1.5" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Embarque</p>
                <p className="text-sm font-medium truncate">{pendingRide.origin_address?.split(" - ")[0]}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive mt-1.5" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Destino</p>
                <p className="text-sm font-medium truncate">{pendingRide.destination_address?.split(" - ")[0]}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleReject}
              className="flex-1 rounded-xl border-2 border-destructive py-3 text-sm font-bold text-destructive hover:bg-destructive/5 transition-colors">
              Recusar
            </button>
            <button onClick={handleAccept}
              className="flex-[2] rounded-xl bg-success py-3 text-sm font-bold text-success-foreground hover:opacity-90 transition-opacity">
              Aceitar Corrida
            </button>
          </div>
        </div>
      )}

      {/* Going to passenger */}
      {rideState === "going_to_passenger" && activeRide && (
        <div className="mx-4 mt-4 rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-info">A caminho do passageiro</span>
            <span className="font-extrabold">R$ {Number(activeRide.price).toFixed(2)}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-success mt-0.5 shrink-0" />
            <p className="text-sm">{activeRide.origin_address?.split(" - ")[0]}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold">
              <Phone className="h-4 w-4 text-primary" /> Ligar
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold">
              <MessageCircle className="h-4 w-4 text-primary" /> Chat
            </button>
          </div>
          <button onClick={handleArrived}
            className="w-full rounded-xl bg-info py-3 text-sm font-bold text-info-foreground flex items-center justify-center gap-2">
            <MapPin className="h-4 w-4" /> Cheguei ao local
          </button>
        </div>
      )}

      {/* Arrived */}
      {rideState === "arrived" && activeRide && (
        <div className="mx-4 mt-4 rounded-2xl border bg-card p-4 space-y-3">
          <div className="rounded-xl bg-success/10 p-3 text-center">
            <p className="text-sm font-bold text-success">📍 Aguardando passageiro embarcar</p>
          </div>
          <button onClick={handleStartRide}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2">
            <Play className="h-4 w-4" /> Iniciar Corrida
          </button>
        </div>
      )}

      {/* In ride */}
      {rideState === "in_ride" && activeRide && (
        <div className="mx-4 mt-4 rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-success">🛣️ Em corrida</span>
            <span className="font-extrabold">R$ {Number(activeRide.price).toFixed(2)}</span>
          </div>
          <div className="flex items-start gap-2">
            <Flag className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm">{activeRide.destination_address?.split(" - ")[0]}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {activeRide.distance_km} km • ~{activeRide.duration_minutes} min • Taxa plataforma: R$ {Number(activeRide.platform_fee).toFixed(2)}
          </div>
          <button onClick={handleFinishRide}
            className="w-full rounded-xl bg-success py-3 text-sm font-bold text-success-foreground flex items-center justify-center gap-2">
            <Flag className="h-4 w-4" /> Finalizar Corrida
          </button>
        </div>
      )}

      {/* Waiting */}
      {isOnline && rideState === "idle" && !activeRide && (
        <div className="mx-4 mt-4 rounded-2xl border bg-card p-6 text-center">
          <div className="relative mx-auto h-12 w-12 mb-2">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
              <Car className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-sm font-medium mt-2">Aguardando corridas próximas...</p>
          <p className="text-xs text-muted-foreground">Você será notificado em segundos</p>
        </div>
      )}

      {!isOnline && rideState === "idle" && !activeRide && (
        <div className="mx-4 mt-4 rounded-2xl border-dashed border-2 bg-muted/30 p-6 text-center">
          <Power className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">Você está offline</p>
          <p className="text-xs text-muted-foreground">Toque em "Online" para receber corridas</p>
        </div>
      )}

      <BottomNav items={navItems} />
    </div>
  );
};

export default DriverHome;
