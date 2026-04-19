import { useState, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { Power, Wallet, AlertTriangle, Car, MapPin, Loader2, Play, Flag, Phone, MessageCircle, Star, Clock, X, QrCode, Navigation as NavigationIcon } from "lucide-react";
import { openGoogleMapsRoute } from "@/lib/externalNav";
import { getDriverStatusInfo } from "@/lib/driverStatus";
import AppMenu from "@/components/shared/AppMenu";
import NotificationBell from "@/components/shared/NotificationBell";
import RefreshAppButton from "@/components/shared/RefreshAppButton";
import DriverEarningsChip from "@/components/driver/DriverEarningsChip";
import DriverBottomNav from "@/components/driver/DriverBottomNav";
import DriverHeartbeat from "@/components/driver/DriverHeartbeat";

import GoogleMap from "@/components/shared/GoogleMap";
import { Home, User, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import RideChat from "@/components/passenger/RideChat";
import PixPaymentModal from "@/components/passenger/PixPaymentModal";
import type { PixKeyType } from "@/lib/pix";
import { toast } from "sonner";
import { playOfferAlert, playPhaseSound, unlockAudioOnce, requestNotificationPermission } from "@/lib/offerSound";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


type DriverRideState = "idle" | "offer" | "going_to_passenger" | "arrived" | "in_ride" | "rating";

const paymentLabels: Record<string, string> = { cash: "Dinheiro", pix: "Pix", debit: "Débito", credit: "Crédito" };

const playOfferSound = (ride?: any) => {
  playOfferAlert({
    title: "Nova corrida! 🚗",
    body: ride ? `${ride.origin_address?.slice(0, 60)} → ${ride.destination_address?.slice(0, 60)}` : undefined,
  });
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
  const [passengerRating, setPassengerRating] = useState(0);
  const [passengerRatingComment, setPassengerRatingComment] = useState("");
  const [ratedRide, setRatedRide] = useState<any>(null);
  // IDs de corridas já avaliadas/encerradas localmente — evita que UPDATEs do realtime
  // (incluindo o nosso próprio update do driver_rating) reabram o modal.
  const finalizedRideIdsRef = useRef<Set<string>>(new Set());

  const balance = driverData?.balance ?? 0;
  const lowBalance = balance < 5;
  const displayName = profile?.full_name?.split(" ")[0] || "Motorista";

  const categoryLabel = driverData?.category === "moto" ? "Moto" : driverData?.category === "conforto" ? "Conforto" : "Econômico";

  // Faz broadcast da posição GPS quando online
  const { lastSyncAt } = useDriverLocation({ driverId: user?.id, isOnline, category: driverData?.category });

  // Bootstrap: destrava áudio + pede permissão de notificação na 1ª interação
  useEffect(() => {
    unlockAudioOnce();
    requestNotificationPermission().catch(() => {});
  }, []);

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

  // 🔄 Auto-online ao carregar/recarregar a Home:
  // - Se já estava online no banco (heartbeat < 2min), mantém online.
  // - Caso contrário, fica online automaticamente, EXCETO se o motorista tiver
  //   escolhido manualmente ficar offline neste dispositivo (flag em localStorage).
  // - Não força online se estiver bloqueado, sem saldo ou sem GPS.
  useEffect(() => {
    if (!user) return;
    supabase.from("driver_locations")
      .select("is_online, updated_at")
      .eq("driver_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const fresh = data?.updated_at && (Date.now() - new Date(data.updated_at).getTime()) < 2 * 60 * 1000;
        // Caso 1: já estava online recentemente em outra aba/rota → mantém online
        if (data?.is_online && fresh) {
          setIsOnline(true);
          return;
        }
        // Caso 2: respeita escolha manual de offline (até o motorista clicar Online de novo)
        const manualOfflineKey = `driver-manual-offline-${user.id}`;
        if (localStorage.getItem(manualOfflineKey)) return;
        const blocked = (driverData as any)?.online_blocked;
        if (blocked || lowBalance) return;
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          () => {
            setIsOnline(true);
            toast.success("Você está Online! Aguardando corridas...");
          },
          () => {
            // GPS negado — mantém offline silenciosamente; usuário pode ativar manualmente
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, driverData?.online_blocked, lowBalance]);

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
        playOfferSound(offer.rides);
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
        playOfferSound(ride);
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
          // Se já avaliamos/pulamos esta corrida, ignora UPDATEs subsequentes
          // (caso contrário o próprio UPDATE do driver_rating reabriria o modal).
          if (finalizedRideIdsRef.current.has(ride.id)) return;
          if (ride.status === "cancelled") {
            setActiveRide(null);
            setRideState("idle");
            setShowChat(false);
            toast.error("O passageiro cancelou a corrida");
          } else if (ride.status === "completed") {
            // Mantém ride para avaliação; só limpa activeRide quando avaliar/pular
            setRatedRide((prev: any) => prev ?? ride);
            setActiveRide(null);
            setRideState("rating");
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
    playPhaseSound("accepted");
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
    playPhaseSound("arrived");
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
    playPhaseSound("started");
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
    // Guarda a corrida para avaliação e abre modal — mantém o motorista online.
    setRatedRide(activeRide);
    setActiveRide(null);
    setRideState("rating");
    playPhaseSound("completed");
  };

  const handleSubmitDriverRating = async () => {
    if (!ratedRide || passengerRating === 0) return;
    // Marca antes do update para que o eco do realtime não reabra o modal.
    finalizedRideIdsRef.current.add(ratedRide.id);
    await supabase
      .from("rides")
      .update({
        driver_rating: passengerRating,
        driver_rating_comment: passengerRatingComment?.trim() || null,
      } as any)
      .eq("id", ratedRide.id);
    toast.success("Avaliação enviada! ⭐");
    closeDriverRating();
  };

  const closeDriverRating = () => {
    // Marca como finalizada para que UPDATEs em atraso não reabram o modal de rating
    if (ratedRide?.id) finalizedRideIdsRef.current.add(ratedRide.id);
    setRatedRide(null);
    setPassengerRating(0);
    setPassengerRatingComment("");
    setRideState("idle");
    // Motorista permanece online — pronto para receber novas corridas
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
          if (user) localStorage.removeItem(`driver-manual-offline-${user.id}`);
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
    if (user) localStorage.setItem(`driver-manual-offline-${user.id}`, "1");
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

  // === TELA ÚNICA: mapa fullscreen + botão Online sempre visíveis. Etapas viram mini pop-ups ===
  return (
    <div className="min-h-screen bg-background">
      {/* Mapa em tela cheia em TODAS as fases — todos os botões e cards
          (menu, sino, chip de saldo, bottom nav, pop-ups de etapa) ficam fixos
          sobrepostos ao mapa, sem empurrar/encolher ele. */}
      <div className="fixed inset-0 z-0">
        <GoogleMap
          className="h-full w-full rounded-none"
          origin={(rideState === "going_to_passenger" || rideState === "arrived" || rideState === "in_ride") ? originPoint : null}
          destination={rideState === "in_ride" ? destPoint : null}
          trackUserLocation={!activeRide}
          showRoute={rideState === "going_to_passenger" || rideState === "in_ride"}
          userMarkerVariant={
            driverData?.category === "moto"
              ? "moto"
              : driverData?.category === "conforto"
                ? "car-conforto"
                : "car-economico"
          }
          bottomInset={96}
        />
      </div>

      {/* Aviso de saldo baixo — flutua logo acima da bottom nav (o botão Ficar Online
          agora vive dentro da DriverBottomNav, entre Corridas e Carteira) */}
      {lowBalance && !isOnline && (
        <div
          className="fixed inset-x-0 bottom-[72px] z-30 px-4 pointer-events-none"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-center gap-2 rounded-xl bg-warning/95 backdrop-blur-md border border-warning p-2.5 shadow-lg pointer-events-auto">
            <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0" />
            <p className="text-xs font-semibold text-warning-foreground">Saldo baixo — recarregue para ficar online</p>
          </div>
        </div>
      )}

      {/* === MINI POP-UPS das etapas da corrida — sobrepõem o mapa, acima do botão Online === */}

      {/* OFERTA recebida — pop-up de tela cheia com countdown */}
      {rideState === "offer" && pendingRide && pendingOffer && (
        <div
          className="fixed inset-x-0 bottom-[160px] z-40 px-4 animate-slide-up"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
        >
          <div className="rounded-2xl border-2 border-primary bg-card p-4 shadow-glow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-bold text-primary uppercase">Nova corrida</span>
              </div>
              <span className={`text-2xl font-extrabold tabular-nums ${offerCountdown <= 5 ? "text-destructive animate-pulse" : "text-warning"}`}>{offerCountdown}s</span>
            </div>

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
                Aceitar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOING TO PASSENGER — mini pop-up compacto */}
      {rideState === "going_to_passenger" && activeRide && (
        <div
          className="fixed inset-x-0 bottom-[160px] z-40 px-4 animate-slide-up"
        >
          <div className="rounded-2xl border bg-card p-3 shadow-glow space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-info truncate">A caminho do passageiro</span>
                {activeRide.ride_code && (
                  <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{activeRide.ride_code}</span>
                )}
              </div>
              <span className="text-sm font-extrabold shrink-0">R$ {Number(activeRide.price).toFixed(2)}</span>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
              <p className="text-xs truncate">{activeRide.origin_address?.split(" - ")[0]}</p>
            </div>

            {activeRide.for_other_person && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-[11px]">
                <span className="font-bold text-warning">Outra pessoa:</span> {activeRide.other_person_name} — <a href={`tel:${activeRide.other_person_phone?.replace(/\D/g, "")}`} className="font-mono font-bold text-primary">{activeRide.other_person_phone}</a>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => {
                  const phone = activeRide.for_other_person ? activeRide.other_person_phone : "";
                  if (phone) window.location.href = `tel:${phone.replace(/\D/g, "")}`;
                  else toast("Use o chat para falar com o solicitante");
                }}
                className="flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold">
                <Phone className="h-3.5 w-3.5 text-primary" /> Ligar
              </button>
              <button onClick={() => setShowChat(true)} className="flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold">
                <MessageCircle className="h-3.5 w-3.5 text-primary" /> Chat
              </button>
              <button
                onClick={() => openGoogleMapsRoute(Number(activeRide.origin_lat), Number(activeRide.origin_lng), "Embarque")}
                className="flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold">
                <NavigationIcon className="h-3.5 w-3.5 text-primary" /> Rota
              </button>
            </div>

            <button onClick={handleArrived}
              className="w-full rounded-xl bg-info py-2.5 text-sm font-bold text-info-foreground flex items-center justify-center gap-2">
              <MapPin className="h-4 w-4" /> Cheguei ao local
            </button>
          </div>
        </div>
      )}

      {/* ARRIVED — mini pop-up */}
      {rideState === "arrived" && activeRide && (
        <div
          className="fixed inset-x-0 bottom-[160px] z-40 px-4 animate-slide-up"
        >
          <div className="rounded-2xl border bg-card p-3 shadow-glow space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-success">📍 Aguardando embarque</span>
              {activeRide.ride_code && (
                <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{activeRide.ride_code}</span>
              )}
            </div>
            <button onClick={handleStartRide}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2">
              <Play className="h-4 w-4" /> Iniciar corrida
            </button>
          </div>
        </div>
      )}

      {/* IN RIDE — mini pop-up */}
      {rideState === "in_ride" && activeRide && (
        <div
          className="fixed inset-x-0 bottom-[160px] z-40 px-4 animate-slide-up"
        >
          <div className="rounded-2xl border bg-card p-3 shadow-glow space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-success truncate">🛣️ Em corrida</span>
                {activeRide.ride_code && (
                  <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{activeRide.ride_code}</span>
                )}
              </div>
              <span className="text-sm font-extrabold shrink-0">R$ {Number(activeRide.price).toFixed(2)}</span>
            </div>
            <div className="flex items-start gap-2">
              <Flag className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs truncate">{activeRide.destination_address?.split(" - ")[0]}</p>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {activeRide.distance_km} km • ~{activeRide.duration_minutes} min • Taxa: R$ {Number(activeRide.platform_fee).toFixed(2)}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => openGoogleMapsRoute(Number(activeRide.destination_lat), Number(activeRide.destination_lng), "Destino")}
                className="flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold">
                <NavigationIcon className="h-3.5 w-3.5 text-primary" /> Rota
              </button>
              <button onClick={() => setShowChat(true)} className="flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold">
                <MessageCircle className="h-3.5 w-3.5 text-primary" /> Chat
              </button>
            </div>
            {activeRide.payment_method === "pix" ? (
              <button onClick={() => setShowPixModal(true)}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2">
                <QrCode className="h-4 w-4" /> Cobrar (Gerar Pix)
              </button>
            ) : (
              <button onClick={handleFinishRide}
                className="w-full rounded-xl bg-success py-2.5 text-sm font-bold text-success-foreground flex items-center justify-center gap-2">
                <Flag className="h-4 w-4" /> Finalizar corrida
              </button>
            )}
          </div>
        </div>
      )}
      {/* /mini pop-ups */}

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

      {/* Modal de avaliação do passageiro pelo motorista — sobreposto sobre a tela inicial.
          O motorista permanece online; ao enviar/pular, volta a receber novas corridas. */}
      <Dialog
        open={rideState === "rating" && !!ratedRide}
        onOpenChange={(o) => { if (!o) closeDriverRating(); }}
      >
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90dvh] p-0 gap-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
            <DialogTitle className="text-center font-display">Como foi o passageiro?</DialogTitle>
          </DialogHeader>
          {ratedRide && (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {passengerName || "Passageiro"} • {ratedRide.ride_code}
                </p>
                <p className="text-xs text-muted-foreground">
                  Você ganhou <span className="font-bold text-success">R$ {Number(ratedRide.driver_net || 0).toFixed(2)}</span> nesta corrida
                </p>
                <div className="flex justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setPassengerRating(s)} className="transition-transform active:scale-95">
                      <Star className={`h-9 w-9 ${s <= passengerRating ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  placeholder="Algum comentário sobre o passageiro? (opcional)"
                  value={passengerRatingComment}
                  onChange={(e) => setPassengerRatingComment(e.target.value)}
                  className="w-full rounded-xl border bg-muted p-3 text-sm outline-none resize-none h-16"
                />
              </div>
              <div className="px-5 pt-3 pb-5 border-t bg-background space-y-2 shrink-0">
                <button
                  onClick={handleSubmitDriverRating}
                  disabled={passengerRating === 0}
                  className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
                >
                  Enviar avaliação ⭐
                </button>
                <button onClick={closeDriverRating} className="w-full text-xs text-muted-foreground">
                  Pular avaliação
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AppMenu role="driver" />
      <DriverEarningsChip />
      <NotificationBell
        connectionStatus={
          !isOnline
            ? "idle"
            : !lastSyncAt || Date.now() - lastSyncAt > 60000
              ? "disconnected"
              : "connected"
        }
      />
      <RefreshAppButton />
      <DriverBottomNav
        centerSlot={
          <button
            onClick={handleToggleOnline}
            disabled={(lowBalance && !isOnline) || !!activeRide || rideState === "offer"}
            className={`pointer-events-auto flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-extrabold shadow-glow transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap uppercase ${
              isOnline || activeRide
                ? "bg-success text-success-foreground"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            {isOnline || activeRide ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success-foreground opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success-foreground" />
                </span>
                {activeRide ? "Em corrida" : "Online"}
              </>
            ) : (
              <>
                <Power className="h-4 w-4" /> Offline
              </>
            )}
          </button>
        }
      />
    </div>
  );
};

export default DriverHome;
