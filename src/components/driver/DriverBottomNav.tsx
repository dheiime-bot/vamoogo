/**
 * DriverBottomNav — barra inferior do motorista, transparente, com botões em pílula
 * (mesmo estilo do menu sanduíche flutuante "Vamoo!"). Sobrepõe o mapa sem cobri-lo.
 */
import { Car, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const items = [
  { icon: Car, label: "Corridas", path: "/driver/offers" },
  { icon: Wallet, label: "Carteira", path: "/driver/wallet" },
];

const DriverBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-4 py-2">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border px-4 transition-transform active:scale-95 hover:bg-muted",
                active ? "text-primary" : "text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-display text-sm font-extrabold leading-none select-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default DriverBottomNav;
