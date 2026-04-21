/**
 * DriverBottomNav — barra inferior do motorista, transparente, com botões em pílula.
 * Sobrepõe o mapa sem cobri-lo. Aceita opcionalmente um nó central (ex: botão Ficar Online),
 * que aparece ao lado do botão "Corridas".
 *
 * Mostra um badge com a contagem de ofertas pendentes no botão "Corridas" (pneu + chama).
 */
import { Home } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  /** Nó renderizado ao lado do botão Corridas (ex: switch Ficar Online). */
  centerSlot?: ReactNode;
}

const HOME_PATH = "/driver";
const RIDES_PATH = "/driver/rides";

/**
 * Ícone "pneu com chama" — pneu preto com aro/raios e uma chama saindo do topo,
 * comunicando "corrida em alta velocidade".
 */
const TireFlameIcon = ({ size = 30 }: { size?: number }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className="drop-shadow-sm">
    <defs>
      <radialGradient id="tireFlameTire" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#1f2937" />
        <stop offset="100%" stopColor="#0b1220" />
      </radialGradient>
      <linearGradient id="tireFlameFire" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="55%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#ef4444" />
      </linearGradient>
    </defs>
    {/* chama saindo do topo */}
    <path
      d="M32 2
         C 28 10 22 12 24 22
         C 26 18 28 17 30 18
         C 28 22 28 26 32 28
         C 36 26 36 22 34 18
         C 36 17 38 18 40 22
         C 42 12 36 10 32 2 Z"
      fill="url(#tireFlameFire)"
      stroke="#b45309"
      strokeWidth="0.8"
    />
    {/* pneu */}
    <circle cx="32" cy="40" r="20" fill="url(#tireFlameTire)" stroke="#000" strokeWidth="1.2" />
    {/* aro */}
    <circle cx="32" cy="40" r="9" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
    {/* raios do aro */}
    <g stroke="#475569" strokeWidth="1.4" strokeLinecap="round">
      <line x1="32" y1="33" x2="32" y2="47" />
      <line x1="25" y1="40" x2="39" y2="40" />
      <line x1="27" y1="35" x2="37" y2="45" />
      <line x1="37" y1="35" x2="27" y2="45" />
    </g>
    {/* miolo */}
    <circle cx="32" cy="40" r="2.4" fill="#0f172a" />
    {/* relevo do pneu (sulcos) */}
    <g stroke="#1f2937" strokeWidth="1" opacity="0.7">
      <circle cx="32" cy="40" r="16" fill="none" strokeDasharray="2 3" />
    </g>
  </svg>
);

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
      .channel(`driver-offers-${user.id}`)
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
        {/* Botão Corridas — pneu com chama + badge de ofertas pendentes */}
        <button
          onClick={() => navigate(RIDES_PATH)}
          aria-label="Minhas corridas"
          className="pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full bg-card/95 backdrop-blur-md shadow-lg ring-2 ring-background border border-border transition-transform active:scale-95 hover:bg-muted"
        >
          <TireFlameIcon size={34} />
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
