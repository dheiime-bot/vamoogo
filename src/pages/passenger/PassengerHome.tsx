import { useState, useEffect } from "react";
import { MapPin, Search, Users, Plus, Clock, ChevronRight, Car, Bike, Crown, X, Loader2, Phone, MessageCircle, Star, Navigation, Banknote } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import GoogleMap from "@/components/shared/GoogleMap";
import PaymentMethodModal, { type PaymentMethod } from "@/components/passenger/PaymentMethodModal";
import RideChat from "@/components/passenger/RideChat";
import RideSummary from "@/components/passenger/RideSummary";
import { Home, User } from "lucide-react";
import { searchLocations, getPopularLocations, getCategoryLabel, getCategoryIcon, CityLocation } from "@/data/cityLocations";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const categories = [
  { id: "moto", label: "Moto", icon: Bike, desc: "Rápido" },
  { id: "car", label: "Carro", icon: Car, desc: "Conforto" },
  { id: "premium", label: "Premium", icon: Crown, desc: "VIP" },
];

const navItems = [
  { icon: Home, label: "Início", path: "/passenger" },
  { icon: Clock, label: "Corridas", path: "/passenger/history" },
  { icon: User, label: "Perfil", path: "/passenger/profile" },
];

type RideState = "idle" | "payment" | "searching" | "accepted" | "driver_arriving" | "arrived" | "in_progress" | "completed" | "rating";

const paymentLabels: Record<string, string> = { cash: "Dinheiro", pix: "Pix", debit: "Débito", credit: "Crédito" };

