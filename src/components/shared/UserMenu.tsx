/**
 * UserMenu — botão flutuante no canto superior direito (ao lado do sino "Avisos").
 * Mostra avatar do usuário e abre menu com:
 *   - Meus dados (vai para a página de perfil do papel ativo)
 *   - Sair da conta
 */
import { useNavigate } from "react-router-dom";
import { User as UserIcon, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  /** "passenger" | "driver" — define para onde "Meus dados" leva. */
  role: "passenger" | "driver";
  /** Quando true, posiciona como botão fixo absoluto no topo direito. */
  floating?: boolean;
}

const UserMenu = ({ role, floating = true }: Props) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  if (!user) return null;

  const initial = (user.user_metadata?.full_name?.[0] || user.email?.[0] || "U").toUpperCase();
  const displayName = user.user_metadata?.full_name || user.email || "Usuário";

  const handleProfile = () => {
    navigate(role === "driver" ? "/driver/profile" : "/passenger/profile");
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Você saiu da conta");
      navigate("/auth");
    } catch {
      toast.error("Erro ao sair");
    }
  };

  return (
    <div
      className={cn(floating && "fixed right-16 z-50")}
      style={floating ? { top: "calc(env(safe-area-inset-top) + 0.75rem)" } : undefined}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Menu da conta"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border transition-transform active:scale-95 hover:bg-muted"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
              {initial}
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8} className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold truncate">{displayName}</span>
            <span className="text-xs text-muted-foreground truncate font-normal">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleProfile} className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" />
            Meus dados
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default UserMenu;
