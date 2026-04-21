/**
 * DriverBottomNav — barra inferior do motorista, transparente, com botões em pílula.
 * Sobrepõe o mapa sem cobri-lo. Aceita opcionalmente um nó central (ex: botão Ficar Online),
 * que aparece entre "Corridas" e "Carteira".
 *
 * Mostra um badge com a contagem de ofertas pendentes no botão "Corridas" (poll 2s + realtime).
 */
import { Car, Wallet, Home } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  /** Nó renderizado no centro, entre Corridas e Carteira (ex: botão Ficar Online). */
  centerSlot?: ReactNode;
}

const HOME_PATH = "/driver";

const DriverBottomNav = ({ centerSlot }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const isHome = location.pathname === HOME_PATH;
  const isDriver = !!user && roles.includes("driver");
  const [pendingOffers, setPendingOffers] = useState(0);

  // Contagem de ofertas pendentes (poll 2s + realtime para resposta instantânea)
  useEffect(() => {
    if (!isDriver || !user) { setPendingOffers(0); return; }
    let cancelled = false;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("ride_offers")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", user.id)
        .eq("status", "pending")
        .gte("expires_at", new Date().toISOString());
      if (!cancelled) setPendingOffers(count ?? 0);
    };
    fetchCount();
    const i = setInterval(fetchCount, 2000);

    const channel = supabase
      .channel(`bottom-nav-offers-${user.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_offers", filter: `driver_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();

    return () => { cancelled = true; clearInterval(i); supabase.removeChannel(channel); };
  }, [isDriver, user]);

  const PillButton = ({
    icon: Icon, label, path, badge,
  }: { icon: typeof Car; label: string; path: string; badge?: number }) => {
    const active = location.pathname === path;
    return (
      <button
        onClick={() => navigate(path)}
        className={cn(
          "pointer-events-auto relative flex h-16 items-center gap-2 rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border px-5 transition-transform active:scale-95 hover:bg-muted",
          active ? "text-primary" : "text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="font-display text-sm font-extrabold leading-none select-none">{label}</span>
        {badge && badge > 0 ? (
          <span
            aria-label={`${badge} ofertas pendentes`}
            className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-extrabold flex items-center justify-center shadow-md ring-2 ring-background animate-pulse"
          >
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>
    );
  };

  const resolvedCenter =
    centerSlot ??
    (!isHome ? (
      <button
        onClick={() => navigate(HOME_PATH)}
        aria-label="Voltar para a tela inicial"
        className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background transition-transform active:scale-95 hover:opacity-90"
      >
        <Home className="h-6 w-6" />
      </button>
    ) : null);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem + 8px)" }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around gap-2 px-4 py-2">
        {resolvedCenter && <div className="pointer-events-auto flex justify-center">{resolvedCenter}</div>}
      </div>
    </nav>
  );
};

export default DriverBottomNav;
