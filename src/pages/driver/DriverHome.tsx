import { useState, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { AlertTriangle, MapPin, Play, Flag, Phone, MessageCircle, Star, Clock, QrCode, Navigation as NavigationIcon } from "lucide-react";
import { openGoogleMapsRoute } from "@/lib/externalNav";
import { getRideDestination, getRideNextTarget, getRideStops, routePointName } from "@/lib/rideRoute";
import { getDriverStatusInfo } from "@/lib/driverStatus";
import AppMenu from "@/components/shared/AppMenu";
import BlockBanner from "@/components/shared/BlockBanner";
import NotificationBell from "@/components/shared/NotificationBell";
import RefreshAppButton from "@/components/shared/RefreshAppButton";
import DriverEarningsChip from "@/components/driver/DriverEarningsChip";
import DriverBottomNav from "@/components/driver/DriverBottomNav";

import GoogleMap from "@/components/shared/GoogleMap";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import RideChat from "@/components/passenger/RideChat";
import PixPaymentModal from "@/components/passenger/PixPaymentModal";
import CancelRideDialog from "@/components/shared/CancelRideDialog";
import SelectVehicleModal from "@/components/driver/SelectVehicleModal";
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
  const [, setTodayStats] = useState({ rides: 0, earnings: 0, hours: 0 });
  const [rideState, setRideState] = useState<DriverRideState>("idle");
  const [offerCountdown, setOfferCountdown] = useState(15);
  const [showChat, setShowChat] = useState(false);
  const [passengerName, setPassengerName] = useState<string>("");
  const [showPixModal, setShowPixModal] = useState(false);
  const [passengerRating, setPassengerRating] = useState(0);
  const [passengerRatingComment, setPassengerRatingComment] = useState("");
  const [ratedRide, setRatedRide] = useState<any>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  // Modal obrigatório de seleção de veículo após login (quando há 2+ aprovados).
  const [requireVehiclePick, setRequireVehiclePick] = useState(false);
  // IDs de corridas já avaliadas/encerradas localmente — evita que UPDATEs do realtime
  // (incluindo o nosso próprio update do driver_rating) reabram o modal.
  const finalizedRideIdsRef = useRef<Set<string>>(new Set());

  const balance = driverData?.balance ?? 0;
  const lowBalance = balance < 5;
  // Faz broadcast da posição GPS quando online
  const { lastSyncAt } = useDriverLocation({
    driverId: user?.id,
    isOnline,
    category: driverData?.category,
    onBlocked: (msg) => {
      toast.error(msg);
      setIsOnline(false);
    },
  });

  // Bootstrap: destrava áudio + pede permissão de notificação na 1ª interação
  useEffect(() => {
    unlockAudioOnce();
    requestNotificationPermission().catch(() => {});
  }, []);

  // Após login, se houver 2+ veículos aprovados, força o motorista a escolher.
  useEffect(() => {
    if (!user?.id) return;
    const flag = sessionStorage.getItem("vamoo:driver:check_vehicle");
    if (!flag) return;
    sessionStorage.removeItem("vamoo:driver:check_vehicle");
    supabase
      .from("driver_vehicles")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", user.id)
      .eq("status", "approved")
      .then(({ count }) => {
        if ((count || 0) >= 2) setRequireVehiclePick(true);
      });
  }, [user?.id]);

  // Tick de 1s para reavaliar a cor do sino (conectado/desconectado) sem F5.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    if (!isOnline) return;
    const i = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [isOnline]);

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

    // Verifica se a oferta ainda é válida antes de tentar
    if (pendingOffer.expires_at && new Date(pendingOffer.expires_at).getTime() < Date.now()) {
      toast.error("Tempo da oferta esgotou");
      setPendingOffer(null); setPendingRide(null); setRideState("idle");
      return;
    }

    // Tenta atualizar a corrida (atomic — só 1 motorista consegue)
    const { data: updated, error } = await supabase.from("rides")
      .update({ driver_id: user.id, status: "accepted" })
      .eq("id", pendingRide.id)
      .eq("status", "requested")
      .is("driver_id", null)
      .select().single();

    if (error || !updated) {
      const { isGuardError, guardErrorMessage } = await import("@/lib/guardErrors");
      if (error && isGuardError(error)) {
        toast.error(guardErrorMessage(error, "Não foi possível aceitar a corrida"));
      } else {
        // Verifica o estado real da corrida para dar feedback preciso
        const { data: cur } = await supabase.from("rides")
          .select("status, driver_id").eq("id", pendingRide.id).maybeSingle();
        if (cur?.status === "cancelled") toast.error("O passageiro cancelou esta corrida");
        else if (cur?.driver_id && cur.driver_id !== user.id) toast.error("Outro motorista já aceitou");
        else toast.error("Não foi possível aceitar a corrida");
      }
      setPendingOffer(null); setPendingRide(null); setRideState("idle");
      return;
    }

    // Marca a oferta como aceita
    await supabase.from("ride_offers").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", pendingOffer.id);

    setActiveRide(updated);
    setPendingOffer(null);
    setPendingRide(null);
    setRideState("going_to_passenger");
    playPhaseSound("accepted");
    toast.success("Corrida aceita! 🚗");
  };

  const handleReject = async () => {
    if (!pendingOffer) return;
    await supabase.from("ride_offers").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("id", pendingOffer.id);
    setPendingOffer(null); setPendingRide(null); setRideState("idle");
  };

  const handleArrived = async () => {
    if (!activeRide) return;
    const arrivedAt = new Date().toISOString();
    const { error } = await supabase
      .from("rides")
      .update({ arrived_at: arrivedAt } as any)
      .eq("id", activeRide.id);
    if (error) return;
    setActiveRide({ ...activeRide, arrived_at: arrivedAt });
    setRideState("arrived");
    playPhaseSound("arrived");
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    const startedAt = new Date().toISOString();
    const { error } = await supabase.from("rides")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", activeRide.id);
    if (error) return;
    setActiveRide({ ...activeRide, status: "in_progress", started_at: startedAt });
    setCurrentStopIndex(0);
    setRideState("in_ride");
    playPhaseSound("started");
  };

  const handleConfirmStop = () => {
    if (!activeRide) return;
    const stops = getRideStops(activeRide);
    const nextIndex = Math.min(currentStopIndex + 1, stops.length);
    setCurrentStopIndex(nextIndex);
    localStorage.setItem(`ride-stop-index-${activeRide.id}`, String(nextIndex));
    toast.success(nextIndex < stops.length ? `Parada ${nextIndex} confirmada` : "Última parada confirmada");
  };

  const handleFinishRide = async () => {
    if (!activeRide || !user) return;
    const platformFee = Number(activeRide.platform_fee || 0);
    const isPix = activeRide.payment_method === "pix";

    const { error: finishErr } = await supabase.from("rides")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        payment_status: "paid",
        ...(isPix ? { pix_paid_at: new Date().toISOString() } : {}),
      })
      .eq("id", activeRide.id);
    if (finishErr) return;
    if (driverData) {
      await supabase.from("drivers")
        .update({
          balance: Math.max(0, Number(balance) - platformFee),
          total_rides: (driverData.total_rides || 0) + 1,
        })
        .eq("user_id", user.id);
    }
    // Guarda a corrida para avaliação e abre modal — mantém o motorista online.
    localStorage.removeItem(`ride-stop-index-${activeRide.id}`);
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
  const rideStops = activeRide ? getRideStops(activeRide) : [];
  const destinationPoint = activeRide ? getRideDestination(activeRide) : null;
  const nextTarget = activeRide?.status === "in_progress" ? getRideNextTarget(activeRide, currentStopIndex) : destinationPoint;
  const remainingStops = activeRide?.status === "in_progress" ? rideStops.slice(currentStopIndex) : rideStops;
  const routeStops = activeRide?.status === "in_progress" ? remainingStops : rideStops;

  // Carrega nome do passageiro quando há corrida aceita
  useEffect(() => {
    if (!activeRide?.passenger_id) { setPassengerName(""); return; }
    supabase.from("profiles").select("full_name").eq("user_id", activeRide.passenger_id).single()
      .then(({ data }) => setPassengerName(data?.full_name ?? "Passageiro"));
  }, [activeRide?.passenger_id]);

  useEffect(() => {
    if (!activeRide?.id || activeRide.status !== "in_progress") {
      setCurrentStopIndex(0);
      return;
    }
    const stored = Number(localStorage.getItem(`ride-stop-index-${activeRide.id}`) || 0);
    const max = getRideStops(activeRide).length;
    setCurrentStopIndex(Number.isFinite(stored) ? Math.min(Math.max(0, stored), max) : 0);
  }, [activeRide?.id, activeRide?.status]);

  // 🚨 Reage instantaneamente a mudanças de status feitas pelo admin (realtime).
  // Se o admin reprova/bloqueia/pede docs, força o motorista offline na hora,
  // mostra toast e o redirect abaixo o leva para /driver/status sem precisar deslogar.
  const statusInfo = getDriverStatusInfo(driverData?.status);
  const lastStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const current = driverData?.status ?? null;
    const previous = lastStatusRef.current;
    if (current && previous && current !== previous) {
      const info = getDriverStatusInfo(current);
      if (!info.canDrive) {
        // Força offline no banco para parar de receber ofertas imediatamente
        if (user) {
          supabase.from("driver_locations")
            .update({ is_online: false })
            .eq("driver_id", user.id)
            .then(() => {});
        }
        setIsOnline(false);
        toast.error(`Status alterado: ${info.label}`, {
          description: info.description,
          duration: 6000,
        });
      } else if (info.canDrive && !getDriverStatusInfo(previous).canDrive) {
        toast.success(`Cadastro ${info.label.toLowerCase()}! Você já pode ficar online.`);
      }
    }
    lastStatusRef.current = current;
  }, [driverData?.status, user]);

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
            <button
              onClick={() => setShowCancelDialog(true)}
              className="w-full rounded-xl border border-destructive/30 py-2 text-xs font-bold text-destructive hover:bg-destructive/5"
            >
              Cancelar corrida
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
            <button
              onClick={() => setShowCancelDialog(true)}
              className="w-full rounded-xl border border-destructive/30 py-2 text-xs font-bold text-destructive hover:bg-destructive/5"
            >
              Cancelar corrida
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
        onOpenChange={() => { /* avaliação obrigatória — não permite fechar */ }}
      >
        <DialogContent
          className="max-w-sm w-[calc(100vw-2rem)] max-h-[90dvh] p-0 gap-0 flex flex-col overflow-hidden [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
            <DialogTitle className="text-center font-display">Avalie o passageiro</DialogTitle>
            <p className="text-center text-[11px] text-muted-foreground mt-0.5">
              Avaliação obrigatória para receber novas corridas
            </p>
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
              <div className="px-5 pt-3 pb-5 border-t bg-background shrink-0">
                <button
                  onClick={handleSubmitDriverRating}
                  disabled={passengerRating === 0}
                  className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
                >
                  {passengerRating === 0 ? "Selecione de 1 a 5 estrelas" : "Enviar avaliação ⭐"}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AppMenu role="driver" />
      <DriverEarningsChip />
      <div className="fixed left-0 right-0 top-16 z-30 pointer-events-none">
        <div className="pointer-events-auto">
          <BlockBanner role="driver" />
        </div>
      </div>
      <CancelRideDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onCancelled={() => {
          setActiveRide(null);
          setRideState("idle");
        }}
        rideId={activeRide?.id ?? null}
        role="driver"
        afterAccept={true}
        inProgress={activeRide?.status === "in_progress"}
        acceptedAt={activeRide?.updated_at ?? null}
      />
      <NotificationBell
        topOffsetPx={72}
        connectionStatus={
          !isOnline
            ? "idle"
            : !lastSyncAt || Date.now() - lastSyncAt > 60000
              ? "disconnected"
              : "connected"
        }
      />
      <RefreshAppButton topOffsetPx={144} />
      <SelectVehicleModal
        open={requireVehiclePick}
        onOpenChange={setRequireVehiclePick}
        required
      />
      <DriverBottomNav
        centerSlot={
          <button
            onClick={handleToggleOnline}
            disabled={(lowBalance && !isOnline) || !!activeRide || rideState === "offer"}
            role="switch"
            aria-checked={isOnline || !!activeRide}
            aria-label={isOnline || activeRide ? "Ficar offline" : "Ficar online"}
            className={`pointer-events-auto relative flex h-16 w-28 items-center rounded-full px-1.5 shadow-glow ring-2 ring-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isOnline || activeRide ? "bg-success" : "bg-destructive"
            }`}
          >
            <span
              className={`absolute top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-background text-xs font-extrabold tracking-wider shadow-md transition-all ${
                isOnline || activeRide
                  ? "left-[calc(100%-3.25rem)] text-success"
                  : "left-1.5 text-destructive"
              }`}
            >
              {isOnline || activeRide ? "ON" : "OFF"}
            </span>
          </button>
        }
      />
    </div>
  );
};

export default DriverHome;
