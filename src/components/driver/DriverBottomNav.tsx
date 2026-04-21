/**
 * DriverBottomNav — barra inferior do motorista, transparente, com botões em pílula.
 * Sobrepõe o mapa sem cobri-lo. Aceita opcionalmente um nó central (ex: botão Ficar Online),
 * que aparece entre "Corridas" e "Carteira".
 *
 * Mostra um badge com a contagem de ofertas pendentes no botão "Corridas" (poll 2s + realtime).
 */
import { Home } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { type ReactNode } from "react";

interface Props {
  /** Nó renderizado no centro, entre Corridas e Carteira (ex: botão Ficar Online). */
  centerSlot?: ReactNode;
}

const HOME_PATH = "/driver";

const DriverBottomNav = ({ centerSlot }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === HOME_PATH;

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
