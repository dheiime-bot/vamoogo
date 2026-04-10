import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, DollarSign, Settings, AlertTriangle, MapPin,
  Menu, X, Eye, Shield
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

const fraudAlerts = [
  {
    id: 1, driver: "Carlos Mendes", date: "10/04/2026, 15:42",
    description: "Cancelou corrida #1039 e GPS permaneceu na região de origem por 18 min com trajeto similar",
    level: "suspicious" as const, severity: "Fraude provável",
    details: "Distância GPS pós-cancelamento: 2.8km • Rota 87% similar • Tempo compatível: 14min",
  },
  {
    id: 2, driver: "João Pereira", date: "09/04/2026, 20:15",
    description: "Cancelou corrida #1035, GPS próximo ao destino 22 min após cancelamento",
    level: "suspicious" as const, severity: "Suspeita moderada",
    details: "Distância GPS pós-cancelamento: 4.1km • Rota 62% similar • Tempo compatível: 20min",
  },
  {
    id: 3, driver: "Pedro Costa", date: "08/04/2026, 12:30",
    description: "3 cancelamentos consecutivos, sem padrão claro de fraude",
    level: "suspicious" as const, severity: "Suspeita leve",
    details: "Cancelamentos em sequência, GPS sem correspondência com rotas canceladas",
  },
];

const AdminFraud = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden lg:flex w-64 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-3 p-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground">Vamoo</h1>
            <p className="text-[10px] text-sidebar-foreground/60">Painel Admin</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button key={item.path} onClick={() => navigate(item.path)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                location.pathname === item.path ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
              }`}
            >
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
                <button key={item.path} onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    location.pathname === item.path ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70"
                  }`}
                >
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
          <h2 className="text-lg font-bold">Sistema Antifraude</h2>
          <div className="ml-auto flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Monitoramento ativo</span>
          </div>
        </header>

        <div className="p-4 lg:p-6 space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-warning/10 border border-warning/30 p-4">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm">
              <span className="font-semibold text-warning">{fraudAlerts.length} alertas</span> de fraude detectados esta semana.
              O sistema monitora GPS por 30 minutos após cada cancelamento.
            </p>
          </div>

          {fraudAlerts.map((alert, i) => (
            <div
              key={alert.id}
              className="rounded-2xl border bg-card p-5 shadow-sm animate-slide-up"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold">{alert.driver}</p>
                  <p className="text-xs text-muted-foreground">{alert.date}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  alert.severity === "Fraude provável"
                    ? "bg-destructive/15 text-destructive"
                    : alert.severity === "Suspeita moderada"
                    ? "bg-warning/15 text-warning"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {alert.severity}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{alert.description}</p>
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground mb-4">
                {alert.details}
              </div>
              <div className="flex gap-2">
                <button className="flex-1 rounded-lg border py-2 text-xs font-semibold hover:bg-muted">
                  <Eye className="mr-1 inline h-3.5 w-3.5" /> Investigar
                </button>
                <button className="rounded-lg bg-warning/10 px-4 py-2 text-xs font-semibold text-warning">
                  Penalizar
                </button>
                <button className="rounded-lg bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive">
                  Bloquear
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminFraud;
