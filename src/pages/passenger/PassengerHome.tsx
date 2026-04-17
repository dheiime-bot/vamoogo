import { useState, useEffect } from "react";
import { Users, Plus, Car, Bike, Sparkles, X, Loader2, Phone, MessageCircle, Star, Navigation, Banknote, QrCode } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import NotificationBell from "@/components/shared/NotificationBell";

import GoogleMap, { LEG_COLORS } from "@/components/shared/GoogleMap";
import PaymentMethodModal, { type PaymentMethod, type AppliedCoupon } from "@/components/passenger/PaymentMethodModal";
import PixPaymentModal from "@/components/passenger/PixPaymentModal";
import RideChat from "@/components/passenger/RideChat";
import RideSummary from "@/components/passenger/RideSummary";
import OriginPicker, { type OriginType, type OtherPersonInfo } from "@/components/passenger/OriginPicker";
import AddressAutocompleteField from "@/components/address/AddressAutocompleteField";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useFareEstimate } from "@/hooks/useFareEstimate";
import { useLiveEta } from "@/hooks/useLiveEta";
import type { PlaceDetails } from "@/services/googlePlaces";
import { appLocationFromPlaceDetails, placeDetailsFromAppLocation, type AppLocation } from "@/lib/locationAdapters";
import type { PixKeyType } from "@/lib/pix";
import { calcPlatformFee } from "@/lib/platformFee";
import { toast } from "sonner";

const categories = [
  { id: "moto", label: "Moto", icon: Bike, desc: "Rápido e barato" },
  { id: "economico", label: "Econômico", icon: Car, desc: "Carro popular" },
  { id: "conforto", label: "Conforto", icon: Sparkles, desc: "Mais espaço" },
];


type RideState = "idle" | "payment" | "searching" | "accepted" | "driver_arriving" | "arrived" | "in_progress" | "completed" | "rating";

const paymentLabels: Record<string, string> = { cash: "Dinheiro", pix: "Pix", debit: "Débito", credit: "Crédito" };

