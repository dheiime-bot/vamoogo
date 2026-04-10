import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, DollarSign, Settings, AlertTriangle, MapPin,
  Menu, X, Activity, Wifi
} from "lucide-react";
import MapPlaceholder from "@/components/shared/MapPlaceholder";
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

const activeRides = [
  { id: "#1041", driver: "Ana S.", passenger: "João L.", from: "Morumbi", to: "GRU", status: "active" as const, eta: "32 min" },
  { id: "#1043", driver: "Carlos M.", passenger: "Maria S.", from: "Paulista", to: "Pinheiros", status: "active" as const, eta: "8 min" },
  { id: "#1044", driver: "Pedro R.", passenger: "Carla D.", from: "Brooklin", to: "Moema", status: "active" as const, eta: "5 min" },
];

const onlineDrivers = [
  { name: "Carlos Mendes", location: "Av. Paulista", category: "Carro", status: "online" as const },
  { name: "Ana Santos", location: "Morumbi (em corrida)", category: "Premium", status: "online" as const },
  { name: "Maria Lima", location: "Pinheiros", category: "Premium", status: "online" as const },
  { name: "Pedro Rosa", location: "Brooklin (em corrida)", category: "Moto", status: "online" as const },
  { name: "Lucas Alves", location: "Liberdade", category: "Carro", status: "online" as const },
];

const AdminLive = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden lg:flex w-64 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-3 p-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary"><Car className="h-5 w-5 text-primary-foreground" /></div>
          <div><h1 className="text-sm font-bold text-sidebar-foreground">UrbanGo</h1><p className="text-[10px] text-sidebar-foreground/60">Painel Admin</p></div>
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
              <h1 className="text-sm font-bold text-sidebar-foreground">UrbanGo</h1>
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
          <h2 className="text-lg font-bold">Mapa ao Vivo</h2>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium text-success">Tempo real</span>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-6 space-y-6">
          {/* Stats bar */}
          <div className="flex gap-4 overflow-x-auto pb-1">
            {[
              { label: "Motoristas online", value: "89", color: "text-success" },
              { label: "Corridas ativas", value: "34", color: "text-info" },
              { label: "Aguardando", value: "12", color: "text-warning" },
              { label: "Demanda", value: "1.3x", color: "text-accent" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 whitespace-nowrap">
                <span className={`text-lg font-extrabold ${s.color}`}>{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Map */}
          <div className="relative">
            <MapPlaceholder className="h-[350px] lg:h-[450px]" />
            {/* Simulated driver pins */}
            <div className="absolute top-1/4 left-1/3 flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-glow animate-pulse-slow">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="absolute top-1/2 left-2/3 flex h-8 w-8 items-center justify-center rounded-full bg-accent shadow-md">
              <Car className="h-4 w-4 text-accent-foreground" />
            </div>
            <div className="absolute top-2/3 left-1/4 flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-glow">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Active rides */}
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className="p-4 border-b flex items-center gap-2">
                <Activity className="h-4 w-4 text-info" />
                <h3 className="text-sm font-bold">Corridas ativas</h3>
              </div>
              <div className="divide-y">
                {activeRides.map((r) => (
                  <div key={r.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold">{r.id}</span>
                      <span className="text-xs font-medium text-info">ETA: {r.eta}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.driver} → {r.passenger}</p>
                    <p className="text-xs text-muted-foreground">{r.from} → {r.to}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Online drivers */}
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className="p-4 border-b flex items-center gap-2">
                <Wifi className="h-4 w-4 text-success" />
                <h3 className="text-sm font-bold">Motoristas online</h3>
              </div>
              <div className="divide-y">
                {onlineDrivers.map((d) => (
                  <div key={d.name} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.location}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">{d.category}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLive;
