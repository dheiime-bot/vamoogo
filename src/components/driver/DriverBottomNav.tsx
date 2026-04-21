/**
 * DriverBottomNav — barra inferior do motorista, transparente, com botões em pílula.
 * Sobrepõe o mapa sem cobri-lo. Aceita opcionalmente um nó central (ex: botão Ficar Online),
 * que aparece ao lado do botão "Corridas".
 *
 * Mostra um badge com a contagem de ofertas pendentes no botão "Corridas" (pneu + chama).
 */
import { Home, Car } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  /** Nó renderizado ao lado do botão Corridas (ex: switch Ficar Online). */
  centerSlot?: ReactNode;
}

const HOME_PATH = "/driver";
const OFFERS_PATH = "/driver/offers";

const DriverBottomNav = ({ centerSlot }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === HOME_PATH;
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  // Contador de ofertas pendentes (corridas aguardando resposta do motorista)
  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    const fetchCount = async () => {
      const { count } = await supabase
        .from("ride_offers")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString());
      if (active) setPendingCount(count ?? 0);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 4000);

    const channel = supabase
      .channel(`driver-bottomnav-offers-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_offers", filter: `driver_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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
      <div className="mx-auto flex max-w-lg items-center justify-center gap-4 px-4 py-2">
        {/* Botão Corridas — pneu com chama + badge de ofertas pendentes.
            Leva o motorista direto para a lista de ofertas disponíveis. */}
        <button
          onClick={() => navigate(OFFERS_PATH)}
          aria-label="Ofertas de corrida disponíveis"
          className="pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full bg-card/95 backdrop-blur-md shadow-lg ring-2 ring-background border border-border transition-transform active:scale-95 hover:bg-muted"
        >
          <Car className="h-7 w-7 text-foreground" strokeWidth={2.2} />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-extrabold text-destructive-foreground ring-2 ring-background animate-pulse">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </button>

        {/* Slot central (switch Ficar Online ou FAB de Home) */}
        {resolvedCenter && <div className="pointer-events-auto flex justify-center">{resolvedCenter}</div>}
      </div>
    </nav>
  );
};

export default DriverBottomNav;