const PassengerHome = () => {
  const { user } = useAuth();
  const [passengers, setPassengers] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("economico");
  const [selectedOrigin, setSelectedOrigin] = useState<AppLocation | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<AppLocation | null>(null);
  const [selectedStops, setSelectedStops] = useState<(AppLocation | null)[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [rideState, setRideState] = useState<RideState>("idle");
  const [activeRide, setActiveRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
    heading?: number;
    category?: "moto" | "economico" | "conforto";
  } | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [originType, setOriginType] = useState<OriginType>("gps");
  const [forOtherPerson, setForOtherPerson] = useState(false);
  const [otherPerson, setOtherPerson] = useState<OtherPersonInfo>({ name: "", phone: "" });
  const [returnToOrigin, setReturnToOrigin] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<Array<{ lat: number; lng: number; heading?: number; category?: "moto" | "economico" | "conforto" }>>([]);
  const [showChangeDest, setShowChangeDest] = useState(false);
  const [newDestination, setNewDestination] = useState<AppLocation | null>(null);
  const [showRideForm, setShowRideForm] = useState(false);

  // Fetch recent rides
  useEffect(() => {
    if (!user) return;
    supabase.from("rides").select("*").eq("passenger_id", user.id).order("created_at", { ascending: false }).limit(3)
      .then(({ data }) => { if (data) setRecentRides(data); });
  }, [user]);

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

      if (!ride) return;

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

  // Realtime: updates da corrida + posição do motorista
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("passenger-rides")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `passenger_id=eq.${user.id}` }, async (payload) => {
        const ride = payload.new as any;
        const prev = payload.old as any;
        setActiveRide(ride);

        if (ride.status === "accepted" && ride.driver_id) {
          const { data: driver } = await supabase.from("drivers").select("*").eq("user_id", ride.driver_id).single();
          const { data: driverProfile } = await supabase.from("profiles").select("*").eq("user_id", ride.driver_id).single();
          if (driver && driverProfile) setDriverInfo({ ...driver, profile: driverProfile });
          // Se já tem arrived_at quando chegou o accepted (race condition), pula direto
          if (ride.arrived_at) {
            setRideState("arrived");
            toast.success("Seu motorista chegou! 📍");
          } else {
            setRideState("driver_arriving");
            toast.success("Motorista a caminho! 🚗");
          }
        } else if (ride.status === "accepted" && ride.arrived_at && !prev?.arrived_at) {
          // Motorista marcou chegada
          setRideState("arrived");
          toast.success("Seu motorista chegou! 📍", { duration: 6000 });
          if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
        } else if (ride.status === "in_progress") {
          setRideState("in_progress");
          toast.success("Corrida iniciada!");
        } else if (ride.status === "completed") {
          setRideState("completed");
          setDriverLocation(null);
          // Pix é cobrado pelo motorista (QR Code aparece no app dele).
          // O passageiro vê apenas o resumo final; pode reabrir o QR pelo botão se quiser.
          toast.success("Corrida finalizada!");
        } else if (ride.status === "cancelled") {
          setRideState("idle");
          setActiveRide(null);
          setDriverInfo(null);
          setPaymentMethod(null);
          setDriverLocation(null);
          toast.error("Não encontramos motorista disponível");
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

  // Realtime: motoristas online próximos (só em idle, antes de pedir corrida)
  useEffect(() => {
    if (rideState !== "idle") {
      setNearbyDrivers([]);
      return;
    }
    const center = selectedOrigin
      ? { lat: selectedOrigin.lat, lng: selectedOrigin.lng }
      : null;

    const fetchNearby = async () => {
      const { data } = await supabase
        .from("driver_locations")
        .select("driver_id,lat,lng,heading,category,is_online,updated_at")
        .eq("is_online", true)
        .limit(50);
      if (!data) return;
      // Filtra: últimos 5 min e (se temos origem) raio de 8km
      const fresh = data.filter((d: any) => {
        const age = Date.now() - new Date(d.updated_at).getTime();
        if (age > 5 * 60 * 1000) return false;
        if (center) {
          const R = 6371;
          const dLat = ((d.lat - center.lat) * Math.PI) / 180;
          const dLng = ((d.lng - center.lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((center.lat * Math.PI) / 180) *
              Math.cos((d.lat * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2;
          const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (km > 8) return false;
        }
        return true;
      });
      setNearbyDrivers(
        fresh.map((d: any) => ({
          lat: Number(d.lat),
          lng: Number(d.lng),
          heading: d.heading ?? undefined,
          category: d.category ?? "economico",
        }))
      );
    };
    fetchNearby();

    const channel = supabase
      .channel("nearby-drivers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        () => fetchNearby()
      )
      .subscribe();

    const interval = setInterval(fetchNearby, 30000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [rideState, selectedOrigin?.lat, selectedOrigin?.lng]);

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
    setPaymentMethod(method);
    setRideState("idle"); // Close modal temporarily
    setIsRequesting(true);

    const distanceKm = estimatedDistance || 0;
    const durationMin = estimatedTime || 0;
    const basePrice = estimatedPrice || 0;
    const price = coupon ? Math.max(0, basePrice - coupon.discount) : basePrice;
    // Taxa configurável: override por categoria (tariffs.fee_percent) ou global (platform_settings.global_fee_percent)
    const platformFee = await calcPlatformFee(price, selectedCategory as "moto" | "economico" | "conforto");

    const { data, error } = await supabase.from("rides").insert({
      passenger_id: user.id,
      origin_address: `${selectedOrigin.name} - ${selectedOrigin.address}`,
      origin_lat: selectedOrigin.lat, origin_lng: selectedOrigin.lng,
      destination_address: `${effectiveDestination.name} - ${effectiveDestination.address}`,
      destination_lat: effectiveDestination.lat, destination_lng: effectiveDestination.lng,
      category: selectedCategory as "moto" | "economico" | "conforto",
      passenger_count: passengers, distance_km: distanceKm, duration_minutes: durationMin,
      price, platform_fee: platformFee, driver_net: price - platformFee,
      payment_method: method as any,
      stops: effectiveStops.length > 0
        ? effectiveStops.map((s) => ({ name: s.name, address: s.address, lat: s.lat, lng: s.lng }))
        : null,
      legs: fare.legs.length > 0 ? fare.legs : [],
      origin_type: originType,
      for_other_person: forOtherPerson,
      other_person_name: forOtherPerson ? otherPerson.name.trim() : null,
      other_person_phone: forOtherPerson ? otherPerson.phone : null,
    } as any).select().single();

    setIsRequesting(false);
    if (error) { toast.error("Erro: " + error.message); return; }

    // Increment coupon usage (best-effort, non-blocking)
    if (coupon) {
      supabase.from("coupons").select("used_count").eq("id", coupon.id).single()
        .then(({ data: c }) => {
          if (c) supabase.from("coupons").update({ used_count: (c.used_count || 0) + 1 }).eq("id", coupon.id).then(() => {});
        });
    }

    setRideState("searching");
    setActiveRide(data);
    toast.success("Buscando motorista mais próximo...");

    // Dispara o match em background (não bloqueia a UI)
    supabase.functions.invoke("dispatch-ride", { body: { rideId: data.id } })
      .catch((e) => console.warn("dispatch-ride invoke:", e));
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    await supabase.from("rides").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: user?.id }).eq("id", activeRide.id);
    setRideState("idle"); setActiveRide(null); setDriverInfo(null); setPaymentMethod(null);
    toast("Corrida cancelada");
  };

  // Alterar destino — permitido APENAS com a corrida em andamento (in_progress).
  // Recalcula preço, distância e tempo via Distance Matrix antes de gravar no banco.
  const handleChangeDestination = async () => {
    if (!activeRide || !newDestination) return;
    if (activeRide.status !== "in_progress") {
      toast.error("Só é possível alterar o destino com a corrida em andamento");
      return;
    }
    // Origem do recálculo = posição atual do motorista (se disponível) ou origem original
    const fromLat = driverLocation?.lat ?? Number(activeRide.origin_lat);
    const fromLng = driverLocation?.lng ?? Number(activeRide.origin_lng);

    // 1) Distância/tempo via Google (com fallback haversine)
    let km = 0; let min = 0;
    const g = (window as any).google;
    if (g?.maps?.DistanceMatrixService) {
      try {
        const svc = new g.maps.DistanceMatrixService();
        const res: any = await new Promise((resolve, reject) => {
          svc.getDistanceMatrix(
            {
              origins: [{ lat: fromLat, lng: fromLng }],
              destinations: [{ lat: newDestination.lat, lng: newDestination.lng }],
              travelMode: g.maps.TravelMode.DRIVING,
              unitSystem: g.maps.UnitSystem.METRIC,
            },
            (r: any, status: string) => (status === "OK" ? resolve(r) : reject(new Error(status)))
          );
        });
        const elem = res?.rows?.[0]?.elements?.[0];
        if (elem?.status === "OK") {
          km = Math.round((elem.distance.value / 1000) * 10) / 10;
          min = Math.round(elem.duration.value / 60);
        }
      } catch { /* usa fallback abaixo */ }
    }
    if (!km) {
      const R = 6371;
      const dLat = ((newDestination.lat - fromLat) * Math.PI) / 180;
      const dLng = ((newDestination.lng - fromLng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((fromLat * Math.PI) / 180) * Math.cos((newDestination.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      km = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
      min = Math.max(2, Math.round(km * 2.5));
    }

    // 2) Soma com o já percorrido (origem → posição atual) para preço total justo
    const startedKm = Number(activeRide.distance_km || 0);
    const totalKm = Math.round((startedKm + km) * 10) / 10;
    const totalMin = (activeRide.duration_minutes || 0) + min;

    // 3) Recalcula preço via tariffs (mesma fórmula do useFareEstimate)
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

    const { error } = await supabase
      .from("rides")
      .update({
        destination_address: `${newDestination.name} - ${newDestination.address}`,
        destination_lat: newDestination.lat,
        destination_lng: newDestination.lng,
        distance_km: totalKm,
        duration_minutes: totalMin,
        price: newPrice,
        platform_fee: newFee,
        driver_net: newPrice - newFee,
      })
      .eq("id", activeRide.id);
    if (error) {
      toast.error("Erro ao alterar destino: " + error.message);
      return;
    }
    setActiveRide((r: any) => ({
      ...r,
      destination_address: `${newDestination.name} - ${newDestination.address}`,
      destination_lat: newDestination.lat,
      destination_lng: newDestination.lng,
      distance_km: totalKm,
      duration_minutes: totalMin,
      price: newPrice,
      platform_fee: newFee,
      driver_net: newPrice - newFee,
    }));
    setSelectedDestination(newDestination);
    setShowChangeDest(false);
    setNewDestination(null);
    toast.success(`Destino atualizado • R$ ${newPrice.toFixed(2)} • ${totalKm} km`);
    if (user) {
      supabase.from("chat_messages").insert({
        ride_id: activeRide.id,
        sender_id: user.id,
        message: `📍 Destino alterado para: ${newDestination.name} • Novo valor: R$ ${newPrice.toFixed(2)} (${totalKm} km)`,
      }).then(() => {});
    }
  };

  const handleSubmitRating = async () => {
    if (!activeRide || rating === 0) return;
    await supabase.from("rides").update({ rating }).eq("id", activeRide.id);
    toast.success("Avaliação enviada! Obrigado ⭐");
    resetRide();
  };

  const resetRide = () => {
    setRideState("idle"); setActiveRide(null); setRating(0); setRatingComment("");
    setSelectedOrigin(null); setSelectedDestination(null); setSelectedStops([]);
    setDriverInfo(null); setPaymentMethod(null);
    setForOtherPerson(false); setOtherPerson({ name: "", phone: "" }); setOriginType("gps"); setReturnToOrigin(false);
    setShowPixModal(false);
  };

  const isRideActive = ["searching", "accepted", "driver_arriving", "arrived", "in_progress"].includes(rideState);

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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Map — 80vh em idle (sem form), maior durante corrida ativa */}
      <div className="relative">
        <GoogleMap
          className={`${
            isRideActive || rideState === "completed"
              ? "h-[68vh]"
              : showRideForm
              ? "h-[40vh]"
              : "h-[80vh]"
          } rounded-none transition-all duration-300`}
          origin={selectedOrigin ? { lat: selectedOrigin.lat, lng: selectedOrigin.lng, label: selectedOrigin.name } : null}
          destination={effectiveDestination ? { lat: effectiveDestination.lat, lng: effectiveDestination.lng, label: effectiveDestination.name } : null}
          stops={effectiveStops.map((s) => ({ lat: s.lat, lng: s.lng, label: s.name }))}
          driverLocation={driverLocation ? { ...driverLocation, label: "Motorista" } : null}
          nearbyDrivers={rideState === "idle" ? nearbyDrivers : []}
          trackUserLocation={!selectedOrigin}
          showRoute={!!selectedOrigin && !!effectiveDestination}
        />
      </div>

      {/* Bottom sheet — só aparece em corrida ativa, completed/rating, ou quando o form de viagem está aberto */}
      {(isRideActive || rideState === "completed" || rideState === "rating" || rideState === "payment" || (rideState === "idle" && showRideForm)) && (
      <div className="relative rounded-t-3xl bg-card shadow-lg animate-slide-up -mt-3">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="p-4 pb-3 space-y-4">
          {rideState === "idle" && showRideForm && (
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold font-display">Para onde Vamoo?</h2>
              <button
                onClick={() => setShowRideForm(false)}
                className="rounded-full p-1.5 hover:bg-muted transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Completed: Show summary */}
          {rideState === "completed" && activeRide && (
            <div className="space-y-3">
              <RideSummary ride={activeRide} onRate={() => setRideState("rating")} />
              {activeRide.payment_method === "pix" && (
                <button
                  onClick={() => setShowPixModal(true)}
                  className="w-full rounded-xl border-2 border-primary bg-primary/5 py-3 text-sm font-bold text-primary flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
                >
                  <QrCode className="h-4 w-4" /> Mostrar QR Code Pix
                </button>
              )}
            </div>
          )}

          {/* Rating screen */}
          {rideState === "rating" && activeRide && (
            <div className="space-y-4 text-center py-4 animate-fade-in">
              <div className="flex items-center justify-center gap-2">
                <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <Car className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <h2 className="text-lg font-bold font-display">Como foi sua viagem?</h2>
              {driverInfo && (
                <p className="text-sm text-muted-foreground">Motorista: {driverInfo.profile?.full_name}</p>
              )}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setRating(s)} className="transition-transform hover:scale-110 active:scale-95">
                    <Star className={`h-10 w-10 ${s <= rating ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Conte como foi a viagem (opcional)..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                className="w-full rounded-xl border bg-muted p-3 text-sm outline-none resize-none h-20"
              />
              <div className="flex flex-wrap justify-center gap-2">
                {["Educação", "Limpeza", "Direção segura", "Pontualidade"].map((tag) => (
                  <button key={tag} className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-primary/10 hover:border-primary transition-colors">
                    {tag}
                  </button>
                ))}
              </div>
              <button onClick={handleSubmitRating} disabled={rating === 0}
                className="w-full rounded-xl bg-gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">
                Enviar avaliação ⭐
              </button>
              <button onClick={resetRide} className="text-xs text-muted-foreground">
                Pular avaliação
              </button>
            </div>
          )}

          {/* Active ride overlays */}
          {isRideActive && activeRide && (
            <div className="space-y-4 animate-fade-in">
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
                  <h3 className="text-lg font-bold font-display">Buscando motorista...</h3>
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
                <div className="rounded-2xl border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">
                        {(driverInfo.profile?.full_name || "M")[0]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{driverInfo.profile?.full_name || "Motorista"}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 text-warning fill-warning" />
                        <span>{driverInfo.rating?.toFixed(1) || "5.0"}</span>
                        <span>•</span>
                        <span>{driverInfo.total_rides || 0} corridas</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
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
                        <p>🚗 Motorista a caminho</p>
                        {liveEta && (
                          <p className="text-xs font-medium opacity-80">
                            Chega em ~{liveEta.minutes} min • {liveEta.km} km
                          </p>
                        )}
                      </div>
                    )}
                    {rideState === "arrived" && "📍 Motorista chegou!"}
                    {rideState === "in_progress" && "🛣️ Corrida em andamento"}
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
                        onChange={(place) => setNewDestination(place ? appLocationFromPlaceDetails(place) : null)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setShowChangeDest(false); setNewDestination(null); }}
                          className="rounded-xl border py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleChangeDestination}
                          disabled={!newDestination}
                          className="rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-40"
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {rideState === "searching" && (
                <button onClick={handleCancelRide}
                  className="w-full rounded-xl border border-destructive/30 py-3.5 text-sm font-bold text-destructive hover:bg-destructive/5 transition-colors">
                  Cancelar busca
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

      {/* CTA fixo "Vamoo!" — só aparece em idle, respeitando safe-area */}
      {rideState === "idle" && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background to-transparent px-4 pt-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          {/* Indicador de motoristas próximos */}
          <div className="mb-2 flex items-center justify-center">
            {nearbyDrivers.length > 0 ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-[11px] font-semibold text-success ring-1 ring-success/20">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                {nearbyDrivers.length} {nearbyDrivers.length === 1 ? "motorista próximo" : "motoristas próximos"}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                Nenhum motorista por perto agora
              </div>
            )}
          </div>
          {!showRideForm ? (
            <button
              onClick={() => setShowRideForm(true)}
              className="w-full rounded-2xl bg-gradient-primary py-4 text-base font-extrabold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Para onde Vamoo? 🚀
            </button>
          ) : (
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

      <AppMenu role="passenger" />
      <NotificationBell />
      
    </div>
  );
};

export default PassengerHome;