const PassengerHome = () => {
  const { user } = useAuth();
  const [passengers, setPassengers] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("car");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [activeInput, setActiveInput] = useState<"origin" | "destination" | number | null>(null);
  const [searchResults, setSearchResults] = useState<CityLocation[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<CityLocation | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<CityLocation | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [rideState, setRideState] = useState<RideState>("idle");
  const [activeRide, setActiveRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [driverInfo, setDriverInfo] = useState<any>(null);

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
    supabase.from("driver_locations").select("lat,lng").eq("driver_id", driverId).maybeSingle()
      .then(({ data }) => { if (data) setDriverLocation({ lat: Number(data.lat), lng: Number(data.lng) }); });

    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` },
        (payload) => {
          const loc = payload.new as any;
          if (loc?.lat && loc?.lng) setDriverLocation({ lat: Number(loc.lat), lng: Number(loc.lng) });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRide?.driver_id, activeRide?.status]);

  // Calculate estimated price
  useEffect(() => {
    if (!selectedOrigin || !selectedDestination) {
      setEstimatedPrice(null); setEstimatedTime(null); setEstimatedDistance(null);
      return;
    }
    const distanceKm = Math.round(Math.sqrt(
      Math.pow((selectedDestination.lat - selectedOrigin.lat) * 111, 2) +
      Math.pow((selectedDestination.lng - selectedOrigin.lng) * 111 * Math.cos(selectedOrigin.lat * Math.PI / 180), 2)
    ) * 10) / 10;
    const basePrices: Record<string, number> = { moto: 5, car: 7, premium: 12 };
    const perKm: Record<string, number> = { moto: 1.2, car: 1.8, premium: 3.0 };
    const perMin: Record<string, number> = { moto: 0.3, car: 0.45, premium: 0.7 };
    const durationMin = Math.round(distanceKm * 3);
    let price = basePrices[selectedCategory] + perKm[selectedCategory] * distanceKm + perMin[selectedCategory] * durationMin;
    price += (passengers - 1) * 2;
    price = Math.max(price, selectedCategory === "moto" ? 8 : selectedCategory === "car" ? 12 : 20);
    setEstimatedPrice(Math.round(price * 100) / 100);
    setEstimatedTime(durationMin);
    setEstimatedDistance(distanceKm);
  }, [selectedOrigin, selectedDestination, selectedCategory, passengers]);

  const handleSearch = (query: string) => {
    if (query.length >= 2) setSearchResults(searchLocations(query));
    else setSearchResults(getPopularLocations("Altamira", 8));
  };

  const selectLocation = (loc: CityLocation) => {
    if (activeInput === "origin") { setOrigin(loc.name); setSelectedOrigin(loc); }
    else if (activeInput === "destination") { setDestination(loc.name); setSelectedDestination(loc); }
    else if (typeof activeInput === "number") { const ns = [...stops]; ns[activeInput] = loc.name; setStops(ns); }
    setActiveInput(null); setSearchResults([]);
  };

  // Open payment modal instead of directly requesting
  const handleOpenPayment = () => {
    if (!selectedOrigin || !selectedDestination) { toast.error("Selecione origem e destino"); return; }
    if (!user) { toast.error("Faça login para solicitar corridas"); return; }
    setRideState("payment");
  };

  // Request ride after payment method is selected
  const handleConfirmRide = async (method: PaymentMethod) => {
    if (!selectedOrigin || !selectedDestination || !user) return;
    setPaymentMethod(method);
    setRideState("idle"); // Close modal temporarily
    setIsRequesting(true);

    const distanceKm = estimatedDistance || 0;
    const durationMin = estimatedTime || 0;
    const price = estimatedPrice || 0;
    const platformFee = Math.round(price * 0.15 * 100) / 100;

    const { data, error } = await supabase.from("rides").insert({
      passenger_id: user.id,
      origin_address: `${selectedOrigin.name} - ${selectedOrigin.address}`,
      origin_lat: selectedOrigin.lat, origin_lng: selectedOrigin.lng,
      destination_address: `${selectedDestination.name} - ${selectedDestination.address}`,
      destination_lat: selectedDestination.lat, destination_lng: selectedDestination.lng,
      category: selectedCategory as "moto" | "car" | "premium",
      passenger_count: passengers, distance_km: distanceKm, duration_minutes: durationMin,
      price, platform_fee: platformFee, driver_net: price - platformFee,
      payment_method: method as any,
      stops: stops.filter(Boolean).length > 0 ? stops.filter(Boolean) : null,
    }).select().single();

    setIsRequesting(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    setRideState("searching");
    setActiveRide(data);
    toast.success("Buscando motorista...");
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
    setSelectedOrigin(null); setSelectedDestination(null); setOrigin(""); setDestination("");
    setDriverInfo(null); setPaymentMethod(null);
  };

  const showSuggestions = activeInput !== null;
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
          className="h-[40vh] rounded-none"
          origin={selectedOrigin ? { lat: selectedOrigin.lat, lng: selectedOrigin.lng, label: selectedOrigin.name } : null}
          destination={selectedDestination ? { lat: selectedDestination.lat, lng: selectedDestination.lng, label: selectedDestination.name } : null}
          driverLocation={driverLocation ? { ...driverLocation, label: "Motorista" } : null}
          trackUserLocation={!selectedOrigin}
          showRoute={!!selectedOrigin && !!selectedDestination}
        />
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full bg-card/90 backdrop-blur-md px-3 py-1.5 shadow-md">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">Altamira, PA</span>
        </div>
        {isRideActive && estimatedTime && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-primary px-4 py-1.5 shadow-glow">
            <span className="text-xs font-bold text-primary-foreground">
              {rideState === "searching" ? "Buscando..." : `Chegada em ${estimatedTime} min`}
            </span>
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      <div className="relative -mt-6 rounded-t-3xl bg-card shadow-lg animate-slide-up">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="p-4 space-y-4">

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
                Enviar Avaliação ⭐
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
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-success" />
                  <input type="text" placeholder="Onde você está?" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" value={origin}
                    onChange={(e) => { setOrigin(e.target.value); handleSearch(e.target.value); }}
                    onFocus={() => { setActiveInput("origin"); handleSearch(origin); }}
                  />
                  {origin && <button onClick={() => { setOrigin(""); setSelectedOrigin(null); }}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
                  <input type="text" placeholder="Para onde vai?" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" value={destination}
                    onChange={(e) => { setDestination(e.target.value); handleSearch(e.target.value); }}
                    onFocus={() => { setActiveInput("destination"); handleSearch(destination); }}
                  />
                  {destination && <button onClick={() => { setDestination(""); setSelectedDestination(null); }}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                {stops.map((stop, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-muted p-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-warning" />
                    <input type="text" placeholder={`Parada ${i + 1}`} className="flex-1 bg-transparent text-sm outline-none" value={stop}
                      onChange={(e) => { const ns = [...stops]; ns[i] = e.target.value; setStops(ns); handleSearch(e.target.value); }}
                      onFocus={() => { setActiveInput(i); handleSearch(stop); }}
                    />
                    <button onClick={() => setStops(stops.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                ))}
                <button onClick={() => setStops([...stops, ""])} className="flex items-center gap-2 text-xs font-medium text-primary">
                  <Plus className="h-3.5 w-3.5" /> Adicionar parada
                </button>
              </div>

              {showSuggestions && (
                <div className="rounded-xl border bg-card shadow-lg max-h-52 overflow-y-auto animate-fade-in">
                  {searchResults.length > 0 ? searchResults.map((loc) => (
                    <button key={loc.id} onClick={() => selectLocation(loc)}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-b-0">
                      <span className="text-lg mt-0.5">{getCategoryIcon(loc.category)}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{loc.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{loc.address} • {getCategoryLabel(loc.category)}</p>
                      </div>
                    </button>
                  )) : <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum local encontrado</p>}
                  <button onClick={() => setActiveInput(null)} className="w-full px-3 py-2 text-xs text-primary font-medium border-t">Fechar</button>
                </div>
              )}

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
              {estimatedPrice && (
                <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 p-3">
                  <div>
                    <span className="text-sm font-medium">Valor estimado</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Navigation className="h-3 w-3" /> {estimatedDistance} km • ~{estimatedTime} min
                    </div>
                  </div>
                  <span className="text-xl font-extrabold text-primary">R$ {estimatedPrice.toFixed(2)}</span>
                </div>
              )}

              {/* CTA — opens payment modal */}
              <button onClick={handleOpenPayment} disabled={isRequesting || !selectedOrigin || !selectedDestination}
                className="w-full rounded-xl bg-gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                {isRequesting && <Loader2 className="h-4 w-4 animate-spin" />}
                Chamou, Vamoo! 🚀
              </button>

              {/* Recent rides */}
              {recentRides.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Corridas recentes</h3>
                  <div className="space-y-2">
                    {recentRides.map((ride) => (
                      <div key={ride.id} className="flex items-center gap-3 rounded-xl border p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><Clock className="h-4 w-4 text-muted-foreground" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium">{ride.destination_address?.split(" - ")[0]}</p>
                          <p className="text-xs text-muted-foreground">{new Date(ride.created_at).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <div className="text-right"><p className="text-sm font-bold">R$ {ride.price?.toFixed(2) || "—"}</p></div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Payment Method Modal */}
      <PaymentMethodModal
        open={rideState === "payment"}
        onClose={() => setRideState("idle")}
        onConfirm={handleConfirmRide}
        originName={selectedOrigin?.name || ""}
        destinationName={selectedDestination?.name || ""}
        distanceKm={estimatedDistance || 0}
        durationMin={estimatedTime || 0}
        estimatedPrice={estimatedPrice || 0}
        category={selectedCategory}
      />

      <BottomNav items={navItems} />
    </div>
  );
};

export default PassengerHome;
