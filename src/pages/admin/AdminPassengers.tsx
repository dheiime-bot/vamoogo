import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, DollarSign, Settings, AlertTriangle, MapPin,
  Menu, X, Search, Filter, Eye, Ban, CheckCircle, Mail, Phone
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

const passengers = [
  { id: 1, name: "Maria Silva", cpf: "123.456.789-12", phone: "(11) 99999-0000", email: "maria@email.com", status: "approved" as const, rides: 45, selfie: true, phoneVerified: true },
  { id: 2, name: "João Santos", cpf: "234.567.890-34", phone: "(11) 98888-1111", email: "joao@email.com", status: "approved" as const, rides: 128, selfie: true, phoneVerified: true },
  { id: 3, name: "Ana Lima", cpf: "345.678.901-56", phone: "(21) 97777-2222", email: "ana@email.com", status: "pending" as const, rides: 0, selfie: false, phoneVerified: true },
  { id: 4, name: "Pedro Costa", cpf: "456.789.012-78", phone: "(31) 96666-3333", email: "pedro@email.com", status: "blocked" as const, rides: 12, selfie: true, phoneVerified: true },
  { id: 5, name: "Carla Dias", cpf: "567.890.123-90", phone: "(41) 95555-4444", email: "carla@email.com", status: "approved" as const, rides: 67, selfie: true, phoneVerified: true },
];

const AdminPassengers = () => {
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
          <h2 className="text-lg font-bold">Passageiros</h2>
          <span className="ml-auto text-sm text-muted-foreground">{passengers.length} registrados</span>
        </header>

        <div className="p-4 lg:p-6">
          <div className="flex gap-2 mb-4">
            <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input placeholder="Buscar por nome, CPF ou email..." className="flex-1 bg-transparent text-sm outline-none" />
            </div>
            <button className="flex items-center gap-1 rounded-xl border bg-card px-3 py-2 text-sm font-medium"><Filter className="h-4 w-4" /> Filtrar</button>
          </div>

          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Passageiro</th>
                    <th className="px-4 py-3 text-left font-semibold">CPF</th>
                    <th className="px-4 py-3 text-left font-semibold">Contato</th>
                    <th className="px-4 py-3 text-left font-semibold">Corridas</th>
                    <th className="px-4 py-3 text-left font-semibold">Verificações</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {passengers.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.cpf}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs">{p.phone}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </td>
                      <td className="px-4 py-3">{p.rides}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${p.selfie ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>Selfie</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${p.phoneVerified ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>OTP</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button className="rounded-lg p-1.5 hover:bg-muted"><Eye className="h-4 w-4 text-muted-foreground" /></button>
                          <button className="rounded-lg p-1.5 hover:bg-muted"><Ban className="h-4 w-4 text-destructive" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y">
              {passengers.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.email} • {p.rides} corridas</p></div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex gap-1">
                    <button className="rounded-lg p-1.5 bg-muted"><Eye className="h-4 w-4" /></button>
                    <button className="rounded-lg p-1.5 bg-destructive/10"><Ban className="h-4 w-4 text-destructive" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPassengers;
