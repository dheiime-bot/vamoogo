import { useEffect, useState } from "react";
import { Menu, Home, Clock, User, MessageCircle, LogOut, Car, Star, TicketPercent, Heart, Lock, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import vamooLogo from "@/assets/vamoo-logo-menu.png";
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
import SelectVehicleModal from "@/components/driver/SelectVehicleModal";
import UserAvatar from "@/components/shared/UserAvatar";

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
  { icon: TicketPercent, label: "Cupons", path: "/passenger/coupons" },
  { icon: Heart, label: "Motoristas favoritos", path: "/passenger/favorites" },
  { icon: User, label: "Meus dados", path: "/passenger/profile" },
  { icon: Lock, label: "Alterar senha", path: "/passenger/change-password" },
  { icon: Settings, label: "Configurações", path: "/passenger/settings" },
];

const DRIVER_ITEMS: MenuItem[] = [
  { icon: Home, label: "Início", path: "/driver" },
  { icon: Car, label: "Corridas", path: "/driver/rides" },
  { icon: Car, label: "Meus veículos", path: "/driver/vehicles" },
  { icon: MessageCircle, label: "Chats", path: "/driver/chats" },
  { icon: User, label: "Meus dados", path: "/driver/profile" },
  { icon: Settings, label: "Configurações", path: "/driver/settings" },
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
  const { user, signOut, roles, profile } = useAuth();
  const [driverRating, setDriverRating] = useState<number | null>(null);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const items = role === "driver" ? DRIVER_ITEMS : PASSENGER_ITEMS;

  // Busca a nota do motorista quando estiver no modo motorista
  useEffect(() => {
    if (role !== "driver" || !user?.id) return;
    supabase.from("drivers").select("rating").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.rating != null) setDriverRating(Number(data.rating)); });
  }, [role, user?.id]);

  // Conta quantos veículos aprovados o motorista tem (para mostrar "Selecionar veículo")
  useEffect(() => {
    if (role !== "driver" || !user?.id) return;
    supabase
      .from("driver_vehicles")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", user.id)
      .eq("status", "approved")
      .then(({ count }) => setVehicleCount(count || 0));
  }, [role, user?.id]);

  const ratingToShow = role === "driver" ? driverRating : (profile?.rating ?? null);

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
    // Aguarda o sheet fechar antes de navegar para evitar conflitos de animação/foco
    setTimeout(() => navigate(path), 0);
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
            style={{ backgroundColor: "#f4fafa" }}
            className="flex h-16 items-center gap-2 rounded-full backdrop-blur-md shadow-md border border-border px-4 transition-transform active:scale-95 hover:opacity-90"
          >
            <Menu className="h-5 w-5 text-foreground" />
            <img
              src={vamooLogo}
              alt="Vamoo"
              className="h-12 w-auto select-none object-contain"
              draggable={false}
            />
          </button>
        </SheetTrigger>
      </div>

        <SheetContent side="left" className="w-80 p-0 flex flex-col">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-left">
            <div className="flex items-center gap-3">
              <UserAvatar
                src={profile?.selfie_url || profile?.selfie_signup_url}
                name={profile?.full_name || user?.user_metadata?.full_name || "Usuário"}
                role={role}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-extrabold truncate">
                  {profile?.full_name || user?.user_metadata?.full_name || "Usuário"}
                </p>
                <p className="text-lg text-muted-foreground truncate font-normal leading-tight">
                  {user?.email}
                </p>
                {ratingToShow != null && (
                  <div className="mt-1 flex items-center gap-1">
                    <Star className="h-5 w-5 text-warning fill-warning" />
                    <span className="text-lg font-bold text-foreground">
                      {ratingToShow.toFixed(2)}
                    </span>
                    <span className="text-lg text-muted-foreground font-normal">
                      / 5,00
                    </span>
                  </div>
                )}
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
                  "w-full flex items-center gap-3 rounded-xl px-4 py-4 text-lg font-extrabold transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
          {role === "driver" && vehicleCount >= 2 && (
            <button
              onClick={() => { setOpen(false); setTimeout(() => setShowVehicleModal(true), 0); }}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-4 text-lg font-extrabold text-foreground hover:bg-muted transition-colors"
            >
              <Car className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">Selecionar veículo</span>
            </button>
          )}
        </nav>

        {canBecomeDriver && (
          <div className="border-t p-2">
            <p className="px-2 pb-1 text-xs font-extrabold text-muted-foreground uppercase">Motorista</p>
            <button
              onClick={() => go("/passenger/become-driver")}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-4 text-lg font-extrabold text-primary hover:bg-primary/10 transition-colors"
            >
              <Car className="h-5 w-5" />
              Quero ser motorista
            </button>
          </div>
        )}

        <div className="border-t p-2">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-4 text-lg font-extrabold text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sair da conta
          </button>
        </div>
      </SheetContent>
      {role === "driver" && (
        <SelectVehicleModal open={showVehicleModal} onOpenChange={setShowVehicleModal} />
      )}
    </Sheet>
  );
};

export default AppMenu;
