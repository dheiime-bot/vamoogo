import { Clock, MapPin, ChevronRight, Filter } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import StatusBadge from "@/components/shared/StatusBadge";
import { Home, User } from "lucide-react";

const rides = [
  { id: 1, from: "Av. Paulista, 1000", to: "Rua Augusta, 500", price: "R$ 18,50", date: "10/04/2026, 14:30", driver: "Carlos M.", rating: 4.9, status: "completed" as const, category: "Carro" },
  { id: 2, from: "Shopping Morumbi", to: "Aeroporto GRU", price: "R$ 85,00", date: "09/04/2026, 08:15", driver: "Ana S.", rating: 4.8, status: "completed" as const, category: "Premium" },
  { id: 3, from: "Estação Sé", to: "Vila Madalena", price: "R$ 12,00", date: "08/04/2026, 19:00", driver: "João P.", rating: 4.7, status: "cancelled" as const, category: "Moto" },
  { id: 4, from: "Pinheiros", to: "Brooklin", price: "R$ 22,00", date: "07/04/2026, 10:45", driver: "Maria L.", rating: 5.0, status: "completed" as const, category: "Carro" },
];

const navItems = [
  { icon: Home, label: "Início", path: "/passenger" },
  { icon: Clock, label: "Corridas", path: "/passenger/history" },
  { icon: User, label: "Perfil", path: "/passenger/profile" },
];

const PassengerHistory = () => (
  <div className="min-h-screen bg-background pb-20">
    <div className="bg-card border-b p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Minhas Corridas</h1>
        <button className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium">
          <Filter className="h-3.5 w-3.5" /> Filtrar
        </button>
      </div>
    </div>

    <div className="p-4 space-y-3">
      {rides.map((ride, i) => (
        <div
          key={ride.id}
          className="rounded-2xl border bg-card p-4 shadow-sm animate-slide-up"
          style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">{ride.date}</p>
              <p className="text-xs font-medium text-muted-foreground">{ride.category} • {ride.driver} ⭐ {ride.rating}</p>
            </div>
            <StatusBadge status={ride.status} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <p className="text-sm">{ride.from}</p>
            </div>
            <div className="ml-1 h-3 border-l border-dashed border-muted-foreground/30" />
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-destructive" />
              <p className="text-sm">{ride.to}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <p className="text-lg font-bold">{ride.price}</p>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      ))}
    </div>

    <BottomNav items={navItems} />
  </div>
);

export default PassengerHistory;
