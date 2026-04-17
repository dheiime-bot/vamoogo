import { useState, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { Power, Wallet, AlertTriangle, Car, MapPin, Loader2, Play, Flag, Phone, MessageCircle, Star, Clock, X, QrCode, Navigation as NavigationIcon } from "lucide-react";
import { openGoogleMapsRoute } from "@/lib/externalNav";
import { getDriverStatusInfo } from "@/lib/driverStatus";
import AppMenu from "@/components/shared/AppMenu";
import NotificationBell from "@/components/shared/NotificationBell";
import DriverEarningsChip from "@/components/driver/DriverEarningsChip";
import DriverBottomNav from "@/components/driver/DriverBottomNav";

import GoogleMap from "@/components/shared/GoogleMap";
import { Home, User, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import RideChat from "@/components/passenger/RideChat";
import PixPaymentModal from "@/components/passenger/PixPaymentModal";
import type { PixKeyType } from "@/lib/pix";
import { toast } from "sonner";


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
  const [showChat, setShowChat] = useState(false);
  const [passengerName, setPassengerName] = useState<string>("");
  const [showPixModal, setShowPixModal] = useState(false);

  const balance = driverData?.balance ?? 0;
  const lowBalance = balance < 5;
  const displayName = profile?.full_name?.split(" ")[0] || "Motorista";

  const categoryLabel = driverData?.category === "moto" ? "Moto" : driverData?.category === "conforto" ? "Conforto" : "Econômico";

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
          const r = data[0] as any;
          setActiveRide(r);
          if (r.status === "in_progress") setRideState("in_ride");
          else if (r.arrived_at) setRideState("arrived");
          else setRideState("going_to_passenger");
        }
      });
  }, [user]);

  // Refs para o handler de realtime ler estado mais recente sem reinscrever o canal
  const pendingOfferRef = useRef<any>(null);
  const activeRideRef = useRef<any>(null);
  useEffect(() => { pendingOfferRef.current = pendingOffer; }, [pendingOffer]);
  useEffect(() => { activeRideRef.current = activeRide; }, [activeRide]);

  // Polling de fallback: a cada 4s busca ofertas pendentes (caso o realtime falhe)
  useEffect(() => {
    if (!isOnline || !user) return;
    let cancelled = false;
    const fetchPending = async () => {
      if (pendingOfferRef.current || activeRideRef.current) return;
      const { data, error } = await supabase.from("ride_offers").select("*, rides(*)")
        .eq("driver_id", user.id).eq("status", "pending")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1);
      if (cancelled) return;
      if (error) { console.warn("[driver] poll offers error", error); return; }
      if (data && data.length > 0) {
        const offer = data[0];
        console.log("[driver] poll found pending offer", offer.id);
        if (!offer.rides || offer.rides.status !== "requested") return;
        setPendingOffer(offer);
        setPendingRide(offer.rides);
        setRideState("offer");
        playOfferSound();
        toast.success("Nova corrida! 🚗");
      }
    };
    fetchPending();
    const intv = setInterval(fetchPending, 4000);
    return () => { cancelled = true; clearInterval(intv); };
  }, [isOnline, user]);

  // Realtime: novas ofertas (canal estável — só re-cria quando isOnline/user mudam)
  useEffect(() => {
    if (!isOnline || !user) return;
    console.log("[driver] subscribing to ride_offers for", user.id);

    const channel = supabase.channel(`driver-offers-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "ride_offers", filter: `driver_id=eq.${user.id}` },
        async (payload) => {
          console.log("[driver] realtime ride_offers INSERT received", payload.new);
          if (activeRideRef.current || pendingOfferRef.current) {
            console.log("[driver] skipping offer — already busy");
            return;
          }
          const offer = payload.new as any;
          const { data: ride } = await supabase.from("rides").select("*").eq("id", offer.ride_id).single();
          if (!ride || ride.status !== "requested") {
            console.log("[driver] skipping offer — ride not in requested state", ride?.status);
            return;
          }
          setPendingOffer(offer);
          setPendingRide(ride);
          setRideState("offer");
          playOfferSound();
          toast.success("Nova corrida! 🚗");
        })
      .subscribe((status) => {
        console.log("[driver] ride_offers channel status:", status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [isOnline, user]);

  // Realtime: sincronia de UPDATEs em rides atribuídas a este motorista
  // (cobre cancelamento pelo passageiro, mudanças de status externas, etc)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`driver-rides-${user.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "rides", filter: `driver_id=eq.${user.id}` },
        (payload) => {
          const ride = payload.new as any;
          if (ride.status === "cancelled") {
            setActiveRide(null);
            setRideState("idle");
            setShowChat(false);
            toast.error("O passageiro cancelou a corrida");
          } else if (ride.status === "completed") {
            setActiveRide(null);
            setRideState("idle");
            setShowChat(false);
          } else if (["accepted", "in_progress"].includes(ride.status)) {
            setActiveRide((prev: any) => (prev?.id === ride.id ? { ...prev, ...ride } : ride));
            if (ride.status === "in_progress") setRideState("in_ride");
            else if (ride.arrived_at) setRideState("arrived");
            else setRideState("going_to_passenger");
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

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
    const arrivedAt = new Date().toISOString();
    const { error } = await supabase
      .from("rides")
      .update({ arrived_at: arrivedAt } as any)
      .eq("id", activeRide.id);
    if (error) {
      toast.error("Erro ao notificar chegada: " + error.message);
      return;
    }
    setActiveRide({ ...activeRide, arrived_at: arrivedAt });
    setRideState("arrived");
    toast.success("Passageiro avisado: você chegou! 📍");
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    const startedAt = new Date().toISOString();
    const { error } = await supabase.from("rides")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", activeRide.id);
    if (error) {
      toast.error("Erro ao iniciar corrida: " + error.message);
      return;
    }
    setActiveRide({ ...activeRide, status: "in_progress", started_at: startedAt });
    setRideState("in_ride");
    toast.success("Corrida iniciada!");
  };

  const handleFinishRide = async () => {
    if (!activeRide || !user) return;
    const platformFee = Number(activeRide.platform_fee || 0);
    const isPix = activeRide.payment_method === "pix";

    await supabase.from("rides")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        ...(isPix ? { pix_paid_at: new Date().toISOString() } : {}),
      })
      .eq("id", activeRide.id);
    if (driverData) {
      await supabase.from("drivers")
        .update({
          balance: Math.max(0, Number(balance) - platformFee),
          total_rides: (driverData.total_rides || 0) + 1,
        })
        .eq("user_id", user.id);
    }
    if (isPix) {
      toast.success("Corrida finalizada! Confirme o recebimento do Pix com o passageiro.");
    } else {
      toast.success(`Corrida finalizada! Taxa: R$ ${platformFee.toFixed(2)}`);
    }
    setActiveRide(null);
    setRideState("idle");
  };

  const handleToggleOnline = () => {
    if ((driverData as any)?.online_blocked && !isOnline) {
      toast.error("Você está impedido de ficar online. Entre em contato com o suporte.");
      return;
    }
    if (lowBalance && !isOnline) {
      toast.error("Saldo insuficiente. Recarregue para ficar online!");
      return;
    }
    // Se vai ficar online, pede permissão de GPS imediatamente para não cair em lat/lng = 0
    if (!isOnline) {
      if (!navigator.geolocation) {
        toast.error("Seu navegador não suporta geolocalização.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => {
          setIsOnline(true);
          toast.success("Você está Online! Aguardando corridas...");
        },
        (err) => {
          console.warn("GPS negado/erro:", err.message);
          toast.error(
            "Não foi possível obter sua localização. Ative o GPS e permita o acesso para receber corridas.",
            { duration: 6000 }
          );
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return;
    }
    setIsOnline(false);
    toast("Você está Offline");
  };

  const originPoint = activeRide
    ? { lat: Number(activeRide.origin_lat), lng: Number(activeRide.origin_lng), label: "Passageiro" }
    : null;
  const destPoint = activeRide
    ? { lat: Number(activeRide.destination_lat), lng: Number(activeRide.destination_lng), label: "Destino" }
    : null;

  // Carrega nome do passageiro quando há corrida aceita
  useEffect(() => {
    if (!activeRide?.passenger_id) { setPassengerName(""); return; }
    supabase.from("profiles").select("full_name").eq("user_id", activeRide.passenger_id).single()
      .then(({ data }) => setPassengerName(data?.full_name ?? "Passageiro"));
  }, [activeRide?.passenger_id]);

  // 🚨 Bloqueia acesso se não estiver aprovado (após todos os hooks)
  const statusInfo = getDriverStatusInfo(driverData?.status);
  if (driverData && !statusInfo.canDrive) {
    return <Navigate to="/driver/status" replace />;
  }

  // Chat overlay (apenas quando corrida está ativa)
  if (showChat && activeRide) {
    return <RideChat rideId={activeRide.id} driverName={passengerName} onBack={() => setShowChat(false)} />;
  }

  const isIdleHome = rideState === "idle" && !activeRide && !pendingOffer;

  // === Tela inicial estilo passageiro: mapa em tela cheia + CTA Ficar Online ===
  if (isIdleHome) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative">
          <GoogleMap
            className="h-screen rounded-none transition-all duration-300"
            trackUserLocation={true}
            userMarkerVariant={
              driverData?.category === "moto"
                ? "moto"
                : driverData?.category === "conforto"
                  ? "car-conforto"
                  : "car-economico"
            }
            bottomInset={120}
          />
        </div>

        {/* CTA fixo logo acima da bottom nav do motorista */}
        <div
          className="fixed inset-x-0 bottom-[72px] z-40 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pt-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
        >
          {lowBalance && !isOnline && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-warning/10 border border-warning/30 p-2.5">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-xs font-semibold text-warning">Saldo baixo — recarregue para ficar online</p>
            </div>
          )}
          <button
            onClick={handleToggleOnline}
            disabled={lowBalance && !isOnline}
            className={`w-full rounded-2xl py-4 text-base font-extrabold shadow-glow transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              isOnline
                ? "bg-success text-success-foreground"
                : "bg-gradient-primary text-primary-foreground"
            }`}
          >
            {isOnline ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success-foreground opacity-60 animate-ping" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-success-foreground" />
                </span>
                Você está Online! 🚀
              </>
            ) : (
              <>
                <Power className="h-5 w-5" /> Ficar Online
              </>
            )}
          </button>
        </div>

        <AppMenu role="driver" />
        <DriverEarningsChip />
        <NotificationBell />
        <DriverBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="flex items-center justify-between bg-card border-b p-4 pt-20">
        <div>
          <h1 className="text-lg font-bold font-display">Olá, {displayName}</h1>
          <p className="text-xs text-muted-foreground">{categoryLabel} • Saldo: R$ {Number(balance).toFixed(2)}</p>
        </div>
        {isOnline && (
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Online
          </span>
        )}
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
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <Clock className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-bold text-primary uppercase">Nova corrida</span>
            </div>
            <span className={`text-2xl font-extrabold tabular-nums ${offerCountdown <= 5 ? "text-destructive animate-pulse" : "text-warning"}`}>{offerCountdown}s</span>
          </div>

          {/* Progress bar countdown */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-500 ease-linear ${offerCountdown <= 5 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${(offerCountdown / 15) * 100}%` }}
            />
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
              Aceitar corrida
            </button>
          </div>
        </div>
      )}

      {/* Going to passenger */}
      {rideState === "going_to_passenger" && activeRide && (
        <div className="mx-4 mt-4 rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-info truncate">A caminho do passageiro</span>
              {activeRide.ride_code && (
                <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{activeRide.ride_code}</span>
              )}
            </div>
            <span className="font-extrabold shrink-0">R$ {Number(activeRide.price).toFixed(2)}</span>
          </div>

          {/* Aviso: corrida para outra pessoa */}
          {activeRide.for_other_person && (
            <div className="rounded-xl border-2 border-warning bg-warning/10 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-warning/20 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-warning" />
                </div>
                <p className="text-xs font-bold text-warning uppercase">Corrida para outra pessoa</p>
              </div>
              <div className="rounded-lg bg-card p-2.5 space-y-1">
                <p className="text-xs text-muted-foreground">Quem vai embarcar</p>
                <p className="text-sm font-bold">{activeRide.other_person_name}</p>
                <a href={`tel:${activeRide.other_person_phone?.replace(/\D/g, "")}`} className="flex items-center gap-1.5 text-sm font-mono font-bold text-primary">
                  <Phone className="h-3.5 w-3.5" /> {activeRide.other_person_phone}
                </a>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-success mt-0.5 shrink-0" />
            <p className="text-sm">{activeRide.origin_address?.split(" - ")[0]}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                const phone = activeRide.for_other_person ? activeRide.other_person_phone : "";
                if (phone) window.location.href = `tel:${phone.replace(/\D/g, "")}`;
                else toast("Use o chat para falar com o solicitante");
              }}
              className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold">
              <Phone className="h-4 w-4 text-primary" /> Ligar {activeRide.for_other_person ? "passageiro" : ""}
            </button>
            <button onClick={() => setShowChat(true)} className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold hover:bg-muted">
              <MessageCircle className="h-4 w-4 text-primary" /> Chat
            </button>
          </div>
          <button
            onClick={() => openGoogleMapsRoute(Number(activeRide.origin_lat), Number(activeRide.origin_lng), "Embarque")}
            className="w-full rounded-xl border-2 border-primary bg-primary/5 py-3 text-sm font-bold text-primary flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors">
            <NavigationIcon className="h-4 w-4" /> Navegar até passageiro (Google Maps)
          </button>
          <button onClick={handleArrived}
            className="w-full rounded-xl bg-info py-3 text-sm font-bold text-info-foreground flex items-center justify-center gap-2">
            <MapPin className="h-4 w-4" /> Cheguei ao local
          </button>
        </div>
      )}

      {/* Arrived */}
      {rideState === "arrived" && activeRide && (
        <div className="mx-4 mt-4 rounded-2xl border bg-card p-4 space-y-3">
          {activeRide.ride_code && (
            <div className="flex justify-center">
              <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{activeRide.ride_code}</span>
            </div>
          )}
          <div className="rounded-xl bg-success/10 p-3 text-center">
            <p className="text-sm font-bold text-success">📍 Aguardando passageiro embarcar</p>
          </div>
          <button onClick={handleStartRide}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2">
            <Play className="h-4 w-4" /> Iniciar corrida
          </button>
        </div>
      )}

      {/* In ride */}
      {rideState === "in_ride" && activeRide && (
        <div className="mx-4 mt-4 rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-success truncate">🛣️ Em corrida</span>
              {activeRide.ride_code && (
                <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{activeRide.ride_code}</span>
              )}
            </div>
            <span className="font-extrabold shrink-0">R$ {Number(activeRide.price).toFixed(2)}</span>
          </div>
          <div className="flex items-start gap-2">
            <Flag className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm">{activeRide.destination_address?.split(" - ")[0]}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {activeRide.distance_km} km • ~{activeRide.duration_minutes} min • Taxa plataforma: R$ {Number(activeRide.platform_fee).toFixed(2)}
          </div>
          <button
            onClick={() => openGoogleMapsRoute(Number(activeRide.destination_lat), Number(activeRide.destination_lng), "Destino")}
            className="w-full rounded-xl border-2 border-primary bg-primary/5 py-3 text-sm font-bold text-primary flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors">
            <NavigationIcon className="h-4 w-4" /> Navegar até destino (Google Maps)
          </button>
          {activeRide.payment_method === "pix" ? (
            <button onClick={() => setShowPixModal(true)}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2">
              <QrCode className="h-4 w-4" /> Cobrar (Gerar Pix)
            </button>
          ) : (
            <button onClick={handleFinishRide}
              className="w-full rounded-xl bg-success py-3 text-sm font-bold text-success-foreground flex items-center justify-center gap-2">
              <Flag className="h-4 w-4" /> Finalizar corrida
            </button>
          )}
        </div>
      )}

      {/* (Estados de idle são tratados pela tela inicial estilo passageiro acima) */}

      {/* Modal Pix — exibido pelo motorista quando vai cobrar */}
      <PixPaymentModal
        open={showPixModal}
        onClose={() => setShowPixModal(false)}
        onMarkAsPaid={async () => {
          await handleFinishRide();
          setShowPixModal(false);
        }}
        confirmLabel="Recebi — finalizar corrida"
        driverName={profile?.full_name || "Motorista"}
        pixKey={driverData?.pix_key || null}
        pixKeyType={(driverData?.pix_key_type as PixKeyType) || null}
        amount={Number(activeRide?.price || 0)}
        rideId={activeRide?.id || ""}
        merchantCity={activeRide?.origin_address?.split(",").slice(-2, -1)[0]?.trim()}
      />

      <AppMenu role="driver" />
      <DriverEarningsChip />
      <NotificationBell />
      <DriverBottomNav />
    </div>
  );
};

export default DriverHome;
