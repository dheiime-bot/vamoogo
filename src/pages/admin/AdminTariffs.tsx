import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, DollarSign, Settings, AlertTriangle, MapPin,
  Menu, X, Save, Bike, Crown
} from "lucide-react";

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

const AdminTariffs = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("categories");
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: "categories", label: "Categorias" },
    { id: "regions", label: "Regiões" },
    { id: "passengers", label: "Passageiros" },
    { id: "dynamic", label: "Dinâmico" },
    { id: "fees", label: "Taxas" },
  ];

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
          <h2 className="text-lg font-bold">Configuração de Tarifas</h2>
        </header>

        <div className="p-4 lg:p-6 space-y-6">
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "categories" && (
            <div className="space-y-4">
              {[
                { icon: Bike, name: "Moto", base: "3,00", km: "1,20", min: "0,30", minFare: "8,00" },
                { icon: Car, name: "Carro", base: "5,00", km: "1,80", min: "0,45", minFare: "12,00" },
                { icon: Crown, name: "Premium", base: "8,00", km: "2,50", min: "0,60", minFare: "18,00" },
              ].map((cat) => (
                <div key={cat.name} className="rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                      <cat.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-base font-bold">{cat.name}</h3>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: "Taxa base", value: cat.base },
                      { label: "Por KM", value: cat.km },
                      { label: "Por minuto", value: cat.min },
                      { label: "Tarifa mínima", value: cat.minFare },
                    ].map((field) => (
                      <div key={field.label}>
                        <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                        <div className="mt-1 flex items-center rounded-lg border bg-background px-3 py-2">
                          <span className="text-sm text-muted-foreground mr-1">R$</span>
                          <input
                            type="text"
                            defaultValue={field.value}
                            className="flex-1 bg-transparent text-sm font-semibold outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "regions" && (
            <div className="space-y-4">
              {[
                { name: "Centro", multiplier: "1.0" },
                { name: "Periferia", multiplier: "0.85" },
                { name: "Rural", multiplier: "1.2" },
              ].map((region) => (
                <div key={region.name} className="flex items-center justify-between rounded-2xl border bg-card p-4">
                  <div>
                    <p className="font-semibold">{region.name}</p>
                    <p className="text-xs text-muted-foreground">Multiplicador de tarifa</p>
                  </div>
                  <div className="flex items-center rounded-lg border bg-background px-3 py-2">
                    <input
                      type="text"
                      defaultValue={region.multiplier}
                      className="w-16 bg-transparent text-center text-sm font-bold outline-none"
                    />
                    <span className="text-sm text-muted-foreground">x</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "passengers" && (
            <div className="rounded-2xl border bg-card p-5">
              <h3 className="font-bold mb-4">Adicional por passageiro</h3>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{n} passageiro{n > 1 ? "s" : ""}</span>
                    <div className="flex items-center rounded-lg border bg-background px-3 py-2">
                      <span className="text-sm text-muted-foreground mr-1">+R$</span>
                      <input
                        type="text"
                        defaultValue={n === 1 ? "0,00" : ((n - 1) * 2).toFixed(2).replace(".", ",")}
                        className="w-16 bg-transparent text-sm font-bold outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "dynamic" && (
            <div className="rounded-2xl border bg-card p-5">
              <h3 className="font-bold mb-4">Multiplicador por demanda</h3>
              <div className="space-y-4">
                {[
                  { label: "Demanda baixa", range: "0-30%", value: "1.0" },
                  { label: "Demanda média", range: "30-60%", value: "1.3" },
                  { label: "Demanda alta", range: "60-80%", value: "1.6" },
                  { label: "Demanda extrema", range: "80-100%", value: "2.0" },
                ].map((level) => (
                  <div key={level.label} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{level.label}</p>
                      <p className="text-xs text-muted-foreground">{level.range}</p>
                    </div>
                    <div className="flex items-center rounded-lg border bg-background px-3 py-2">
                      <input
                        type="text"
                        defaultValue={level.value}
                        className="w-12 bg-transparent text-center text-sm font-bold outline-none"
                      />
                      <span className="text-sm text-muted-foreground">x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "fees" && (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-bold">Taxa da plataforma (% por corrida)</h3>
              <div className="space-y-3">
                {[
                  { label: "Taxa global", value: "15" },
                  { label: "Moto", value: "12" },
                  { label: "Carro", value: "15" },
                  { label: "Premium", value: "18" },
                ].map((fee) => (
                  <div key={fee.label} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{fee.label}</span>
                    <div className="flex items-center rounded-lg border bg-background px-3 py-2">
                      <input
                        type="text"
                        defaultValue={fee.value}
                        className="w-12 bg-transparent text-center text-sm font-bold outline-none"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow">
            <Save className="h-4 w-4" /> Salvar configurações
          </button>
        </div>
      </main>
    </div>
  );
};

export default AdminTariffs;
