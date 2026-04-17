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
import type { PlaceDetails } from "@/services/googlePlaces";
import { appLocationFromPlaceDetails, placeDetailsFromAppLocation, type AppLocation } from "@/lib/locationAdapters";
import type { PixKeyType } from "@/lib/pix";
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

  // Fetch recent rides
  useEffect(() => {
    if (!user) return;
    supabase.from("rides").select("*").eq("passenger_id", user.id).order("created_at", { ascending: false }).limit(3)
      .then(({ data }) => { if (data) setRecentRides(data); });
  }, [user]);

  // Realtime: updates da corrida + posição do motorista
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("passenger-rides")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `passenger_id=eq.${user.id}` }, async (payload) => {
        const ride = payload.new as any;
        setActiveRide(ride);

        if (ride.status === "accepted" && ride.driver_id) {
          const { data: driver } = await supabase.from("drivers").select("*").eq("user_id", ride.driver_id).single();
          const { data: driverProfile } = await supabase.from("profiles").select("*").eq("user_id", ride.driver_id).single();
          if (driver && driverProfile) setDriverInfo({ ...driver, profile: driverProfile });
          setRideState("driver_arriving");
          toast.success("Motorista a caminho! 🚗");
        } else if (ride.status === "in_progress") {
          setRideState("in_progress");
          toast.success("Corrida iniciada!");
        } else if (ride.status === "completed") {
          setRideState("completed");
          setDriverLocation(null);
          if (ride.payment_method === "pix") setShowPixModal(true);
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
      .channel(`driver-location-${driverId}`)
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRide?.driver_id, activeRide?.status]);

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
    const platformFee = Math.round(price * 0.15 * 100) / 100;

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
      {/* Map */}
      <div className="relative">
        <GoogleMap
          className="h-[58vh] rounded-none"
          origin={selectedOrigin ? { lat: selectedOrigin.lat, lng: selectedOrigin.lng, label: selectedOrigin.name } : null}
          destination={effectiveDestination ? { lat: effectiveDestination.lat, lng: effectiveDestination.lng, label: effectiveDestination.name } : null}
          stops={effectiveStops.map((s) => ({ lat: s.lat, lng: s.lng, label: s.name }))}
          driverLocation={driverLocation ? { ...driverLocation, label: "Motorista" } : null}
          trackUserLocation={!selectedOrigin}
          showRoute={!!selectedOrigin && !!effectiveDestination}
        />
      </div>

      {/* Bottom sheet — sem sobreposição do logo do Google */}
      <div className="relative rounded-t-3xl bg-card shadow-lg animate-slide-up -mt-3">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="p-4 pb-3 space-y-4">

          {/* Completed: Show summary */}
          {rideState === "completed" && activeRide && (
            <RideSummary ride={activeRide} onRate={() => setRideState("rating")} />
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
                    {rideState === "driver_arriving" && "🚗 Motorista a caminho"}
                    {rideState === "arrived" && "📍 Motorista chegou!"}
                    {rideState === "in_progress" && "🛣️ Corrida em andamento"}
                  </div>
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

              {/* Passengers */}
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Passageiros</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPassengers(Math.max(1, passengers - 1))} className="flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold">−</button>
                  <span className="w-4 text-center text-sm font-bold">{passengers}</span>
                  <button onClick={() => setPassengers(Math.min(4, passengers + 1))} className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">+</button>
                </div>
              </div>

              {/* Category selector */}
              <div className="flex gap-2">
                {categories.map((cat) => (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                    className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                      selectedCategory === cat.id ? "border-primary bg-primary/5 shadow-glow" : "border-transparent bg-muted hover:border-border"
                    }`}>
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
                    const labels: string[] = [
                      selectedOrigin?.name || "Origem",
                      ...effectiveStops.map((s, i) =>
                        returnToOrigin && i === effectiveStops.length - 1
                          ? `Retorno: ${selectedOrigin?.name || "origem"}`
                          : s.name
                      ),
                      effectiveDestination?.name || "Destino",
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

      {/* CTA fixo "Vamoo!" — só aparece em idle, respeitando safe-area */}
      {rideState === "idle" && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background to-transparent px-4 pt-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <button
            onClick={handleOpenPayment}
            disabled={isRequesting || !selectedOrigin || !selectedDestination}
            className="w-full rounded-2xl bg-gradient-primary py-4 text-base font-extrabold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isRequesting && <Loader2 className="h-4 w-4 animate-spin" />}
            Vamoo! 🚀
          </button>
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

      <AppMenu role="passenger" />
      <NotificationBell />
    </div>
  );
};

export default PassengerHome;
