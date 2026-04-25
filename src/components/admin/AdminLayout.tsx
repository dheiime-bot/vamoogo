import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, DollarSign, Settings, AlertTriangle, MapPin,
  Headphones, ScrollText, Megaphone, Ticket, BarChart3, LogOut,
  Search, Bell, Moon, Sun, RefreshCw, ChevronDown, ChevronRight, User,
  Briefcase, Headset, MessageCircle, ShieldCheck, UserCog, KeyRound, LifeBuoy, Mail, Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMaster } from "@/hooks/usePermission";
import { useUrgentTicketsAlert } from "@/hooks/useUrgentTicketsAlert";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import VamooLogo from "@/components/shared/VamooLogo";

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path?: string;
  badge?: number;
  children?: { label: string; path: string }[];
}

const baseNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  {
    icon: MapPin,
    label: "Operação",
    children: [
      { label: "Mapa ao vivo", path: "/admin/live" },
      { label: "Corridas", path: "/admin/rides" },
      { label: "Cancelamentos", path: "/admin/cancellations" },
      { label: "Recursos de avaliação", path: "/admin/appeals" },
    ],
  },
  {
    icon: Users,
    label: "Pessoas e frota",
    children: [
      { label: "Motoristas", path: "/admin/drivers" },
      { label: "Passageiros", path: "/admin/passengers" },
      { label: "Veículos", path: "/admin/vehicles" },
      { label: "Mudanças de veículo", path: "/admin/vehicle-requests" },
    ],
  },
  {
    icon: DollarSign,
    label: "Financeiro",
    children: [
      { label: "Resumo financeiro", path: "/admin/finance" },
      { label: "Recarga de carteira", path: "/admin/wallet-topup" },
      { label: "Tarifas", path: "/admin/tariffs" },
    ],
  },
  {
    icon: Headphones,
    label: "Atendimento",
    children: [
      { label: "Suporte", path: "/admin/support" },
      { label: "Chats", path: "/admin/chats" },
    ],
  },
  {
    icon: Megaphone,
    label: "Marketing",
    children: [
      { label: "Campanhas", path: "/admin/campaigns" },
      { label: "Cupons", path: "/admin/coupons" },
    ],
  },
  {
    icon: ShieldCheck,
    label: "Controle",
    children: [
      { label: "Antifraude", path: "/admin/fraud" },
      { label: "Relatórios", path: "/admin/reports" },
      { label: "Logs", path: "/admin/audit" },
      { label: "Regras de cancelamento", path: "/admin/settings/cancellations" },
    ],
  },
];

