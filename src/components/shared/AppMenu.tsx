import { useState } from "react";
import { Menu, Home, Clock, User, Wallet, MessageCircle, LogOut, Car, ArrowLeftRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type MenuRole = "passenger" | "driver";

interface MenuItem {
  icon: typeof Home;
  label: string;
  path: string;
}

const PASSENGER_ITEMS: MenuItem[] = [
  { icon: Home, label: "Início", path: "/passenger" },
  { icon: Clock, label: "Minhas corridas", path: "/passenger/history" },
  { icon: MessageCircle, label: "Chats", path: "/passenger/chats" },
  { icon: User, label: "Meus dados", path: "/passenger/profile" },
];

const DRIVER_ITEMS: MenuItem[] = [
  { icon: Home, label: "Início", path: "/driver" },
  { icon: Car, label: "Corridas", path: "/driver/rides" },
  { icon: Wallet, label: "Carteira", path: "/driver/wallet" },
  { icon: MessageCircle, label: "Chats", path: "/driver/chats" },
  { icon: User, label: "Meus dados", path: "/driver/profile" },
];

interface Props {
  role: MenuRole;
  /** Posição: por padrão fica fixo no topo esquerdo */
  floating?: boolean;
}

const AppMenu = ({ role, floating = true }: Props) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, roles, switchRole, profile } = useAuth();

  const items = role === "driver" ? DRIVER_ITEMS : PASSENGER_ITEMS;
  const hasBoth = roles.includes("driver") && roles.includes("passenger");

  const calcAge = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };
  const age = calcAge(profile?.birth_date);
  const isDriver = roles.includes("driver");
  const canBecomeDriver = role === "passenger" && !isDriver && age !== null && age >= 21;

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleSwitch = async (target: "passenger" | "driver") => {
    setOpen(false);
    await switchRole(target);
    navigate(target === "driver" ? "/driver" : "/passenger");
    toast.success(target === "driver" ? "Modo motorista" : "Modo passageiro");
  };

  const handleSignOut = async () => {
    setOpen(false);
    try {
      await signOut();
      toast.success("Você saiu da conta");
      navigate("/auth");
    } catch (e) {
      toast.error("Erro ao sair");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "flex items-center gap-2",
          floating && "fixed left-3 z-50"
        )}
        style={floating ? { top: "calc(env(safe-area-inset-top) + 0.75rem)" } : undefined}
      >
        <SheetTrigger asChild>
          <button
            aria-label="Abrir menu"
            className="flex h-11 items-center gap-2 rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border px-4 transition-transform active:scale-95 hover:bg-muted"
          >
            <Menu className="h-5 w-5 text-foreground" />
            <span className="font-display text-base font-extrabold text-gradient-primary leading-none select-none">
              Vamoo!
            </span>
          </button>
        </SheetTrigger>
      </div>

      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-left">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                {(user?.email?.[0] || "U").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  {user?.user_metadata?.full_name || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground truncate font-normal">
                  {user?.email}
                </p>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto p-2">
          {items.map((item) => {
            const active = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {canBecomeDriver && (
          <div className="border-t p-2">
            <p className="px-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase">Motorista</p>
            <button
              onClick={() => go("/passenger/become-driver")}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <Car className="h-4 w-4" />
              Quero ser motorista
            </button>
          </div>
        )}

        {hasBoth && (
          <div className="border-t p-2">
            <p className="px-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase">Modo</p>
            <button
              onClick={() => handleSwitch(role === "driver" ? "passenger" : "driver")}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <ArrowLeftRight className="h-4 w-4" />
              {role === "driver" ? "Mudar para passageiro" : "Mudar para motorista"}
            </button>
          </div>
        )}

        <div className="border-t p-2">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AppMenu;
