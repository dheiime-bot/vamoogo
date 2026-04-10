import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, DollarSign, Settings, AlertTriangle, MapPin,
  Menu, X, Search, Filter, Eye, Navigation, Clock
} from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Users, label: "Motoristas", path: "/admin/drivers" },
  { icon: Users, label: "Passageiros", path: "/admin/passengers" },
  { icon: Car, label: "Corridas", path: "/admin/rides" },
  { icon: DollarSign, label: "Financeiro", path: "/admin/finance" },
  { icon: Settings, label: "Tarifas", path: "/admin/tariffs" },
  { icon: AlertTriangle, label: "Antifraude", path: "/admin/fraud" },
  { icon: MapPin, label: "Mapa ao vivo", path: "/admin/live" },
];

const rides = [
  { id: "#1042", from: "Av. Paulista, 1000", to: "Rua Augusta, 500", driver: "Carlos M.", passenger: "Maria S.", price: "R$ 18,50", fee: "R$ 2,78", date: "10/04/2026, 14:35", status: "completed" as const, category: "Carro", distance: "3.2km", duration: "12min", passengers: 1 },
  { id: "#1041", from: "Shopping Morumbi", to: "Aeroporto GRU", driver: "Ana S.", passenger: "João L.", price: "R$ 85,00", fee: "R$ 12,75", date: "10/04/2026, 13:20", status: "active" as const, category: "Premium", distance: "28.5km", duration: "45min", passengers: 2 },
  { id: "#1040", from: "Estação Sé", to: "Vila Madalena", driver: "João P.", passenger: "Ana C.", price: "R$ 12,00", fee: "R$ 1,44", date: "10/04/2026, 12:10", status: "cancelled" as const, category: "Moto", distance: "5.8km", duration: "18min", passengers: 1 },
  { id: "#1039", from: "Pinheiros", to: "Brooklin", driver: "Maria L.", passenger: "Pedro R.", price: "R$ 22,00", fee: "R$ 3,96", date: "10/04/2026, 11:45", status: "completed" as const, category: "Carro", distance: "4.1km", duration: "15min", passengers: 3 },
  { id: "#1038", from: "Liberdade", to: "Mooca", driver: "Carlos M.", passenger: "Carla D.", price: "R$ 16,00", fee: "R$ 2,40", date: "10/04/2026, 10:00", status: "completed" as const, category: "Carro", distance: "6.2km", duration: "22min", passengers: 1 },
];

const AdminRides = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden lg:flex w-64 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-3 p-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary"><Car className="h-5 w-5 text-primary-foreground" /></div>
          <div><h1 className="text-sm font-bold text-sidebar-foreground">Vamoo</h1><p className="text-[10px] text-sidebar-foreground/60">Painel Admin</p></div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button key={item.path} onClick={() => navigate(item.path)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${location.pathname === item.path ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent"}`}>
              <item.icon className="h-4 w-4" />{item.label}
            </button>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
              <h1 className="text-sm font-bold text-sidebar-foreground">Vamoo</h1>
              <button onClick={() => setSidebarOpen(false)}><X className="h-5 w-5 text-sidebar-foreground" /></button>
            </div>
            <nav className="p-3 space-y-1">
              {sidebarItems.map((item) => (
                <button key={item.path} onClick={() => { navigate(item.path); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${location.pathname === item.path ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70"}`}>
                  <item.icon className="h-4 w-4" />{item.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto">
        <header className="flex items-center gap-3 border-b bg-card p-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu className="h-5 w-5" /></button>
          <h2 className="text-lg font-bold">Corridas</h2>
        </header>

        <div className="p-4 lg:p-6">
          <div className="flex gap-2 mb-4">
            <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input placeholder="Buscar por ID, motorista ou passageiro..." className="flex-1 bg-transparent text-sm outline-none" />
            </div>
            <button className="flex items-center gap-1 rounded-xl border bg-card px-3 py-2 text-sm font-medium"><Filter className="h-4 w-4" /> Filtrar</button>
          </div>

          <div className="space-y-3">
            {rides.map((ride, i) => (
              <div key={ride.id} className="rounded-2xl border bg-card p-4 shadow-sm animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{ride.id}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">{ride.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{ride.date}</p>
                  </div>
                  <StatusBadge status={ride.status} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Rota</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-primary" /><p className="text-sm">{ride.from}</p></div>
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-destructive" /><p className="text-sm">{ride.to}</p></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-xs text-muted-foreground">Motorista</p><p className="text-sm font-medium">{ride.driver}</p></div>
                    <div><p className="text-xs text-muted-foreground">Passageiro</p><p className="text-sm font-medium">{ride.passenger}</p></div>
                    <div><p className="text-xs text-muted-foreground">Distância</p><p className="text-sm font-medium">{ride.distance}</p></div>
                    <div><p className="text-xs text-muted-foreground">Duração</p><p className="text-sm font-medium">{ride.duration}</p></div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <div className="flex items-center gap-4">
                    <div><p className="text-xs text-muted-foreground">Valor</p><p className="text-base font-bold">{ride.price}</p></div>
                    <div><p className="text-xs text-muted-foreground">Taxa</p><p className="text-sm font-semibold text-primary">{ride.fee}</p></div>
                    <div><p className="text-xs text-muted-foreground">Passageiros</p><p className="text-sm font-medium">{ride.passengers}</p></div>
                  </div>
                  <button className="rounded-lg p-2 hover:bg-muted"><Eye className="h-4 w-4 text-muted-foreground" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminRides;
