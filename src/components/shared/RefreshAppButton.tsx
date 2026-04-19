/**
 * RefreshAppButton — botão flutuante circular abaixo do sino, recarrega o app.
 * Útil quando uma versão nova é publicada e o usuário quer forçar reload.
 */
import { RefreshCw } from "lucide-react";
import { useState } from "react";

const RefreshAppButton = () => {
  const [spinning, setSpinning] = useState(false);

  const handleClick = async () => {
    setSpinning(true);
    try {
      // Limpa caches do Service Worker (PWA), se houver
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
      }
    } catch {
      // ignora erros de cache
    }
    // Força reload sem cache
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Atualizar app"
      title="Atualizar app"
      className="fixed right-3 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border transition-transform active:scale-95 hover:bg-muted"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem + 52px)" }}
    >
      <RefreshCw className={`h-5 w-5 text-primary ${spinning ? "animate-spin" : ""}`} />
    </button>
  );
};

export default RefreshAppButton;
