import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, Plus, Car, Bike, Sparkles, X, Loader2, Phone, MessageCircle, Star, Navigation, Banknote, QrCode, Heart } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import BlockBanner from "@/components/shared/BlockBanner";
import { guardErrorMessage } from "@/lib/guardErrors";
import NotificationBell from "@/components/shared/NotificationBell";
import RefreshAppButton from "@/components/shared/RefreshAppButton";
import PassengerSpendChip from "@/components/passenger/PassengerSpendChip";
import UserAvatar from "@/components/shared/UserAvatar";
import GoogleMap, { LEG_COLORS, vehicleColorToHex } from "@/components/shared/GoogleMap";
import PaymentMethodModal, { type PaymentMethod, type AppliedCoupon } from "@/components/passenger/PaymentMethodModal";
import PixPaymentModal from "@/components/passenger/PixPaymentModal";
import RideChat from "@/components/passenger/RideChat";
import RideSummary from "@/components/passenger/RideSummary";
import OriginPicker, { type OriginType, type OtherPersonInfo } from "@/components/passenger/OriginPicker";
import AddressAutocompleteField from "@/components/address/AddressAutocompleteField";
import CancelRideDialog from "@/components/shared/CancelRideDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useFareEstimate } from "@/hooks/useFareEstimate";
import { useLiveEta } from "@/hooks/useLiveEta";
import type { PlaceDetails } from "@/services/googlePlaces";
import { appLocationFromPlaceDetails, placeDetailsFromAppLocation, type AppLocation } from "@/lib/locationAdapters";
import { getRideStops, getRideDestination } from "@/lib/rideRoute";
import type { PixKeyType } from "@/lib/pix";
import { calcPlatformFee } from "@/lib/platformFee";
import { toast } from "sonner";
import { playPhaseSound, unlockAudioOnce, requestNotificationPermission } from "@/lib/offerSound";

const categories = [
  { id: "moto", label: "Moto", icon: Bike, desc: "Rápido e barato" },
  { id: "economico", label: "Econômico", icon: Car, desc: "Carro popular" },
  { id: "conforto", label: "Conforto", icon: Sparkles, desc: "Mais espaço" },
];


type RideState = "idle" | "payment" | "searching" | "accepted" | "driver_arriving" | "arrived" | "in_progress" | "completed" | "rating";

const paymentLabels: Record<string, string> = { cash: "Dinheiro", pix: "Pix", debit: "Débito", credit: "Crédito" };

