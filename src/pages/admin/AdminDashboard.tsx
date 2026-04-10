import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, DollarSign, Settings, Shield, MapPin, AlertTriangle,
  Menu, X, ChevronRight, TrendingUp, Activity, Eye
} from "lucide-react";
import StatCard from "@/components/shared/StatCard";
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

const recentDrivers = [
  { name: "Carlos Mendes", cpf: "***-12", status: "approved" as const, rides: 342, rating: 4.9 },
  { name: "Ana Santos", cpf: "***-34", status: "pending" as const, rides: 0, rating: 0 },
  { name: "João Pereira", cpf: "***-56", status: "blocked" as const, rides: 128, rating: 4.2 },
];

const recentRides = [
  { id: "#1042", from: "Paulista", to: "Augusta", driver: "Carlos M.", price: "R$ 18,50", status: "completed" as const },
  { id: "#1041", from: "Morumbi", to: "GRU", driver: "Ana S.", price: "R$ 85,00", status: "active" as const },
  { id: "#1040", from: "Sé", to: "V. Madalena", driver: "João P.", price: "R$ 12,00", status: "cancelled" as const },
];

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-3 p-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground">UrbanGo</h1>
            <p className="text-[10px] text-sidebar-foreground/60">Painel Admin</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
              <h1 className="text-sm font-bold text-sidebar-foreground">UrbanGo Admin</h1>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5 text-sidebar-foreground" />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <header className="flex items-center gap-3 border-b bg-card p-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold">Dashboard</h2>
        </header>

        <div className="p-4 lg:p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Corridas hoje" value="1.247" icon={Car} trend={{ value: "+12%", positive: true }} variant="primary" />
            <StatCard title="Motoristas online" value="89" icon={Activity} variant="success" />
            <StatCard title="Receita hoje" value="R$ 4.850" icon={DollarSign} trend={{ value: "+8%", positive: true }} />
            <StatCard title="Fraudes detectadas" value="3" icon={AlertTriangle} variant="warning" />
          </div>

          {/* Tables */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Drivers */}
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-sm font-bold">Motoristas recentes</h3>
                <button onClick={() => navigate("/admin/drivers")} className="text-xs font-medium text-primary flex items-center gap-1">
                  Ver todos <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="divide-y">
                {recentDrivers.map((d) => (
                  <div key={d.cpf} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">CPF: {d.cpf} • {d.rides} corridas</p>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Rides */}
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-sm font-bold">Corridas recentes</h3>
                <button onClick={() => navigate("/admin/rides")} className="text-xs font-medium text-primary flex items-center gap-1">
                  Ver todas <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="divide-y">
                {recentRides.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">{r.id} • {r.driver}</p>
                      <p className="text-xs text-muted-foreground">{r.from} → {r.to}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{r.price}</p>
                      <StatusBadge status={r.status} />
                    </div>
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

export default AdminDashboard;
