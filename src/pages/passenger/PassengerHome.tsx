import { useState } from "react";
import { MapPin, Search, Users, Plus, Clock, ChevronRight, Car, Bike, Crown, Star, History } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import MapPlaceholder from "@/components/shared/MapPlaceholder";
import { Home, User } from "lucide-react";

const categories = [
  { id: "moto", label: "Moto", icon: Bike, price: "R$ 8,90" },
  { id: "car", label: "Carro", icon: Car, price: "R$ 14,50" },
  { id: "premium", label: "Premium", icon: Crown, price: "R$ 22,00" },
];

const recentRides = [
  { id: 1, from: "Av. Paulista, 1000", to: "Rua Augusta, 500", price: "R$ 18,50", date: "Hoje, 14:30", status: "completed" as const },
  { id: 2, from: "Shopping Morumbi", to: "Aeroporto GRU", price: "R$ 85,00", date: "Ontem, 08:15", status: "completed" as const },
];

const navItems = [
  { icon: Home, label: "Início", path: "/passenger" },
  { icon: Clock, label: "Corridas", path: "/passenger/history" },
  { icon: User, label: "Perfil", path: "/passenger/profile" },
];

const PassengerHome = () => {
  const [passengers, setPassengers] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("car");
  const [stops, setStops] = useState([""]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Map */}
      <MapPlaceholder className="h-[35vh] rounded-none sm:h-[40vh]" />

      {/* Bottom Sheet */}
      <div className="relative -mt-6 rounded-t-3xl bg-card shadow-lg animate-slide-up">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="p-4 space-y-5">
          {/* Search */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              <input
                type="text"
                placeholder="Onde você está?"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                defaultValue="Minha localização"
              />
            </div>
            {stops.map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-muted p-3">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
                <input
                  type="text"
                  placeholder={stops.length > 1 ? `Parada ${i + 1}` : "Para onde?"}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
            <button
              onClick={() => setStops([...stops, ""])}
              className="flex items-center gap-2 text-xs font-medium text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar parada
            </button>
          </div>

          {/* Passengers */}
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Passageiros</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPassengers(Math.max(1, passengers - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold"
              >
                −
              </button>
              <span className="w-4 text-center text-sm font-bold">{passengers}</span>
              <button
                onClick={() => setPassengers(Math.min(4, passengers + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold"
              >
                +
              </button>
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                  selectedCategory === cat.id
                    ? "border-primary bg-primary/5 shadow-glow"
                    : "border-transparent bg-muted hover:border-border"
                }`}
              >
                <cat.icon className={`h-6 w-6 ${selectedCategory === cat.id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-semibold">{cat.label}</span>
                <span className={`text-xs font-bold ${selectedCategory === cat.id ? "text-primary" : "text-muted-foreground"}`}>{cat.price}</span>
              </button>
            ))}
          </div>

          {/* CTA */}
          <button className="w-full rounded-xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow transition-transform active:scale-[0.98]">
            Solicitar corrida
          </button>

          {/* Recent */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Corridas recentes</h3>
            <div className="space-y-2">
              {recentRides.map((ride) => (
                <div key={ride.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{ride.to}</p>
                    <p className="text-xs text-muted-foreground">{ride.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{ride.price}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <BottomNav items={navItems} />
    </div>
  );
};

export default PassengerHome;
