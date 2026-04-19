/**
 * DriverBottomNav — barra inferior do motorista, transparente, com botões em pílula.
 * Sobrepõe o mapa sem cobri-lo. Aceita opcionalmente um nó central (ex: botão Ficar Online),
 * que aparece entre "Corridas" e "Carteira".
 */
import { Car, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  /** Nó renderizado no centro, entre Corridas e Carteira (ex: botão Ficar Online). */
  centerSlot?: ReactNode;
}

const DriverBottomNav = ({ centerSlot }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();

  const PillButton = ({ icon: Icon, label, path }: { icon: typeof Car; label: string; path: string }) => {
    const active = location.pathname === path;
    return (
      <button
        onClick={() => navigate(path)}
        className={cn(
          "pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border px-4 transition-transform active:scale-95 hover:bg-muted",
          active ? "text-primary" : "text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="font-display text-sm font-extrabold leading-none select-none">{label}</span>
      </button>
    );
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around gap-2 px-4 py-2">
        <PillButton icon={Car} label="Corridas" path="/driver/offers" />
        {centerSlot && <div className="pointer-events-auto flex-1 flex justify-center">{centerSlot}</div>}
        <PillButton icon={Wallet} label="Carteira" path="/driver/wallet" />
      </div>
    </nav>
  );
};

export default DriverBottomNav;