interface AdminLayoutProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const AppSidebar = ({ supportOpen, supportUrgent }: { supportOpen: number; supportUrgent: number }) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const isMaster = useIsMaster();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (children: { path: string }[]) =>
    children.some((c) => isActive(c.path));

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      {/* Header / Brand — Logo Vamoo */}
      <SidebarHeader className="border-b border-sidebar-border">
        <NavLink
          to="/admin"
          className={`flex items-center px-2 py-3 ${collapsed ? "justify-center" : "justify-center"}`}
          aria-label="Vamoo Admin"
        >
          {collapsed ? (
            <VamooLogo height={64} card={false} className="shrink-0" />
          ) : (
            <VamooLogo height={104} card={false} className="shrink-0" />
          )}
        </NavLink>

        {/* Search */}
        {!collapsed ? (
          <div className="mx-2 mb-2 flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              placeholder="Buscar"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </div>
        ) : (
          <div className="flex justify-center pb-2">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sidebar-accent">
              <Search className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="overflow-hidden hover:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {baseNavItems.map((item) => {
                if (item.children) {
                  const open = isGroupActive(item.children);
                  return (
                    <Collapsible
                      key={item.label}
                      defaultOpen={open}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.label}
                            className="data-[state=open]:bg-sidebar-accent"
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                            <ChevronRight className="ml-auto h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children.map((child) => (
                              <SidebarMenuSubItem key={child.path}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isActive(child.path)}
                                >
                                  <NavLink to={child.path}>
                                    <span>{child.label}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                const isSupport = item.path === "/admin/support";
                const badgeNum = isSupport ? supportOpen : item.badge;
                const isUrgent = isSupport && supportUrgent > 0;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      isActive={isActive(item.path!)}
                    >
                      <NavLink to={item.path!} end>
                        <item.icon className={`h-4 w-4 ${isUrgent ? "text-destructive" : ""}`} />
                        <span>{item.label}</span>
                        {badgeNum ? (
                          <span className={`ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                            isUrgent
                              ? "bg-destructive text-destructive-foreground animate-pulse"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {badgeNum}
                          </span>
                        ) : null}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {isMaster && (
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Funcionários" asChild isActive={isActive("/admin/staff")}>
                    <NavLink to="/admin/staff">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Funcionários</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Conta" asChild>
                  <NavLink to="/admin">
                    <User className="h-4 w-4" />
                    <span>Conta</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {!collapsed && (
          <div className="rounded-xl border bg-background p-3 mb-2">
            <div className="mb-1.5 flex items-center gap-2">
              <Headset className="h-4 w-4 text-foreground" />
              <span className="text-xs font-semibold">Precisa de ajuda?</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Fale com nosso suporte
            </p>
            <Button variant="outline" size="sm" className="h-7 w-full text-xs">
              Contato
            </Button>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Sair">
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

const AdminLayout = ({ title, children, actions }: AdminLayoutProps) => {
  const [darkMode, setDarkMode] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const { profile, user, signOut } = useAuth();
  const isMaster = useIsMaster();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const displayName = profile?.full_name || "Admin";
  const { openCount: supportOpen, urgentCount: supportUrgent } = useUrgentTicketsAlert();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar supportOpen={supportOpen} supportUrgent={supportUrgent} />

        <main className="flex-1 overflow-auto">
          {/* Top bar */}
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card px-4 py-3">
            <SidebarTrigger />

            {/* Search */}
            <div className="hidden sm:flex flex-1 max-w-md items-center gap-2 rounded-xl bg-muted px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Busca global..."
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
                {darkMode ? (
                  <Sun className="h-4 w-4 text-warning" />
                ) : (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <button className="rounded-xl p-2 hover:bg-muted transition-colors">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="hidden sm:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-xl border px-3 py-1.5 ml-1 hover:bg-muted transition-colors">
                      <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <span className="text-sm font-medium">{displayName}</span>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 z-50 bg-popover">
                    <DropdownMenuLabel className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">{displayName}</span>
                      {user?.email && (
                        <span className="text-xs font-normal text-muted-foreground truncate">
                          {user.email}
                        </span>
                      )}
                      <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <ShieldCheck className="h-3 w-3" />
                        {isMaster ? "Master Admin" : "Admin"}
                      </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <UserCog className="mr-2 h-4 w-4" />
                      <span>Minha conta</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/admin/tariffs")}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Configurações</span>
                    </DropdownMenuItem>
                    {isMaster && (
                      <DropdownMenuItem onClick={() => navigate("/admin/staff")}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        <span>Funcionários</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate("/auth/reset-password")}>
                      <KeyRound className="mr-2 h-4 w-4" />
                      <span>Alterar senha</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setDarkMode(!darkMode)}>
                      {darkMode ? (
                        <Sun className="mr-2 h-4 w-4" />
                      ) : (
                        <Moon className="mr-2 h-4 w-4" />
                      )}
                      <span>{darkMode ? "Tema claro" : "Tema escuro"}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/admin/support")}>
                      <LifeBuoy className="mr-2 h-4 w-4" />
                      <span>Suporte</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sair</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Page title (desktop) */}
          <div className="hidden sm:block px-6 pt-5 pb-2">
            <h2 className="text-2xl font-bold font-display">{title}</h2>
          </div>

          <div className="p-4 lg:px-6 space-y-5">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
