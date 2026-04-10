import { useState, useEffect, useRef } from "react";
import { MapPin, Search, Users, Plus, Clock, ChevronRight, Car, Bike, Crown, X, Loader2 } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import MapPlaceholder from "@/components/shared/MapPlaceholder";
import { Home, User } from "lucide-react";
import { searchLocations, getPopularLocations, getCategoryLabel, CityLocation } from "@/data/cityLocations";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const categories = [
  { id: "moto", label: "Moto", icon: Bike, price: "R$ 8,90" },
  { id: "car", label: "Carro", icon: Car, price: "R$ 14,50" },
  { id: "premium", label: "Premium", icon: Crown, price: "R$ 22,00" },
];

const navItems = [
  { icon: Home, label: "Início", path: "/passenger" },
  { icon: Clock, label: "Corridas", path: "/passenger/history" },
  { icon: User, label: "Perfil", path: "/passenger/profile" },
];

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
  const searchRef = useRef<HTMLDivElement>(null);

  // Load recent rides
  useEffect(() => {
    if (!user) return;
    supabase
      .from("rides")
      .select("*")
      .eq("passenger_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setRecentRides(data);
      });
  }, [user]);

  // Search handler
  const handleSearch = (query: string) => {
    if (query.length >= 2) {
      setSearchResults(searchLocations(query));
    } else {
      setSearchResults(getPopularLocations("São Paulo", 6));
    }
  };

  const selectLocation = (loc: CityLocation) => {
    if (activeInput === "origin") {
      setOrigin(loc.name);
      setSelectedOrigin(loc);
    } else if (activeInput === "destination") {
      setDestination(loc.name);
      setSelectedDestination(loc);
    } else if (typeof activeInput === "number") {
      const newStops = [...stops];
      newStops[activeInput] = loc.name;
      setStops(newStops);
    }
    setActiveInput(null);
    setSearchResults([]);
  };

  const handleRequestRide = async () => {
    if (!selectedOrigin || !selectedDestination) {
      toast.error("Selecione origem e destino");
      return;
    }
    if (!user) {
      toast.error("Faça login para solicitar corridas");
      return;
    }

    setIsRequesting(true);
    const distanceKm = Math.round(
      Math.sqrt(
        Math.pow((selectedDestination.lat - selectedOrigin.lat) * 111, 2) +
        Math.pow((selectedDestination.lng - selectedOrigin.lng) * 111 * Math.cos(selectedOrigin.lat * Math.PI / 180), 2)
      ) * 10
    ) / 10;

    const basePrices: Record<string, number> = { moto: 5, car: 7, premium: 12 };
    const perKm: Record<string, number> = { moto: 1.2, car: 1.8, premium: 3.0 };
    const perMin: Record<string, number> = { moto: 0.3, car: 0.45, premium: 0.7 };
    const durationMin = Math.round(distanceKm * 3);

    let price = basePrices[selectedCategory] + perKm[selectedCategory] * distanceKm + perMin[selectedCategory] * durationMin;
    price += (passengers - 1) * 2;
    price = Math.max(price, selectedCategory === "moto" ? 8 : selectedCategory === "car" ? 12 : 20);
    price = Math.round(price * 100) / 100;

    const platformFee = Math.round(price * 0.15 * 100) / 100;

    const { error } = await supabase.from("rides").insert({
      passenger_id: user.id,
      origin_address: `${selectedOrigin.name} - ${selectedOrigin.address}`,
      origin_lat: selectedOrigin.lat,
      origin_lng: selectedOrigin.lng,
      destination_address: `${selectedDestination.name} - ${selectedDestination.address}`,
      destination_lat: selectedDestination.lat,
      destination_lng: selectedDestination.lng,
      category: selectedCategory as "moto" | "car" | "premium",
      passenger_count: passengers,
      distance_km: distanceKm,
      duration_minutes: durationMin,
      price,
      platform_fee: platformFee,
      driver_net: price - platformFee,
      stops: stops.filter(Boolean).length > 0 ? stops.filter(Boolean) : null,
    });

    setIsRequesting(false);
    if (error) {
      toast.error("Erro ao solicitar corrida: " + error.message);
    } else {
      toast.success(`Corrida solicitada! ${distanceKm} km • ~${durationMin} min • R$ ${price.toFixed(2)}`);
      setOrigin("");
      setDestination("");
      setSelectedOrigin(null);
      setSelectedDestination(null);
      setStops([]);
      // Refresh rides
      const { data } = await supabase.from("rides").select("*").eq("passenger_id", user.id).order("created_at", { ascending: false }).limit(3);
      if (data) setRecentRides(data);
    }
  };

  const showSuggestions = activeInput !== null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <MapPlaceholder className="h-[30vh] rounded-none sm:h-[35vh]" origin={selectedOrigin} destination={selectedDestination} />

      <div className="relative -mt-6 rounded-t-3xl bg-card shadow-lg animate-slide-up">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="p-4 space-y-4">
          {/* Origin */}
          <div className="space-y-2" ref={searchRef}>
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              <input
                type="text"
                placeholder="Onde você está?"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                value={origin}
                onChange={(e) => { setOrigin(e.target.value); handleSearch(e.target.value); }}
                onFocus={() => { setActiveInput("origin"); handleSearch(origin); }}
              />
              {origin && (
                <button onClick={() => { setOrigin(""); setSelectedOrigin(null); }}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Destination */}
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
              <input
                type="text"
                placeholder="Para onde?"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                value={destination}
                onChange={(e) => { setDestination(e.target.value); handleSearch(e.target.value); }}
                onFocus={() => { setActiveInput("destination"); handleSearch(destination); }}
              />
              {destination && (
                <button onClick={() => { setDestination(""); setSelectedDestination(null); }}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Stops */}
            {stops.map((stop, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-muted p-3">
                <div className="h-2.5 w-2.5 rounded-full bg-warning" />
                <input
                  type="text"
                  placeholder={`Parada ${i + 1}`}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  value={stop}
                  onChange={(e) => {
                    const newStops = [...stops];
                    newStops[i] = e.target.value;
                    setStops(newStops);
                    handleSearch(e.target.value);
                  }}
                  onFocus={() => { setActiveInput(i); handleSearch(stop); }}
                />
                <button onClick={() => setStops(stops.filter((_, j) => j !== i))}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}

            <button onClick={() => setStops([...stops, ""])} className="flex items-center gap-2 text-xs font-medium text-primary">
              <Plus className="h-3.5 w-3.5" /> Adicionar parada
            </button>
          </div>

          {/* Location suggestions dropdown */}
          {showSuggestions && (
            <div className="rounded-xl border bg-card shadow-lg max-h-48 overflow-y-auto animate-fade-in">
              {searchResults.length > 0 ? (
                searchResults.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => selectLocation(loc)}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-b-0"
                  >
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{loc.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{getCategoryLabel(loc.category)} • {loc.city}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum local encontrado</p>
              )}
              <button onClick={() => setActiveInput(null)} className="w-full px-3 py-2 text-xs text-primary font-medium border-t">
                Fechar
              </button>
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

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                  selectedCategory === cat.id ? "border-primary bg-primary/5 shadow-glow" : "border-transparent bg-muted hover:border-border"
                }`}
              >
                <cat.icon className={`h-6 w-6 ${selectedCategory === cat.id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-semibold">{cat.label}</span>
                <span className={`text-xs font-bold ${selectedCategory === cat.id ? "text-primary" : "text-muted-foreground"}`}>{cat.price}</span>
              </button>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleRequestRide}
            disabled={isRequesting || !selectedOrigin || !selectedDestination}
            className="w-full rounded-xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isRequesting && <Loader2 className="h-4 w-4 animate-spin" />}
            Solicitar corrida
          </button>

          {/* Recent */}
          {recentRides.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Corridas recentes</h3>
              <div className="space-y-2">
                {recentRides.map((ride) => (
                  <div key={ride.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{ride.destination_address?.split(" - ")[0]}</p>
                      <p className="text-xs text-muted-foreground">{new Date(ride.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">R$ {ride.price?.toFixed(2) || "—"}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav items={navItems} />
    </div>
  );
};

export default PassengerHome;
