import { Clock, MapPin, Navigation, Star } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import StatusBadge from "@/components/shared/StatusBadge";

const rides = [
  { id: "#1042", from: "Av. Paulista, 1000", to: "Rua Augusta, 500", price: "R$ 18,50", fee: "R$ 2,78", net: "R$ 15,72", date: "10/04, 14:35", status: "completed" as const, distance: "3.2km", duration: "12min", passengers: 1, rating: 5 },
  { id: "#1038", from: "Liberdade", to: "Mooca", price: "R$ 16,00", fee: "R$ 2,40", net: "R$ 13,60", date: "10/04, 10:00", status: "completed" as const, distance: "6.2km", duration: "22min", passengers: 1, rating: 4 },
  { id: "#1035", from: "Pinheiros", to: "Itaim", price: "R$ 12,00", fee: "R$ 1,80", net: "R$ 10,20", date: "09/04, 18:30", status: "completed" as const, distance: "2.8km", duration: "10min", passengers: 2, rating: 5 },
  { id: "#1030", from: "Vila Madalena", to: "Perdizes", price: "R$ 14,00", fee: "R$ 2,10", net: "R$ 11,90", date: "09/04, 15:20", status: "cancelled" as const, distance: "3.5km", duration: "14min", passengers: 1, rating: 0 },
];

const DriverRides = () => (
  <div className="min-h-screen bg-background pb-20">
    <div className="bg-card border-b p-4">
      <h1 className="text-lg font-bold">Minhas Corridas</h1>
      <p className="text-xs text-muted-foreground">Histórico completo de corridas</p>
    </div>

    {/* Summary */}
    <div className="flex gap-3 overflow-x-auto p-4 pb-0">
      {[
        { label: "Hoje", value: "R$ 29,32", sub: "2 corridas" },
        { label: "Semana", value: "R$ 128,50", sub: "8 corridas" },
        { label: "Mês", value: "R$ 542,00", sub: "34 corridas" },
      ].map((s) => (
        <div key={s.label} className="flex-1 min-w-[100px] rounded-xl border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="text-base font-bold">{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.sub}</p>
        </div>
      ))}
    </div>

    <div className="p-4 space-y-3">
      {rides.map((ride, i) => (
        <div key={ride.id} className="rounded-2xl border bg-card p-4 shadow-sm animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="text-sm font-bold">{ride.id}</span>
              <p className="text-xs text-muted-foreground">{ride.date}</p>
            </div>
            <StatusBadge status={ride.status} />
          </div>
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-primary" /><p className="text-sm">{ride.from}</p></div>
            <div className="ml-1 h-2 border-l border-dashed border-muted-foreground/30" />
            <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-destructive" /><p className="text-sm">{ride.to}</p></div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1"><Navigation className="h-3 w-3" />{ride.distance}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{ride.duration}</span>
            <span>{ride.passengers} pass.</span>
            {ride.rating > 0 && <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-warning" />{ride.rating}</span>}
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <div className="flex items-center gap-3">
              <div><p className="text-[10px] text-muted-foreground">Valor</p><p className="text-sm font-bold">{ride.price}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Taxa</p><p className="text-xs text-destructive">-{ride.fee}</p></div>
            </div>
            <div><p className="text-[10px] text-muted-foreground">Líquido</p><p className="text-base font-extrabold text-success">{ride.net}</p></div>
          </div>
        </div>
      ))}
    </div>

    <AppMenu role="driver" />
  </div>
);

export default DriverRides;