const PassengerHome = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [preferredDriver, setPreferredDriver] = useState<{
    id: string;
    name: string;
    photo: string | null;
  } | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("economico");
  const [selectedOrigin, setSelectedOrigin] = useState<AppLocation | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<AppLocation | null>(null);
  const [selectedStops, setSelectedStops] = useState<(AppLocation | null)[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);
  const [rideState, setRideState] = useState<RideState>("idle");
  const [activeRide, setActiveRide] = useState<any>(null);
  // IDs de corridas já avaliadas/encerradas localmente — evita que UPDATEs do realtime
  // (incluindo o nosso próprio update do rating) reabram o modal de avaliação.
  const finalizedRideIdsRef = useRef<Set<string>>(new Set());
  const [showRideForm, setShowRideForm] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
    heading?: number;
    category?: "moto" | "economico" | "conforto";
  } | null>(null);
  // Motoristas online próximos (visíveis no mapa do passageiro antes de pedir corrida)
  const [nearbyDrivers, setNearbyDrivers] = useState<
    { lat: number; lng: number; heading?: number; category?: "moto" | "economico" | "conforto"; color?: string }[]
  >([]);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [favoriteDriver, setFavoriteDriver] = useState(false);
  const [favoritingDriver, setFavoritingDriver] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [originType, setOriginType] = useState<OriginType>("gps");
  const [forOtherPerson, setForOtherPerson] = useState(false);
  const [otherPerson, setOtherPerson] = useState<OtherPersonInfo>({ name: "", phone: "" });
  const [returnToOrigin, setReturnToOrigin] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [showChangeDest, setShowChangeDest] = useState(false);
  const [newDestination, setNewDestination] = useState<AppLocation | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  // Preview da troca de rota (passageiro): calcula km/R$ já percorridos pelo motorista
  // + km/R$ do novo trecho a partir da posição atual, para o passageiro confirmar.
  const [routePreview, setRoutePreview] = useState<{
    drivenKm: number;
    drivenPrice: number;
    newLegKm: number;
    newLegMin: number;
    newLegPrice: number;
    totalKm: number;
    totalMin: number;
    totalPrice: number;
    totalFee: number;
    newLegs: any[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Status do GPS do dispositivo (alimenta o sino: verde=ok, vermelho=negado/erro)
  const [gpsStatus, setGpsStatus] = useState<"connected" | "disconnected" | "idle">("idle");

  // 🚖 Motorista pré-selecionado (vindo da tela "Motoristas favoritos")
  useEffect(() => {
    const id = searchParams.get("preferred");
    if (!id) return;
    try {
      const raw = sessionStorage.getItem("preferred_driver");
      const data = raw ? JSON.parse(raw) : null;
      if (data?.id === id) {
        setPreferredDriver({ id: data.id, name: data.name, photo: data.photo });
        setShowRideForm(true);
      } else {
        setPreferredDriver({ id, name: "Motorista favorito", photo: null });
        setShowRideForm(true);
      }
    } catch {
      setPreferredDriver({ id, name: "Motorista favorito", photo: null });
      setShowRideForm(true);
    }
    // limpa o query param para não reabrir ao voltar
    const next = new URLSearchParams(searchParams);
    next.delete("preferred");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus("disconnected"); return; }
    let cancelled = false;

    // Permissão proativa
    (async () => {
      try {
        // @ts-ignore
        const status = await navigator.permissions?.query({ name: "geolocation" });
        if (cancelled) return;
        if (status?.state === "denied") { setGpsStatus("disconnected"); return; }
        if (status?.state === "granted") setGpsStatus("connected");
      } catch { /* sem Permissions API */ }
    })();

    const watchId = navigator.geolocation.watchPosition(
      () => { if (!cancelled) setGpsStatus("connected"); },
      () => { if (!cancelled) setGpsStatus("disconnected"); },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 }
    );
    return () => { cancelled = true; navigator.geolocation.clearWatch(watchId); };
  }, []);

  // (recentRides removido — não estava em uso na UI)

  useEffect(() => {
    if (!user) return;

    const loadActiveRide = async () => {
      const { data: ride } = await supabase
        .from("rides")
        .select("*")
        .eq("passenger_id", user.id)
        .in("status", ["requested", "accepted", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ride) {
        // 🚨 Avaliação obrigatória: se há corrida concluída sem avaliação,
        // reabre o modal de rating ao entrar no app (impede pular fechando o app).
        const { data: pendingRating } = await supabase
          .from("rides")
          .select("*")
          .eq("passenger_id", user.id)
          .eq("status", "completed")
          .is("rating", null)
          .not("driver_id", "is", null)
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pendingRating) {
          setActiveRide(pendingRating);
          setRideState("rating");
          if (pendingRating.driver_id) {
            const [{ data: driver }, { data: driverProfile }] = await Promise.all([
              supabase.from("drivers").select("*").eq("user_id", pendingRating.driver_id).maybeSingle(),
              supabase.from("profiles").select("*").eq("user_id", pendingRating.driver_id).maybeSingle(),
            ]);
            if (driver && driverProfile) setDriverInfo({ ...driver, profile: driverProfile });
          }
        }
        return;
      }

      setActiveRide(ride);
      setPaymentMethod((ride.payment_method as PaymentMethod) ?? null);

      if (ride.status === "requested") setRideState("searching");
      else if (ride.status === "in_progress") setRideState("in_progress");
      else if (ride.arrived_at) setRideState("arrived");
      else setRideState("driver_arriving");

      if (ride.driver_id) {
        const [{ data: driver }, { data: driverProfile }] = await Promise.all([
          supabase.from("drivers").select("*").eq("user_id", ride.driver_id).maybeSingle(),
          supabase.from("profiles").select("*").eq("user_id", ride.driver_id).maybeSingle(),
        ]);

        if (driver && driverProfile) {
          setDriverInfo({ ...driver, profile: driverProfile });
        }
      }
    };

    loadActiveRide();
  }, [user]);

  // Destrava o áudio na 1ª interação (necessário para autoplay no Chrome/Safari)
  useEffect(() => {
    unlockAudioOnce();
    requestNotificationPermission().catch(() => {});
  }, []);

  // Realtime: updates da corrida + posição do motorista
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("passenger-rides")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `passenger_id=eq.${user.id}` }, async (payload) => {
        const ride = payload.new as any;
        const prev = payload.old as any;
        // Se o passageiro já enviou/pulou avaliação desta corrida, ignora UPDATEs subsequentes
        // (caso contrário o próprio UPDATE do rating reabriria o modal).
        if (finalizedRideIdsRef.current.has(ride.id)) return;
        setActiveRide(ride);

        if (ride.status === "accepted" && ride.driver_id) {
          const { data: driver } = await supabase.from("drivers").select("*").eq("user_id", ride.driver_id).single();
          const { data: driverProfile } = await supabase.from("profiles").select("*").eq("user_id", ride.driver_id).single();
          if (driver && driverProfile) setDriverInfo({ ...driver, profile: driverProfile });
          // Se já tem arrived_at quando chegou o accepted (race condition), pula direto
          if (ride.arrived_at) {
            setRideState("arrived");
            playPhaseSound("arrived");
          } else {
            setRideState("driver_arriving");
            playPhaseSound("accepted");
          }
        } else if (ride.status === "accepted" && ride.arrived_at && !prev?.arrived_at) {
          // Motorista marcou chegada
          setRideState("arrived");
          playPhaseSound("arrived");
        } else if (ride.status === "in_progress") {
          setRideState("in_progress");
          playPhaseSound("started");
        } else if (ride.status === "completed") {
          // Volta o app para a tela inicial e abre o rating como modal sobreposto.
          setRideState("rating");
          setDriverLocation(null);
          playPhaseSound("completed");
        } else if (ride.status === "cancelled") {
          // Aviso especial quando ninguém aceitou (auto-cancel do sistema/dispatch)
          const SYSTEM = "00000000-0000-0000-0000-000000000000";
          const noDriver =
            ride.cancel_reason_code === "no_drivers_available" ||
            ride.cancelled_by === SYSTEM;
          if (noDriver) {
            toast.error("Nenhum motorista por perto!", {
              description: "Tente novamente em alguns instantes.",
              duration: 6000,
            });
            playPhaseSound("cancelled");
          } else {
            playPhaseSound("cancelled");
          }
          setRideState("idle");
          setActiveRide(null);
          setDriverInfo(null);
          setPaymentMethod(null);
          setDriverLocation(null);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Realtime: posição GPS do motorista durante a corrida
  useEffect(() => {
    if (!activeRide?.driver_id || !["accepted", "in_progress"].includes(activeRide.status)) return;
    const driverId = activeRide.driver_id;

    // Fetch inicial
    supabase
      .from("driver_locations")
      .select("lat,lng,heading,category")
      .eq("driver_id", driverId)
      .maybeSingle()
      .then(({ data }) => {
        if (data)
          setDriverLocation({
            lat: Number(data.lat),
            lng: Number(data.lng),
            heading: data.heading ?? undefined,
            category: (data.category as any) ?? undefined,
          });
      });

    const channel = supabase
      .channel(`driver-rt-${driverId}`)
      // Posição GPS em tempo real
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` },
        (payload) => {
          const loc = payload.new as any;
          if (loc?.lat && loc?.lng)
            setDriverLocation({
              lat: Number(loc.lat),
              lng: Number(loc.lng),
              heading: loc.heading ?? undefined,
              category: loc.category ?? undefined,
            });
        }
      )
      // Dados do motorista (chave Pix, veículo, etc) em tempo real
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "drivers", filter: `user_id=eq.${driverId}` },
        (payload) => {
          const updated = payload.new as any;
          setDriverInfo((prev) => (prev ? { ...prev, ...updated } : prev));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRide?.driver_id, activeRide?.status]);

  // 💬 Auto-abre o chat ao receber a 1ª mensagem do motorista durante a corrida.
  // Escuta INSERTs em chat_messages da corrida ativa; se o remetente NÃO for o
  // próprio passageiro e o overlay estiver fechado, abre automaticamente.
  useEffect(() => {
    if (!user || !activeRide?.id) return;
    const ch = supabase
      .channel(`passenger-chat-autoopen-${activeRide.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `ride_id=eq.${activeRide.id}`,
        },
        (payload) => {
          const msg = payload.new as any;
          if (!msg || msg.sender_id === user.id) return;
          setShowChat((open) => (open ? open : true));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, activeRide?.id]);

  // ⏱️ Auto-cancelamento client-side de 20s para corridas sem motorista.
  // Rede de segurança caso o dispatch/cron demore — garante feedback imediato ao passageiro.
  useEffect(() => {
    if (rideState !== "searching" || !activeRide?.id || !activeRide?.created_at) return;
    const created = new Date(activeRide.created_at).getTime();
    const remaining = 20_000 - (Date.now() - created);
    if (remaining <= 0) return; // o realtime/cron vai cuidar
    const t = setTimeout(async () => {
      // Re-checa estado atual antes de cancelar (pode ter sido aceita)
      const { data: cur } = await supabase
        .from("rides").select("status").eq("id", activeRide.id).maybeSingle();
      if (!cur || cur.status !== "requested") return;
      await supabase.from("rides")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: "00000000-0000-0000-0000-000000000000",
          cancel_reason_code: "no_drivers_available",
          cancel_reason_note: "Nenhum motorista por perto.",
        })
        .eq("id", activeRide.id)
        .eq("status", "requested");
      // O realtime UPDATE vai cair no handler acima e já mostra
      // o toast "Nenhum motorista por perto!" + zera os estados.
      // Como fallback (caso o realtime atrase), também limpamos aqui.
      toast.error("Nenhum motorista por perto!", {
        description: "Tente novamente em alguns instantes.",
        duration: 6000,
      });
      setRideState("idle");
      setActiveRide(null);
      setDriverInfo(null);
      setPaymentMethod(null);
      setDriverLocation(null);
    }, remaining);
    return () => clearTimeout(t);
  }, [rideState, activeRide?.id, activeRide?.created_at]);

  // Motoristas online próximos no mapa (idle) — fetch inicial + realtime
  useEffect(() => {
    // Não mostra carrinhos genéricos enquanto há corrida ativa (já temos o motorista da corrida)
    if (activeRide) {
      setNearbyDrivers([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("driver_locations")
        .select("driver_id,lat,lng,heading,category,is_online,updated_at")
        .eq("is_online", true)
        .limit(50);
      if (cancelled || !data) return;
      // Considera "online de verdade" apenas quem atualizou nos últimos 2 minutos
      const cutoff = Date.now() - 2 * 60 * 1000;
      const fresh = data.filter((d) => new Date(d.updated_at as any).getTime() > cutoff);
      // Busca a cor real do veículo ativo de cada motorista para colorir os marcadores
      const ids = Array.from(new Set(fresh.map((d) => d.driver_id).filter(Boolean)));
      let colorMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: drvs } = await supabase
          .from("drivers")
          .select("user_id,vehicle_color")
          .in("user_id", ids as string[]);
        (drvs || []).forEach((d: any) => {
          if (d.vehicle_color) colorMap.set(d.user_id, d.vehicle_color);
        });
      }
      if (cancelled) return;
      setNearbyDrivers(
        fresh.map((d) => ({
          lat: Number(d.lat),
          lng: Number(d.lng),
          heading: (d.heading as any) ?? undefined,
          category: (d.category as any) ?? undefined,
          color: vehicleColorToHex(colorMap.get(d.driver_id as string) || null) || undefined,
        }))
      );
    };
    load();

    const channel = supabase
      .channel("nearby-drivers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        () => load()
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeRide]);

  const confirmedStops = selectedStops.filter((s): s is AppLocation => !!s);
  const effectiveStops = returnToOrigin && selectedOrigin && selectedDestination
    ? [...confirmedStops, selectedDestination]
    : confirmedStops;
  const effectiveDestination = returnToOrigin && selectedOrigin && selectedDestination
    ? selectedOrigin
    : selectedDestination;

  // Cálculo real de tarifa via Distance Matrix + tabela tariffs do banco
  const fare = useFareEstimate(
    selectedOrigin ? { lat: selectedOrigin.lat, lng: selectedOrigin.lng } : null,
    effectiveDestination ? { lat: effectiveDestination.lat, lng: effectiveDestination.lng } : null,
    selectedCategory as "moto" | "economico" | "conforto",
    passengers,
    effectiveStops.map((s) => ({ lat: s.lat, lng: s.lng }))
  );
  const estimatedPrice = fare.price;
  const estimatedTime = fare.durationMin;
  const estimatedDistance = fare.distanceKm;

  // ETA ao vivo: motorista → ponto de embarque (só durante driver_arriving)
  const liveEta = useLiveEta(
    driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : null,
    activeRide?.origin_lat && activeRide?.origin_lng
      ? { lat: Number(activeRide.origin_lat), lng: Number(activeRide.origin_lng) }
      : null,
    rideState === "driver_arriving"
  );

  // Open payment modal instead of directly requesting
  const handleOpenPayment = () => {
    if (!selectedOrigin || !selectedDestination) { toast.error("Selecione origem e destino"); return; }
    if (!user) { toast.error("Faça login para solicitar corridas"); return; }
    setRideState("payment");
  };

  // Request ride after payment method is selected
  const handleConfirmRide = async (method: PaymentMethod, coupon: AppliedCoupon | null) => {
    if (!selectedOrigin || !selectedDestination || !user) return;
    if (forOtherPerson && (!otherPerson.name.trim() || otherPerson.phone.replace(/\D/g, "").length < 10)) {
      toast.error("Informe nome e telefone do passageiro");
      return;
    }
    // 🔒 GUARD CRÍTICO: nunca grava sem fare estável.
    // Sem isso, race condition entre debounce e confirm pode salvar valores stale absurdos
    // (ex: distance_km=5816 quando o real é 1.9km). Recalculamos sempre a partir de fare.legs.
    if (fare.loading) {
      toast.error("Aguarde o cálculo da tarifa terminar");
      return;
    }
    if (!fare.legs || fare.legs.length === 0 || !fare.price || fare.price <= 0) {
      toast.error("Não foi possível calcular o valor. Tente novamente.");
      return;
    }
    setPaymentMethod(method);
    setRideState("idle"); // Close modal temporarily
    setIsRequesting(true);

    // ✅ FONTE ÚNICA DE VERDADE: derivamos tudo das legs (não dos campos top-level do hook)
    // Isso garante consistência mesmo se o hook ainda estiver com setState pendente.
    const distanceKm = Math.round(fare.legs.reduce((s, l) => s + l.km, 0) * 10) / 10;
    const durationMin = fare.legs.reduce((s, l) => s + l.min, 0);
    const basePrice = Math.round(fare.legs.reduce((s, l) => s + l.price, 0) * 100) / 100;
    const price = coupon ? Math.max(0, basePrice - coupon.discount) : basePrice;
    // Sanity check: distância e duração devem ser plausíveis (max 1000km / 24h)
    if (distanceKm > 1000 || durationMin > 1440) {
      setIsRequesting(false);
      toast.error("Distância calculada inválida. Recarregue a página.");
      console.error("[handleConfirmRide] sanity fail", { distanceKm, durationMin, legs: fare.legs });
      return;
    }
    // Taxa configurável: override por categoria (tariffs.fee_percent) ou global (platform_settings.global_fee_percent)
    const platformFee = await calcPlatformFee(price, selectedCategory as "moto" | "economico" | "conforto");

    // 🔍 AUDITORIA: nunca grava "Minha localização" no banco. Para o motorista/admin/backend
    // sempre persistimos o endereço real retornado pelo reverse geocode (GPS) ou pelo Google Places.
    // Se o passageiro deu um apelido (ex.: "Casa", "Trabalho"), preservamos como prefixo.
    const formatRideAddress = (loc: AppLocation) => {
      const isGenericGps =
        !loc.name ||
        loc.name === "Minha localização" ||
        loc.name.trim() === loc.address.trim();
      return isGenericGps ? loc.address : `${loc.name} - ${loc.address}`;
    };
    const { data, error } = await supabase.from("rides").insert({
      passenger_id: user.id,
      origin_address: formatRideAddress(selectedOrigin),
      origin_lat: selectedOrigin.lat, origin_lng: selectedOrigin.lng,
      destination_address: formatRideAddress(effectiveDestination),
      destination_lat: effectiveDestination.lat, destination_lng: effectiveDestination.lng,
      category: selectedCategory as "moto" | "economico" | "conforto",
      passenger_count: passengers, distance_km: distanceKm, duration_minutes: durationMin,
      price, platform_fee: platformFee, driver_net: price - platformFee,
      payment_method: method as any,
      stops: effectiveStops.length > 0
        ? effectiveStops.map((s) => ({
            name: s.name === "Minha localização" ? s.address : s.name,
            address: s.address,
            lat: s.lat,
            lng: s.lng,
          }))
        : null,
      legs: fare.legs.length > 0 ? fare.legs : [],
      origin_type: originType,
      for_other_person: forOtherPerson,
      other_person_name: forOtherPerson ? otherPerson.name.trim() : null,
      other_person_phone: forOtherPerson ? otherPerson.phone : null,
    } as any).select().single();

    setIsRequesting(false);
    if (error) {
      toast.error(guardErrorMessage(error, "Não foi possível solicitar a corrida"));
      return;
    }

    // Increment coupon usage (best-effort, non-blocking)
    if (coupon) {
      supabase.rpc("passenger_consume_coupon", { _coupon_id: coupon.id }).then(() => {});
    }

    setRideState("searching");
    setActiveRide(data);
    // Dispara o match em background (não bloqueia a UI)
    supabase.functions.invoke("dispatch-ride", {
      body: { rideId: data.id, preferredDriverId: preferredDriver?.id || null },
    })
      .catch((e) => console.warn("dispatch-ride invoke:", e));
    // Limpa motorista preferido após uso (vale só p/ esta corrida)
    setPreferredDriver(null);
    try { sessionStorage.removeItem("preferred_driver"); } catch {}
  };

  /** Limpa estado local após o backend confirmar o cancelamento (via RPC). */
  const handleAfterCancel = () => {
    setRideState("idle");
    setActiveRide(null);
    setDriverInfo(null);
    setPaymentMethod(null);
    setDriverLocation(null);
  };

  // ETAPA 1: calcula a "prévia" da troca de rota e abre o popup de confirmação.
  // Permitido APENAS com a corrida em andamento (in_progress).
  const handlePreviewChangeDestination = async () => {
    if (!activeRide || !newDestination) return;
    if (activeRide.status !== "in_progress") {
      toast.error("Só é possível alterar o destino com a corrida em andamento");
      return;
    }
    // Origem do recálculo = posição atual do motorista (se disponível) ou origem original
    // 🔒 GUARD CRÍTICO: nunca use 0,0 como origem — gera "rotas" de milhares de km até o Brasil.
    const candLat = driverLocation?.lat ?? (activeRide.origin_lat != null ? Number(activeRide.origin_lat) : NaN);
    const candLng = driverLocation?.lng ?? (activeRide.origin_lng != null ? Number(activeRide.origin_lng) : NaN);
    const fromLat = Number.isFinite(candLat) && candLat !== 0 ? candLat : NaN;
    const fromLng = Number.isFinite(candLng) && candLng !== 0 ? candLng : NaN;
    if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng)) {
      toast.error("Não foi possível obter a posição atual. Tente novamente em instantes.");
      return;
    }
    if (!Number.isFinite(newDestination.lat) || !Number.isFinite(newDestination.lng) || newDestination.lat === 0 || newDestination.lng === 0) {
      toast.error("Destino inválido. Selecione novamente.");
      return;
    }

    setPreviewLoading(true);

    const haversine = (aLat: number, aLng: number, bLat: number, bLng: number) => {
      const R = 6371;
      const dLat = ((bLat - aLat) * Math.PI) / 180;
      const dLng = ((bLng - aLng) * Math.PI) / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    };
    const g = (window as any).google;
    const dmDistance = async (a: { lat: number; lng: number }, b: { lat: number; lng: number }): Promise<{ km: number; min: number }> => {
      if (g?.maps?.DistanceMatrixService) {
        try {
          const svc = new g.maps.DistanceMatrixService();
          const res: any = await new Promise((resolve, reject) => {
            svc.getDistanceMatrix(
              { origins: [a], destinations: [b], travelMode: g.maps.TravelMode.DRIVING, unitSystem: g.maps.UnitSystem.METRIC },
              (r: any, st: string) => (st === "OK" ? resolve(r) : reject(new Error(st)))
            );
          });
          const elem = res?.rows?.[0]?.elements?.[0];
          if (elem?.status === "OK") {
            return { km: Math.round((elem.distance.value / 1000) * 10) / 10, min: Math.round(elem.duration.value / 60) };
          }
        } catch { /* fallback */ }
      }
      const k = Math.round(haversine(a.lat, a.lng, b.lat, b.lng) * 10) / 10;
      return { km: k, min: Math.max(2, Math.round(k * 2.5)) };
    };

    // (A) Deslocamento JÁ realizado: origem da corrida → posição atual do motorista
    const originLat = Number(activeRide.origin_lat);
    const originLng = Number(activeRide.origin_lng);
    let drivenKm = 0;
    let drivenMin = 0;
    if (Number.isFinite(originLat) && Number.isFinite(originLng) && originLat !== 0 && originLng !== 0) {
      const r = await dmDistance({ lat: originLat, lng: originLng }, { lat: fromLat, lng: fromLng });
      drivenKm = r.km;
      drivenMin = r.min;
    }

    // (B) Novo trecho: posição atual → novo destino
    const newLeg = await dmDistance({ lat: fromLat, lng: fromLng }, { lat: newDestination.lat, lng: newDestination.lng });
    const km = newLeg.km;
    const min = newLeg.min;

    const totalKm = Math.round((drivenKm + km) * 10) / 10;
    const totalMin = drivenMin + min;

    if (totalKm > 1000 || totalMin > 1440 || km > 500) {
      setPreviewLoading(false);
      console.error("[preview] sanity fail", { fromLat, fromLng, newDestination, km, min, totalKm, totalMin });
      toast.error("Distância recalculada inválida. Verifique o destino e tente novamente.");
      return;
    }

    // (C) Preço total via tariffs (mesma fórmula do useFareEstimate)
    const { data: tariff } = await supabase
      .from("tariffs")
      .select("base_fare,per_km,per_minute,min_fare,region_multiplier,passenger_extra")
      .eq("category", activeRide.category)
      .eq("region", "default")
      .maybeSingle();
    const t = tariff || { base_fare: 5, per_km: 1.8, per_minute: 0.45, min_fare: 12, region_multiplier: 1, passenger_extra: 2 };
    const base = (t.base_fare + t.per_km * totalKm + t.per_minute * totalMin) * t.region_multiplier;
    const extras = Math.max(0, Math.min(activeRide.passenger_count || 1, 4) - 1) * (t.passenger_extra > 0 ? t.passenger_extra : 3) * totalKm;
    const newPrice = Math.round(Math.max(base + extras, t.min_fare) * 100) / 100;
    const newFee = await calcPlatformFee(newPrice, activeRide.category);

    // Rateio proporcional do preço entre o já percorrido e o novo trecho
    const safeTotal = Math.max(totalKm, 0.1);
    const drivenPrice = Math.round(newPrice * (drivenKm / safeTotal) * 100) / 100;
    const newLegPrice = Math.round((newPrice - drivenPrice) * 100) / 100;
    const newLegs = [
      { fromIndex: 0, toIndex: 1, km: drivenKm, min: drivenMin, price: drivenPrice },
      { fromIndex: 1, toIndex: 2, km, min, price: newLegPrice },
    ];

    setRoutePreview({
      drivenKm,
      drivenPrice,
      newLegKm: km,
      newLegMin: min,
      newLegPrice,
      totalKm,
      totalMin,
      totalPrice: newPrice,
      totalFee: newFee,
      newLegs,
    });
    setPreviewLoading(false);
  };

  // ETAPA 2: passageiro confirmou — grava no banco; o motorista recebe via realtime UPDATE.
  const handleConfirmChangeDestination = async () => {
    if (!activeRide || !newDestination || !routePreview) return;
    const { totalKm, totalMin, totalPrice, totalFee, newLegs } = routePreview;

    // Snapshot dos valores ANTERIORES para auditoria
    const prevSnapshot = {
      destination_address: activeRide.destination_address as string | null,
      destination_lat: activeRide.destination_lat as number | null,
      destination_lng: activeRide.destination_lng as number | null,
      distance_km: Number(activeRide.distance_km || 0),
      price: Number(activeRide.price || 0),
    };

    const { error } = await supabase
      .from("rides")
      .update({
        destination_address: `${newDestination.name} - ${newDestination.address}`,
        destination_lat: newDestination.lat,
        destination_lng: newDestination.lng,
        distance_km: totalKm,
        duration_minutes: totalMin,
        price: totalPrice,
        platform_fee: totalFee,
        driver_net: totalPrice - totalFee,
        legs: newLegs,
      })
      .eq("id", activeRide.id);
    if (error) {
      toast.error("Erro ao alterar destino: " + error.message);
      return;
    }
    // 📋 Auditoria: registra a alteração de rota (visível ao passageiro, motorista e admin)
    if (user) {
      const newAddrFull = `${newDestination.name} - ${newDestination.address}`;
      supabase.from("ride_route_changes").insert({
        ride_id: activeRide.id,
        changed_by: user.id,
        changed_by_role: "passenger",
        previous_destination_address: prevSnapshot.destination_address,
        previous_destination_lat: prevSnapshot.destination_lat,
        previous_destination_lng: prevSnapshot.destination_lng,
        previous_distance_km: prevSnapshot.distance_km,
        previous_price: prevSnapshot.price,
        new_destination_address: newAddrFull,
        new_destination_lat: newDestination.lat,
        new_destination_lng: newDestination.lng,
        new_distance_km: totalKm,
        new_price: totalPrice,
        driven_km: routePreview.drivenKm,
        driven_price: routePreview.drivenPrice,
        new_leg_km: routePreview.newLegKm,
        new_leg_price: routePreview.newLegPrice,
        details: { totalMin, totalFee, legs: newLegs },
      }).then(({ error: auditErr }) => {
        if (auditErr) console.error("[audit route change]", auditErr);
      });
    }
    setActiveRide((r: any) => ({
      ...r,
      destination_address: `${newDestination.name} - ${newDestination.address}`,
      destination_lat: newDestination.lat,
      destination_lng: newDestination.lng,
      distance_km: totalKm,
      duration_minutes: totalMin,
      price: totalPrice,
      platform_fee: totalFee,
      driver_net: totalPrice - totalFee,
      legs: newLegs,
    }));
    setSelectedDestination(newDestination);
    setShowChangeDest(false);
    setNewDestination(null);
    setRoutePreview(null);
    toast.success("✅ Rota atualizada!", {
      description: `Novo destino: ${newDestination.name}\nNovo valor: R$ ${totalPrice.toFixed(2)} (${totalKm} km)`,
      duration: 8000,
    });
    // 🔔 Notifica o motorista (toca som + aparece no sino + funciona em qualquer tela)
    if (activeRide.driver_id) {
      const prevAddr = String(prevSnapshot.destination_address || "").split(" - ")[0] || "—";
      const newAddrShort = newDestination.name;
      const prevPrice = Number(prevSnapshot.price || 0);
      const prevKm = Number(prevSnapshot.distance_km || 0);
      const deltaPrice = totalPrice - prevPrice;
      const deltaKm = totalKm - prevKm;
      supabase.from("notifications").insert({
        user_id: activeRide.driver_id,
        type: "ride_status",
        title: "🚨 Passageiro alterou a rota!",
        message: `${prevAddr} → ${newAddrShort} • R$ ${totalPrice.toFixed(2)} (${deltaPrice >= 0 ? "+" : ""}R$ ${deltaPrice.toFixed(2)})`,
        link: "/driver",
        data: {
          ride_id: activeRide.id,
          event: "route_changed",
          previous_destination: prevAddr,
          new_destination: newAddrShort,
          previous_price: prevPrice,
          new_price: totalPrice,
          previous_km: prevKm,
          new_km: totalKm,
          delta_price: deltaPrice,
          delta_km: deltaKm,
        },
      }).then(({ error: notifErr }) => {
        if (notifErr) console.error("[notify driver route change]", notifErr);
      });
    }
  };

  const handleSubmitRating = async () => {
    if (!activeRide || rating === 0) return;
    // Marca antes do update para que o eco do realtime não reabra o modal.
    finalizedRideIdsRef.current.add(activeRide.id);
    const { error } = await supabase
      .from("rides")
      .update({ rating, rating_comment: ratingComment?.trim() || null } as any)
      .eq("id", activeRide.id);
    if (error) {
      finalizedRideIdsRef.current.delete(activeRide.id);
      toast.error("Não foi possível salvar a avaliação. Tente novamente.");
      return;
    }
    resetRide();
  };

  // Quando o modal de rating abre, verifica se o motorista já é favorito
  useEffect(() => {
    if (rideState !== "rating" || !activeRide?.driver_id || !user?.id) {
      setFavoriteDriver(false);
      return;
    }
    supabase
      .from("favorite_drivers")
      .select("id")
      .eq("passenger_id", user.id)
      .eq("driver_id", activeRide.driver_id)
      .maybeSingle()
      .then(({ data }) => setFavoriteDriver(!!data));
  }, [rideState, activeRide?.driver_id, user?.id]);

  // Fallback: se entrar em "rating" sem driverInfo carregado (ex: refresh durante rating),
  // busca os dados do motorista para garantir que o botão de favoritar e o nome apareçam.
  useEffect(() => {
    if (rideState !== "rating" || !activeRide?.driver_id || driverInfo) return;
    let cancelled = false;
    (async () => {
      const [{ data: driver }, { data: driverProfile }] = await Promise.all([
        supabase.from("drivers").select("*").eq("user_id", activeRide.driver_id).maybeSingle(),
        supabase.from("profiles").select("*").eq("user_id", activeRide.driver_id).maybeSingle(),
      ]);
      if (!cancelled && driver && driverProfile) {
        setDriverInfo({ ...driver, profile: driverProfile });
      }
    })();
    return () => { cancelled = true; };
  }, [rideState, activeRide?.driver_id, driverInfo]);

  const toggleFavoriteDriver = async () => {
    if (!activeRide?.driver_id || favoritingDriver) return;
    setFavoritingDriver(true);
    const { data, error } = await supabase.rpc("passenger_toggle_favorite_driver", {
      _driver_id: activeRide.driver_id,
    });
    setFavoritingDriver(false);
    if (error) {
      console.error("[favorite] rpc error:", error, "driver_id:", activeRide.driver_id);
      return;
    }
    const isFav = !!data;
    setFavoriteDriver(isFav);
  };

  const resetRide = () => {
    // Marca como finalizada para que UPDATEs em atraso não reabram o modal de rating
    if (activeRide?.id) finalizedRideIdsRef.current.add(activeRide.id);
    setRideState("idle"); setActiveRide(null); setRating(0); setRatingComment("");
    setFavoriteDriver(false);
    setSelectedOrigin(null); setSelectedDestination(null); setSelectedStops([]);
    setDriverInfo(null); setPaymentMethod(null);
    setForOtherPerson(false); setOtherPerson({ name: "", phone: "" }); setOriginType("gps"); setReturnToOrigin(false);
    setShowPixModal(false);
  };

  const isRideActive = ["searching", "accepted", "driver_arriving", "arrived", "in_progress"].includes(rideState);
  const activeRideStops = activeRide ? getRideStops(activeRide) : [];

  // Chat overlay
  if (showChat && activeRide) {
    return (
      <RideChat
        rideId={activeRide.id}
        driverName={driverInfo?.profile?.full_name}
        onBack={() => setShowChat(false)}
      />
    );
  }

  // Layout:
  // - idle (sem form aberto): mapa ocupa a tela inteira + 1 botão "Para onde Vamoo?" no rodapé.
  // - idle (form aberto): form aparece como sheet no topo, mapa fica visível embaixo.
  // - corrida ativa: mapa em 68vh + bottom-sheet com infos da corrida.
  // - rating: a UI volta para o estado "idle" (mapa cheio) e abre Dialog modal de avaliação.
  const showFullMap = (rideState === "idle" || rideState === "rating") && !showRideForm;
  const showFormSheet = rideState === "idle" && showRideForm;

  return (
    <div className="min-h-screen bg-background">
      {/* Mapa em tela cheia em TODAS as fases (idle, form aberto, corrida ativa, rating).
          O bottom-sheet flutua sobre o mapa em vez de empurrá-lo.
          Usamos `top/right/bottom/left: 0` com `margin negativo das safe-areas`
          para que o mapa preencha 100% do viewport real (edge-to-edge),
          já que o #root aplica padding com env(safe-area-inset-*). */}
      <div
        className="fixed z-0"
        style={{
          top: "calc(env(safe-area-inset-top) * -1)",
          bottom: "calc(env(safe-area-inset-bottom) * -1)",
          left: "calc(env(safe-area-inset-left) * -1)",
          right: "calc(env(safe-area-inset-right) * -1)",
        }}
      >
        {(() => {
          // Define origem/destino da rota conforme a fase:
          //  - driver_arriving: rota motorista → embarque (mostra deslocamento dele em tempo real)
          //  - in_progress:    rota embarque → paradas → destino (acompanha trajeto completo)
          //  - demais (idle/searching/arrived/rating): comportamento padrão (origem/destino selecionados)
          let mapOrigin = selectedOrigin ? { lat: selectedOrigin.lat, lng: selectedOrigin.lng, label: selectedOrigin.name } : null;
          let mapDestination = effectiveDestination ? { lat: effectiveDestination.lat, lng: effectiveDestination.lng, label: effectiveDestination.name } : null;
          if (rideState === "driver_arriving" && driverLocation && activeRide?.origin_lat && activeRide?.origin_lng) {
            mapOrigin = { lat: driverLocation.lat, lng: driverLocation.lng, label: "Motorista" };
            mapDestination = { lat: Number(activeRide.origin_lat), lng: Number(activeRide.origin_lng), label: "Embarque" };
          } else if (rideState === "in_progress" && activeRide?.origin_lat && activeRide?.destination_lat) {
            mapOrigin = { lat: Number(activeRide.origin_lat), lng: Number(activeRide.origin_lng), label: "Embarque" };
            mapDestination = { lat: Number(activeRide.destination_lat), lng: Number(activeRide.destination_lng), label: "Destino" };
          }
          // Calcula a altura aproximada (em px) do que está sobreposto ao mapa,
          // para que o logo "Google" e o botão de recentralizar subam JUNTO com qualquer CTA/sheet.
          let dynamicInset = 24; // respiro mínimo
          if (showFullMap) {
            // CTA "Para onde Vamoo?" + bottom nav
            dynamicInset = 122;
          } else if (showFormSheet) {
            // Sheet do formulário cobre boa parte da tela; logo Google logo acima
            dynamicInset = 8;
          } else if (isRideActive) {
            if (rideState === "accepted") dynamicInset = 240;
            else if (rideState === "arrived") dynamicInset = 220;
            else if (rideState === "in_progress") dynamicInset = 200;
            else if (rideState === "payment") dynamicInset = 220;
            else dynamicInset = 180;
          }
          const mapStops = activeRide && rideState === "in_progress"
            ? activeRideStops.map((s) => ({ lat: s.lat, lng: s.lng, label: s.label }))
            : effectiveStops.map((s) => ({ lat: s.lat, lng: s.lng, label: s.name }));
          return (
            <GoogleMap
              className="h-full w-full rounded-none"
              origin={mapOrigin}
              destination={mapDestination}
              stops={mapStops}
              driverLocation={driverLocation ? {
                ...driverLocation,
                label: "Motorista",
                // Cor real do veículo do motorista aceito (sobrescreve o padrão da categoria)
                color: vehicleColorToHex(driverInfo?.vehicle_color) || undefined,
              } : null}
              nearbyDrivers={nearbyDrivers}
              trackUserLocation={!selectedOrigin && !activeRide}
              showRoute={!!mapOrigin && !!mapDestination}
              bottomInset={dynamicInset}
              // Abertura do app: zoom ~6 quadras (≈600m) sobre a localização do dispositivo.
              initialUserZoom={16}
              // Botão de recentralizar 3mm (~11px) acima do CTA "Para onde Vamoo?".
              // CTA: padding-bottom safe-area + 28px + altura do botão (~56px) ≈ safe-area + 84px.
              recenterBottomPx={showFullMap ? 95 : 24}
            />
          );
        })()}
      </div>

      {/* Bottom sheet — flutua sobre o mapa em vez de ficar abaixo dele */}
      {!showFullMap && (
      <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl bg-card shadow-2xl animate-slide-up pb-24 max-h-[80vh] overflow-y-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        {/* Header com botão fechar quando o form de pedido estiver aberto */}
        {showFormSheet && (
          <div className="flex items-center justify-between px-4 pt-2">
            <h2 className="text-base font-bold font-display">Para onde Vamoo?</h2>
            <button
              onClick={() => setShowRideForm(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/70 transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {showFormSheet && preferredDriver && (
          <div className="mx-4 mt-2 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3">
            {preferredDriver.photo ? (
              <img
                src={preferredDriver.photo}
                alt={preferredDriver.name}
                className="h-10 w-10 rounded-full object-cover border border-primary/30"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                {preferredDriver.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Chamando seu motorista favorito
              </p>
              <p className="text-sm font-bold truncate">{preferredDriver.name}</p>
              <p className="text-[10px] text-muted-foreground">
                Ele terá 20s para aceitar antes de abrir para outros motoristas.
              </p>
            </div>
            <button
              onClick={() => {
                setPreferredDriver(null);
                try { sessionStorage.removeItem("preferred_driver"); } catch {}
              }}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Remover motorista preferido"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-4 pb-3 space-y-4">


          {/* Estado "completed" e "rating" agora usam Dialog (renderizado fora deste sheet)
              para que o app volte direto à tela inicial após a corrida finalizar. */}

          {/* Active ride overlays */}
          {isRideActive && activeRide && (
            <div className="space-y-4 animate-fade-in">
              {/* Título da fase atual da viagem — ajuda o passageiro a saber onde está no fluxo */}
              <div className="text-center -mt-1">
                <h2 className="text-lg font-bold font-display">
                  {rideState === "searching" && "Buscando motorista"}
                  {rideState === "accepted" && "Corrida aceita"}
                  {rideState === "driver_arriving" && `Motorista a caminho para: ${activeRide.origin_address?.split(" - ")[0] || "embarque"}`}
                  {rideState === "arrived" && `Motorista chegou em: ${activeRide.origin_address?.split(" - ")[0] || "embarque"}`}
                  {rideState === "in_progress" && (() => {
                    // Mostra a próxima parada, se houver, ou o destino final.
                    const stops = getRideStops(activeRide);
                    const next = stops[0] || getRideDestination(activeRide);
                    const addr = next?.address?.split(" - ")[0]
                      || next?.label
                      || activeRide.destination_address?.split(" - ")[0]
                      || "destino";
                    return `A caminho para: ${addr}`;
                  })()}
                </h2>
              </div>

              {/* Searching animation */}
              {rideState === "searching" && (
                <div className="text-center py-6">
                  <div className="relative mx-auto h-20 w-20 mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
                    <div className="absolute inset-2 rounded-full border-4 border-primary/40 animate-ping" style={{ animationDelay: "0.3s" }} />
                    <div className="absolute inset-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <Car className="h-8 w-8 text-primary animate-pulse" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Aguarde, estamos encontrando o melhor motorista para você</p>
                  {paymentMethod && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Banknote className="h-3.5 w-3.5" /> {paymentLabels[paymentMethod]}
                    </div>
                  )}
                </div>
              )}

              {/* Driver info */}
              {driverInfo && rideState !== "searching" && (
                <div className="rounded-2xl border-2 border-primary bg-card p-4 shadow-glow space-y-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={driverInfo.profile?.selfie_url || driverInfo.profile?.selfie_signup_url}
                      name={driverInfo.profile?.full_name || "Motorista"}
                      role="driver"
                      size="lg"
                    />
                    <div className="flex-1">
                      <p className="text-lg font-extrabold text-primary">{driverInfo.profile?.full_name || "Motorista"}</p>
                      <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                        <Star className="h-4 w-4 text-warning fill-warning" />
                        <span>{driverInfo.rating?.toFixed(1) || "5.0"}</span>
                        <span>•</span>
                        <span>{driverInfo.total_rides || 0} corridas</span>
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground mt-0.5">
                        {driverInfo.vehicle_model} • {driverInfo.vehicle_color} • {driverInfo.vehicle_plate}
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className={`rounded-xl p-3 text-center text-sm font-semibold ${
                    rideState === "driver_arriving" ? "bg-info/10 text-info" :
                    rideState === "arrived" ? "bg-success/10 text-success" :
                    "bg-primary/10 text-primary"
                  }`}>
                    {rideState === "driver_arriving" && (
                      <div className="space-y-0.5">
                        <p>🚗 A caminho de: {activeRide.origin_address?.split(" - ")[0] || "embarque"}</p>
                        {liveEta && (
                          <p className="text-xs font-medium opacity-80">
                            Chega em ~{liveEta.minutes} min • {liveEta.km} km
                          </p>
                        )}
                      </div>
                    )}
                    {rideState === "arrived" && `📍 Chegou em: ${activeRide.origin_address?.split(" - ")[0] || "embarque"}`}
                    {rideState === "in_progress" && (() => {
                      const stops = getRideStops(activeRide);
                      const next = stops[0] || getRideDestination(activeRide);
                      const addr = next?.address?.split(" - ")[0]
                        || next?.label
                        || activeRide.destination_address?.split(" - ")[0]
                        || "destino";
                      return `🛣️ A caminho para: ${addr}`;
                    })()}
                  </div>

                  {activeRide?.ride_code && (
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Chave da corrida</span>
                      <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{activeRide.ride_code}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Route info */}
              <div className="rounded-xl border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-success" />
                  <p className="text-sm truncate">{activeRide.origin_address?.split(" - ")[0]}</p>
                </div>
                {activeRideStops.map((stop, index) => (
                  <div key={`${stop.lat}-${stop.lng}-${index}`}>
                    <div className="ml-1 h-2.5 border-l border-dashed border-muted-foreground/30" />
                    <div className="flex items-start gap-2">
                      <div className="mt-1 h-4 w-4 rounded-full bg-warning text-[9px] font-bold text-warning-foreground flex items-center justify-center shrink-0">
                        {index + 1}
                      </div>
                      <p className="text-sm truncate">{stop.label}</p>
                    </div>
                  </div>
                ))}
                <div className="ml-1 h-2.5 border-l border-dashed border-muted-foreground/30" />
                <div className="flex items-start gap-2">
                  <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-destructive" />
                  <p className="text-sm truncate">{activeRide.destination_address?.split(" - ")[0]}</p>
                </div>
              </div>

              {/* Ride stats in progress */}
              {rideState === "in_progress" && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">Distância</p>
                    <p className="text-sm font-bold">{activeRide.distance_km} km</p>
                  </div>
                  <div className="rounded-xl border p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">Tempo</p>
                    <p className="text-sm font-bold">~{activeRide.duration_minutes} min</p>
                  </div>
                  <div className="rounded-xl border p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">Valor</p>
                    <p className="text-sm font-bold text-primary">R$ {activeRide.price?.toFixed(2)}</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {rideState !== "searching" && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowChat(true)}
                    className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold hover:bg-muted transition-colors">
                    <MessageCircle className="h-4 w-4 text-primary" /> Chat
                  </button>
                  <button className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold hover:bg-muted transition-colors">
                    <Phone className="h-4 w-4 text-primary" /> Ligar
                  </button>
                </div>
              )}

              {/* Aviso: rota congelada antes de iniciar */}
              {(rideState === "accepted" || rideState === "driver_arriving" || rideState === "arrived") && (
                <p className="text-[11px] text-center text-muted-foreground bg-muted/50 rounded-lg py-2 px-3">
                  🔒 A rota fica bloqueada até o motorista iniciar a corrida. Você poderá alterar o destino após o início.
                </p>
              )}

              {/* Alterar destino — só com corrida em andamento */}
              {rideState === "in_progress" && (
                <>
                  {!showChangeDest ? (
                    <button
                      onClick={() => {
                        setShowChangeDest(true);
                        setNewDestination(selectedDestination);
                      }}
                      className="w-full rounded-xl border-2 border-dashed border-primary/40 py-3 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                    >
                      <Navigation className="h-4 w-4" /> Alterar destino
                    </button>
                  ) : (
                    <div className="rounded-xl border-2 border-primary p-3 space-y-3 bg-primary/5">
                      <p className="text-xs font-semibold text-primary">Novo destino</p>
                      <AddressAutocompleteField
                        label=""
                        placeholder="Para onde mudar?"
                        value={newDestination ? placeDetailsFromAppLocation(newDestination) : null}
                        onChange={(place) => {
                          setNewDestination(place ? appLocationFromPlaceDetails(place) : null);
                          setRoutePreview(null);
                        }}
                      />

                      {/* Prévia da nova rota — exibida após "Calcular novo valor".
                          Detalhamento exigido pelo produto: km/R$ já percorridos pelo motorista
                          + km/R$ do novo trecho a partir da posição atual + total. */}
                      {routePreview && (
                        <div className="rounded-lg border border-primary/30 bg-background p-2.5 space-y-2 text-xs">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            Resumo da nova rota
                          </p>
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex items-start gap-2 flex-1 min-w-0">
                              <span className="mt-1 h-2 w-2 rounded-full bg-success shrink-0" />
                              <span className="min-w-0">
                                <span className="block font-semibold">Já percorrido pelo motorista</span>
                                <span className="block text-muted-foreground">{routePreview.drivenKm} km</span>
                              </span>
                            </span>
                            <span className="font-bold text-foreground whitespace-nowrap">R$ {routePreview.drivenPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex items-start gap-2 flex-1 min-w-0">
                              <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                              <span className="min-w-0">
                                <span className="block font-semibold truncate">Novo trecho até {newDestination?.name || "destino"}</span>
                                <span className="block text-muted-foreground">{routePreview.newLegKm} km • ~{routePreview.newLegMin} min</span>
                              </span>
                            </span>
                            <span className="font-bold text-foreground whitespace-nowrap">R$ {routePreview.newLegPrice.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-primary/20 pt-2 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-primary">Total a pagar</p>
                              <p className="text-[10px] text-muted-foreground">{routePreview.totalKm} km • ~{routePreview.totalMin} min</p>
                            </div>
                            <span className="text-lg font-extrabold text-primary">R$ {routePreview.totalPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setShowChangeDest(false); setNewDestination(null); setRoutePreview(null); }}
                          className="rounded-xl border py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
                        >
                          Cancelar
                        </button>
                        {!routePreview ? (
                          <button
                            onClick={handlePreviewChangeDestination}
                            disabled={!newDestination || previewLoading}
                            className="rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-40"
                          >
                            {previewLoading ? "Calculando..." : "Calcular novo valor"}
                          </button>
                        ) : (
                          <button
                            onClick={handleConfirmChangeDestination}
                            className="rounded-xl bg-success py-2.5 text-sm font-bold text-success-foreground shadow-glow"
                          >
                            Confirmar e avisar motorista
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {rideState === "searching" && (
                <button onClick={() => setShowCancelDialog(true)}
                  className="w-full rounded-xl border border-destructive/30 py-3.5 text-sm font-bold text-destructive hover:bg-destructive/5 transition-colors">
                  Cancelar busca
                </button>
              )}

              {/* Após aceite e antes do início — cancelamento ainda é permitido (passível de punição) */}
              {(rideState === "accepted" || rideState === "driver_arriving" || rideState === "arrived") && (
                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="w-full rounded-xl border border-destructive/30 py-3 text-xs font-bold text-destructive hover:bg-destructive/5 transition-colors"
                >
                  Cancelar corrida
                </button>
              )}
            </div>
          )}

          {/* Normal idle form */}
          {rideState === "idle" && (
            <>
              {/* Smart Origin Picker (GPS / Manual / Other person) */}
              <OriginPicker
                selectedOrigin={selectedOrigin}
                onSelectOrigin={(loc, type) => {
                  setSelectedOrigin(loc);
                  setOriginType(type);
                }}
                forOtherPerson={forOtherPerson}
                onToggleOtherPerson={setForOtherPerson}
                otherPerson={otherPerson}
                onChangeOtherPerson={setOtherPerson}
              />

              {/* Destination input */}
              <div className="space-y-2">
                <AddressAutocompleteField
                  label="Destino"
                  placeholder="Para onde vai?"
                  value={selectedDestination ? placeDetailsFromAppLocation(selectedDestination) : null}
                  onChange={(place) => setSelectedDestination(place ? appLocationFromPlaceDetails(place) : null)}
                />
                {selectedStops.map((stop, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-muted p-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-warning" />
                    <div className="flex-1">
                      <AddressAutocompleteField
                        label={`Parada ${i + 1}`}
                        placeholder={`Digite a parada ${i + 1}`}
                        value={stop ? placeDetailsFromAppLocation(stop) : null}
                        onChange={(place: PlaceDetails | null) => {
                          setSelectedStops((prev) => {
                            const next = [...prev];
                            next[i] = place ? appLocationFromPlaceDetails(place) : null;
                            return next;
                          });
                        }}
                      />
                    </div>
                    <button onClick={() => {
                      setSelectedStops(selectedStops.filter((_, j) => j !== i));
                    }}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      if (returnToOrigin) {
                        toast.error("Desative o retorno para adicionar mais paradas");
                        return;
                      }
                      setSelectedStops([...selectedStops, null]);
                    }}
                    disabled={returnToOrigin}
                    className="flex items-center gap-2 text-xs font-medium text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar parada
                  </button>
                  {selectedOrigin && selectedDestination && (
                    <button
                      onClick={() => {
                        setReturnToOrigin((prev) => {
                          const next = !prev;
                          toast.success(next ? "Retorno à origem ativado (última perna)" : "Retorno à origem removido");
                          return next;
                        });
                      }}
                      className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 transition-colors ${
                        returnToOrigin
                          ? "bg-success/15 text-success ring-1 ring-success/30"
                          : "text-success bg-success/10 hover:bg-success/15"
                      }`}
                      title="Adiciona somente UMA volta ao ponto de embarque, sempre como última perna"
                    >
                      <Navigation className="h-3 w-3" /> {returnToOrigin ? "Remover retorno" : "Voltar à origem"}
                    </button>
                  )}
                </div>
                {returnToOrigin && (
                  <p className="text-[11px] text-muted-foreground px-1">
                    O retorno é cobrado como última perna da rota. Para adicionar paradas extras, remova o retorno.
                  </p>
                )}
              </div>

              {/* Passengers — oculto quando for moto (sempre 1) */}
              {selectedCategory !== "moto" && (() => {
                const maxPax = 4;
                const atMax = passengers >= maxPax;
                return (
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Passageiros</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPassengers(Math.max(1, passengers - 1))}
                        disabled={passengers <= 1}
                        className="flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-sm font-bold">{passengers}</span>
                      <button
                        onClick={() => setPassengers(Math.min(maxPax, passengers + 1))}
                        disabled={atMax}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Category selector */}
              <div className="flex gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      // Moto comporta apenas 1 passageiro
                      if (cat.id === "moto" && passengers > 1) {
                        setPassengers(1);
                        toast.info("Moto comporta apenas 1 passageiro");
                      }
                    }}
                    className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                      selectedCategory === cat.id ? "border-primary bg-primary/5 shadow-glow" : "border-transparent bg-muted hover:border-border"
                    }`}
                  >
                    <cat.icon className={`h-6 w-6 ${selectedCategory === cat.id ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs font-semibold">{cat.label}</span>
                    <span className="text-[10px] text-muted-foreground">{cat.desc}</span>
                  </button>
                ))}
              </div>

              {/* Estimate */}
              {estimatedPrice != null && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Valor estimado</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Navigation className="h-3 w-3" /> {estimatedDistance} km • ~{estimatedTime} min</span>
                        {confirmedStops.length > 0 && (
                          <span className="rounded-full bg-warning/15 text-warning px-2 py-0.5 font-semibold">
                            +{confirmedStops.length} parada{confirmedStops.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {returnToOrigin && (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 font-semibold text-success">
                            ida e volta
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xl font-extrabold text-primary">R$ {estimatedPrice.toFixed(2)}</span>
                  </div>

                  {/* Breakdown por trecho */}
                  {fare.legs.length > 1 && (() => {
                    // Usa endereço real em vez de "Minha localização"; mostra nome só se for lugar salvo (Casa, Trabalho, etc.)
                    const displayLabel = (loc: AppLocation | null | undefined, fallback: string) => {
                      if (!loc) return fallback;
                      const isGeneric = !loc.name || loc.name === "Minha localização" || loc.name === loc.address;
                      if (isGeneric) return loc.address || fallback;
                      // Nome customizado ("Casa") + endereço resumido entre parênteses
                      const shortAddr = loc.address?.split(",").slice(0, 2).join(",").trim();
                      return shortAddr ? `${loc.name} (${shortAddr})` : loc.name;
                    };
                    const originLabel = displayLabel(selectedOrigin, "Origem");
                    const labels: string[] = [
                      originLabel,
                      ...effectiveStops.map((s, i) =>
                        returnToOrigin && i === effectiveStops.length - 1
                          ? `Retorno: ${originLabel}`
                          : displayLabel(s as AppLocation, `Parada ${i + 1}`)
                      ),
                      displayLabel(effectiveDestination, "Destino"),
                    ];
                    return (
                      <div className="border-t border-primary/10 pt-2 space-y-1.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Trechos</p>
                        {fare.legs.map((leg, i) => (
                          <div key={i} className="flex items-center justify-between text-xs gap-2">
                            <span className="flex items-start gap-2 truncate flex-1">
                              <span
                                className="mt-1 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background"
                                style={{ backgroundColor: LEG_COLORS[i % LEG_COLORS.length] }}
                                aria-label={`Cor do trecho ${i + 1}`}
                              />
                              <span className="truncate">
                                <span className="font-semibold text-foreground">{i + 1}.</span>{" "}
                                <span className="text-muted-foreground">{labels[leg.fromIndex]} → {labels[leg.toIndex]}</span>
                                <span className="text-muted-foreground/70"> • {leg.km} km</span>
                              </span>
                            </span>
                            <span className="font-bold text-primary whitespace-nowrap">R$ {leg.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

            </>
          )}
        </div>
      </div>
      )}

      {/* CTA fixo "Para onde Vamoo?" / "Vamoo!" — só aparece em idle, respeitando safe-area */}
      {rideState === "idle" && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pt-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem + 12px)" }}
        >
          {!showRideForm ? (
            // Estado inicial: 1 botão único, mapa ocupando a tela toda
            <button
              onClick={() => setShowRideForm(true)}
              className="w-full rounded-2xl bg-gradient-primary py-4 text-base font-extrabold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Navigation className="h-5 w-5" /> Para onde Vamoo? 🚀
            </button>
          ) : (
            // Form aberto: confirma a corrida
            <button
              onClick={handleOpenPayment}
              disabled={isRequesting || !selectedOrigin || !selectedDestination}
              className="w-full rounded-2xl bg-gradient-primary py-4 text-base font-extrabold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isRequesting && <Loader2 className="h-4 w-4 animate-spin" />}
              Vamoo! 🚀
            </button>
          )}
        </div>
      )}

      {/* Payment Method Modal */}
      <PaymentMethodModal
        open={rideState === "payment"}
        onClose={() => setRideState("idle")}
        onConfirm={handleConfirmRide}
        originName={selectedOrigin?.name || ""}
        originAddress={selectedOrigin?.address}
        destinationName={selectedDestination?.name || ""}
        destinationAddress={selectedDestination?.address}
        stops={confirmedStops.map((s) => ({ name: s.name, address: s.address }))}
        returnToOrigin={returnToOrigin}
        passengerCount={passengers}
        forOtherPerson={forOtherPerson}
        otherPersonName={otherPerson.name}
        otherPersonPhone={otherPerson.phone}
        distanceKm={estimatedDistance || 0}
        durationMin={estimatedTime || 0}
        estimatedPrice={estimatedPrice || 0}
        category={selectedCategory}
      />

      {/* Pix Payment Modal — exibido ao final da corrida quando pagamento é Pix */}
      <PixPaymentModal
        open={showPixModal}
        onClose={() => setShowPixModal(false)}
        driverName={driverInfo?.profile?.full_name || "Motorista"}
        pixKey={driverInfo?.pix_key || null}
        pixKeyType={(driverInfo?.pix_key_type as PixKeyType) || null}
        amount={Number(activeRide?.price || 0)}
        rideId={activeRide?.id || ""}
        merchantCity={activeRide?.origin_address?.split(",").slice(-2, -1)[0]?.trim()}
      />

      {/* Modal de avaliação — sobreposto sobre a tela inicial após corrida finalizar.
          Fechar (X / overlay / Esc) chama resetRide para limpar o estado. */}
      <Dialog
        open={rideState === "rating" && !!activeRide}
        onOpenChange={() => { /* avaliação obrigatória — não permite fechar */ }}
      >
        <DialogContent
          className="max-w-sm w-[calc(100vw-1.5rem)] max-h-[95dvh] p-0 gap-0 flex flex-col overflow-hidden [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-4 pt-3 pb-1 shrink-0">
            <DialogTitle className="text-center text-base font-display">
              🎉 Você chegou!
            </DialogTitle>
            <p className="text-center text-[11px] text-muted-foreground mt-0.5">
              Avalie sua viagem para voltar à tela inicial
            </p>
          </DialogHeader>
          {activeRide && (
            <>
              <div className="px-4 py-1.5 space-y-2 text-center">
                {activeRide?.driver_id && (
                  <div className="flex flex-col items-center gap-1.5">
                    <p className="text-xs text-muted-foreground truncate">
                      Motorista: {driverInfo?.profile?.full_name || "Carregando..."}
                    </p>
                    <button
                      type="button"
                      onClick={toggleFavoriteDriver}
                      disabled={favoritingDriver}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        favoriteDriver
                          ? "text-destructive bg-destructive/10"
                          : "text-muted-foreground bg-muted hover:bg-muted/70"
                      } disabled:opacity-50`}
                      aria-label={favoriteDriver ? "Remover dos favoritos" : "Favoritar motorista"}
                    >
                      <Heart className={`h-3.5 w-3.5 ${favoriteDriver ? "fill-current" : ""}`} />
                      {favoriteDriver ? "Motorista favoritado" : "Favoritar motorista"}
                    </button>
                  </div>
                )}
                <RideSummary ride={activeRide} onRate={() => {}} hideRateButton compact />
                {activeRide.payment_method === "pix" && (
                  <button
                    onClick={() => setShowPixModal(true)}
                    className="w-full rounded-xl border-2 border-primary bg-primary/5 py-1.5 text-xs font-bold text-primary flex items-center justify-center gap-2"
                  >
                    <QrCode className="h-3.5 w-3.5" /> Mostrar QR Code Pix
                  </button>
                )}
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setRating(s)} className="transition-transform active:scale-95">
                      <Star className={`h-7 w-7 ${s <= rating ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  placeholder="Conte como foi a viagem (opcional)..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  className="w-full rounded-xl border bg-muted p-2 text-xs outline-none resize-none h-12"
                />
              </div>
              <div className="px-4 pt-2 pb-3 border-t bg-background shrink-0">
                <button
                  onClick={handleSubmitRating}
                  disabled={rating === 0}
                  className="w-full rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
                >
                  {rating === 0 ? "Selecione de 1 a 5 estrelas" : "Enviar avaliação ⭐"}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AppMenu role="passenger" />
      <PassengerSpendChip />
      <div className="fixed left-0 right-0 top-16 z-30 pointer-events-none">
        <div className="pointer-events-auto">
          <BlockBanner role="passenger" />
        </div>
      </div>
      {!showFormSheet && !["searching", "accepted", "driver_arriving", "arrived", "in_progress"].includes(rideState) && (
        <>
          <NotificationBell topOffsetPx={72} connectionStatus={gpsStatus} />
          <RefreshAppButton topOffsetPx={144} />
        </>
      )}

      {/* Modal de cancelamento — usado em todas as fases ativas (busca, aceito, chegando, chegou). */}
      <CancelRideDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onCancelled={handleAfterCancel}
        rideId={activeRide?.id ?? null}
        role="passenger"
        afterAccept={["accepted", "driver_arriving", "arrived"].includes(rideState)}
        inProgress={rideState === "in_progress"}
        acceptedAt={activeRide?.updated_at ?? null}
      />
    </div>
  );
};

export default PassengerHome;
