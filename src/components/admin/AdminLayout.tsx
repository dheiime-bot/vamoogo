import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, DollarSign, Settings, AlertTriangle, MapPin,
  Menu, X, Headphones, ScrollText, Megaphone, Ticket, BarChart3, LogOut,
  Search, Bell, Moon, Sun, RefreshCw, ChevronDown, User
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Car, label: "Corridas", path: "/admin/rides" },
  { icon: Users, label: "Motoristas", path: "/admin/drivers" },
  { icon: Users, label: "Passageiros", path: "/admin/passengers" },
  { icon: DollarSign, label: "Financeiro", path: "/admin/finance" },
  { icon: BarChart3, label: "BI", path: "/admin/reports" },
  { icon: MapPin, label: "Mapa", path: "/admin/live" },
  { icon: Headphones, label: "Suporte", path: "/admin/support" },
  { icon: Megaphone, label: "Growth", path: "/admin/campaigns" },
  { icon: Ticket, label: "Cupons", path: "/admin/coupons" },
  { icon: AlertTriangle, label: "Antifraude", path: "/admin/fraud" },
  { icon: Settings, label: "Tarifas", path: "/admin/tariffs" },
  { icon: ScrollText, label: "Logs", path: "/admin/audit" },
];

interface AdminLayoutProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const AdminLayout = ({ title, children, actions }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, profile } = useAuth();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const displayName = profile?.full_name || "Admin";

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 p-5 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary">
          <Car className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold font-display text-sidebar-foreground tracking-tight">
            Vam<span className="text-sidebar-primary">oo</span>
          </h1>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {sidebarItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); onNavigate?.(); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
      {/* CTA bottom */}
      <div className="p-4 m-3 rounded-2xl bg-gradient-primary">
        <p className="text-sm font-bold text-primary-foreground">Chamou, Vamoo!</p>
        <p className="text-xs text-primary-foreground/70 mt-0.5">Painel Administrativo</p>
      </div>
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-sidebar shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar animate-fade-in flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
              <h1 className="text-sm font-bold font-display text-sidebar-foreground">Vamoo Admin</h1>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5 text-sidebar-foreground" />
              </button>
            </div>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          
          {/* Search */}
          <div className="hidden sm:flex flex-1 max-w-md items-center gap-2 rounded-xl bg-muted px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Global unn search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          
          <div className="flex-1 sm:hidden">
            <h2 className="text-lg font-bold">{title}</h2>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <button className="relative rounded-xl p-2 hover:bg-muted transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="rounded-xl p-2 hover:bg-muted transition-colors"
            >
              {darkMode ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </button>
            <button className="rounded-xl p-2 hover:bg-muted transition-colors">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
            {/* User avatar */}
            <div className="hidden sm:flex items-center gap-2 rounded-xl border px-3 py-1.5 ml-1">
              <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium">{displayName}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        </header>

        {/* Page title (desktop) */}
        <div className="hidden sm:block px-6 pt-5 pb-2">
          <h2 className="text-2xl font-bold font-display">{title}</h2>
        </div>
        
        <div className="p-4 lg:px-6 space-y-5">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
