import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, DollarSign, Settings, AlertTriangle, MapPin,
  Menu, X, TrendingUp, ArrowDownLeft, ArrowUpRight, Wallet, Download
} from "lucide-react";
import StatCard from "@/components/shared/StatCard";

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

const transactions = [
  { id: 1, type: "income", label: "Taxas do dia", amount: "R$ 4.850,00", date: "10/04/2026", details: "1.247 corridas" },
  { id: 2, type: "recharge", label: "Recargas recebidas", amount: "R$ 12.500,00", date: "10/04/2026", details: "45 motoristas" },
  { id: 3, type: "income", label: "Taxas do dia", amount: "R$ 4.120,00", date: "09/04/2026", details: "1.089 corridas" },
  { id: 4, type: "recharge", label: "Recargas recebidas", amount: "R$ 9.800,00", date: "09/04/2026", details: "38 motoristas" },
  { id: 5, type: "income", label: "Taxas do dia", amount: "R$ 3.950,00", date: "08/04/2026", details: "1.012 corridas" },
];

const topDrivers = [
  { name: "Maria Lima", balance: "R$ 120,00", spent: "R$ 85,40", rides: 567 },
  { name: "Carlos Mendes", balance: "R$ 45,50", spent: "R$ 42,30", rides: 342 },
  { name: "João Pereira", balance: "R$ 12,30", spent: "R$ 28,10", rides: 128 },
];

const AdminFinance = () => {
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
          <h2 className="text-lg font-bold">Financeiro</h2>
          <button className="ml-auto flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"><Download className="h-3.5 w-3.5" /> Exportar</button>
        </header>

        <div className="p-4 lg:p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Receita hoje" value="R$ 4.850" icon={DollarSign} trend={{ value: "+18%", positive: true }} variant="primary" />
            <StatCard title="Receita mensal" value="R$ 98.500" icon={TrendingUp} trend={{ value: "+12%", positive: true }} variant="success" />
            <StatCard title="Recargas hoje" value="R$ 12.500" icon={ArrowDownLeft} subtitle="45 motoristas" />
            <StatCard title="Saldo total motoristas" value="R$ 8.240" icon={Wallet} />
          </div>

          {/* Revenue chart placeholder */}
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="font-bold mb-4">Receita dos últimos 7 dias</h3>
            <div className="flex items-end gap-2 h-40">
              {[65, 48, 72, 58, 80, 68, 85].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg bg-gradient-primary transition-all" style={{ height: `${h}%` }} />
                  <span className="text-[10px] text-muted-foreground">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Transactions */}
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className="p-4 border-b"><h3 className="text-sm font-bold">Movimentações recentes</h3></div>
              <div className="divide-y">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-4">
                    <div className={`rounded-lg p-2 ${tx.type === "income" ? "bg-success/10" : "bg-info/10"}`}>
                      {tx.type === "income" ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownLeft className="h-4 w-4 text-info" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{tx.label}</p>
                      <p className="text-xs text-muted-foreground">{tx.date} • {tx.details}</p>
                    </div>
                    <p className="text-sm font-bold">{tx.amount}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Top drivers */}
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className="p-4 border-b"><h3 className="text-sm font-bold">Top motoristas por saldo</h3></div>
              <div className="divide-y">
                {topDrivers.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-3 p-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.rides} corridas • Gasto em taxas: {d.spent}</p>
                    </div>
                    <p className="text-sm font-bold text-success">{d.balance}</p>
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

export default AdminFinance;
