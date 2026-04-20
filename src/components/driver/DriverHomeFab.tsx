import { Home } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Botão flutuante "casinha" que leva o motorista de volta à tela inicial.
 * Fica fixo na parte inferior central, em todas as páginas internas do app
 * (exceto na própria home).
 */
const DriverHomeFab = ({ className }: { className?: string }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (pathname === "/driver" || pathname === "/driver/") return null;

  return (
    <button
      onClick={() => navigate("/driver")}
      aria-label="Ir para a tela inicial"
      className={cn(
        "fixed left-1/2 z-50 -translate-x-1/2",
        "flex h-14 w-14 items-center justify-center rounded-full",
        "bg-gradient-primary text-primary-foreground shadow-lg shadow-primary/30",
        "border-2 border-background",
        "transition-transform active:scale-95 hover:scale-105",
        className,
      )}
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
    >
      <Home className="h-6 w-6" />
    </button>
  );
};

export default DriverHomeFab;
