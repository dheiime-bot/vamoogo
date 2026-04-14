import { useState, useEffect } from "react";
import { MapPin, Search, Users, Plus, Clock, ChevronRight, Car, Bike, Crown, X, Loader2, Phone, MessageCircle, Star, Navigation } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import MapboxMap from "@/components/shared/MapboxMap";
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

type RideState = "idle" | "searching" | "accepted" | "driver_arriving" | "in_progress" | "rating" | "completed";

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
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("rides").select("*").eq("passenger_id", user.id).order("created_at", { ascending: false }).limit(3)
      .then(({ data }) => { if (data) setRecentRides(data); });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("passenger-rides")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `passenger_id=eq.${user.id}` }, (payload) => {
        const ride = payload.new as any;
        setActiveRide(ride);
        if (ride.status === "accepted") { setRideState("driver_arriving"); toast.success("Motorista a caminho! 🚗"); }
        else if (ride.status === "in_progress") { setRideState("in_progress"); toast.success("Corrida iniciada!"); }
        else if (ride.status === "completed") { setRideState("rating"); toast.success("Corrida finalizada! ⭐"); }
        else if (ride.status === "cancelled") { setRideState("idle"); setActiveRide(null); toast.error("Corrida cancelada"); }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!selectedOrigin || !selectedDestination) { setEstimatedPrice(null); setEstimatedTime(null); return; }
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

  const handleRequestRide = async () => {
    if (!selectedOrigin || !selectedDestination) { toast.error("Selecione origem e destino"); return; }
    if (!user) { toast.error("Faça login para solicitar corridas"); return; }
    setIsRequesting(true);
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
    price = Math.round(price * 100) / 100;
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
      stops: stops.filter(Boolean).length > 0 ? stops.filter(Boolean) : null,
    }).select().single();
    setIsRequesting(false);
    if (error) { toast.error("Erro: " + error.message); }
    else { setRideState("searching"); setActiveRide(data); toast.success("Buscando motorista..."); }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    await supabase.from("rides").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: user?.id }).eq("id", activeRide.id);
    setRideState("idle"); setActiveRide(null); toast("Corrida cancelada");
  };

  const handleSubmitRating = async () => {
    if (!activeRide || rating === 0) return;
    await supabase.from("rides").update({ rating }).eq("id", activeRide.id);
    toast.success("Avaliação enviada! Obrigado.");
    setRideState("idle"); setActiveRide(null); setRating(0); setRatingComment("");
    setSelectedOrigin(null); setSelectedDestination(null); setOrigin(""); setDestination("");
  };

  const showSuggestions = activeInput !== null;
  const isRideActive = ["searching", "accepted", "driver_arriving", "in_progress"].includes(rideState);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Map - full width */}
      <div className="relative">
        <MapboxMap
          className="h-[40vh] rounded-none"
          origin={selectedOrigin ? { lat: selectedOrigin.lat, lng: selectedOrigin.lng, label: selectedOrigin.name } : null}
          destination={selectedDestination ? { lat: selectedDestination.lat, lng: selectedDestination.lng, label: selectedDestination.name } : null}
          driverLocation={driverLocation ? { ...driverLocation, label: "Motorista" } : null}
          trackUserLocation={!selectedOrigin}
          showRoute={!!selectedOrigin && !!selectedDestination}
        />
        {/* Floating location badge */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full bg-card/90 backdrop-blur-md px-3 py-1.5 shadow-md">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">Altamira, PA</span>
        </div>
        {/* Floating estimated arrival */}
        {isRideActive && estimatedTime && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-primary px-4 py-1.5 shadow-glow">
            <span className="text-xs font-bold text-primary-foreground">Chegada em {estimatedTime} min</span>
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      <div className="relative -mt-6 rounded-t-3xl bg-card shadow-lg animate-slide-up">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="p-4 space-y-4">

          {/* Rating screen */}
          {rideState === "rating" && activeRide && (
            <div className="space-y-4 text-center py-4">
              <div className="flex items-center justify-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <Car className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <h2 className="text-xl font-bold font-display">Vamoo</h2>
              <p className="text-lg font-semibold">Avaliação</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setRating(s)} className="transition-transform hover:scale-110">
                    <Star className={`h-8 w-8 ${s <= rating ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Como foi a viagem?</p>
                <textarea
                  placeholder="Conte como foi..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  className="w-full rounded-xl border bg-muted p-3 text-sm outline-none resize-none h-20"
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {["Educação", "Limpeza", "Eficiência"].map((tag) => (
                  <button key={tag} className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-primary/10 hover:border-primary transition-colors">
                    {tag}
                  </button>
                ))}
              </div>
              <button
                onClick={handleSubmitRating}
                disabled={rating === 0}
                className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
              >
                Enviar Avaliação
              </button>
            </div>
          )}

          {/* Active ride overlay */}
          {isRideActive && activeRide && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full animate-pulse ${
                    rideState === "searching" ? "bg-warning" : rideState === "driver_arriving" ? "bg-primary" : "bg-success"
                  }`} />
                  <span className="text-sm font-bold">
                    {rideState === "searching" && "Buscando motorista..."}
                    {rideState === "driver_arriving" && "Motorista a caminho!"}
                    {rideState === "in_progress" && "Em corrida"}
                  </span>
                </div>
                <span className="text-lg font-extrabold text-primary">R$ {activeRide.price?.toFixed(2)}</span>
              </div>

              {/* Driver info card */}
              {(rideState === "driver_arriving" || rideState === "in_progress") && (
                <div className="flex items-center gap-3 rounded-xl border bg-muted/50 p-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                    <User className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">João</p>
                    <p className="text-xs text-muted-foreground">ABC-1234</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-warning fill-warning" />
                    <span className="text-sm font-bold">4.9</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-success" />
                  <p className="text-sm">{activeRide.origin_address?.split(" - ")[0]}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-destructive" />
                  <p className="text-sm">{activeRide.destination_address?.split(" - ")[0]}</p>
                </div>
              </div>

              {(rideState === "driver_arriving" || rideState === "in_progress") && (
                <div className="grid grid-cols-2 gap-2">
                  <button className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold hover:bg-muted transition-colors">
                    <Phone className="h-4 w-4 text-primary" /> Ligar
                  </button>
                  <button className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold hover:bg-muted transition-colors">
                    <MessageCircle className="h-4 w-4 text-primary" /> Chat
                  </button>
                </div>
              )}

              {rideState === "searching" && (
                <button onClick={handleCancelRide} className="w-full rounded-xl border border-destructive/30 py-3 text-sm font-bold text-destructive">
                  Cancelar busca
                </button>
              )}
            </div>
          )}

          {/* Normal form */}
          {rideState === "idle" && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-success" />
                  <input type="text" placeholder="Para onde vamos?" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" value={origin}
                    onChange={(e) => { setOrigin(e.target.value); handleSearch(e.target.value); }}
                    onFocus={() => { setActiveInput("origin"); handleSearch(origin); }}
                  />
                  {origin && <button onClick={() => { setOrigin(""); setSelectedOrigin(null); }}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
                  <input type="text" placeholder="Automático automático" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" value={destination}
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

              {estimatedPrice && (
                <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 p-3">
                  <div>
                    <span className="text-sm font-medium">Valor estimado</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Navigation className="h-3 w-3" /> ~{estimatedTime} min
                    </div>
                  </div>
                  <span className="text-xl font-extrabold text-primary">R$ {estimatedPrice.toFixed(2)}</span>
                </div>
              )}

              <button onClick={handleRequestRide} disabled={isRequesting || !selectedOrigin || !selectedDestination}
                className="w-full rounded-xl bg-gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                {isRequesting && <Loader2 className="h-4 w-4 animate-spin" />}
                Chamou, Vamoo! 🚀
              </button>

              {/* Promo banner */}
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-center">
                <span className="text-xs font-bold text-destructive">PROMO: 15% OFF</span>
              </div>

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
      <BottomNav items={navItems} />
    </div>
  );
};

export default PassengerHome;
