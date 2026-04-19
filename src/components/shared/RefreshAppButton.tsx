/**
 * RefreshAppButton — botão flutuante circular no canto superior direito,
 * recarrega o app limpando caches do Service Worker.
 * Aceita um offset vertical para se empilhar abaixo de outros botões (sino, saldo, etc).
 */
import { RefreshCw } from "lucide-react";
import { useState } from "react";

interface Props {
  /** Offset vertical extra (px) — usado para empilhar abaixo de outros botões fixos. */
  topOffsetPx?: number;
}

const RefreshAppButton = ({ topOffsetPx = 52 }: Props) => {
  const [spinning, setSpinning] = useState(false);

  const handleClick = async () => {
    setSpinning(true);
    try {
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
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Atualizar app"
      title="Atualizar app"
      className="fixed right-3 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border transition-transform active:scale-95 hover:bg-muted"
      style={{ top: `calc(env(safe-area-inset-top) + 0.75rem + ${topOffsetPx}px)` }}
    >
      <RefreshCw className={`h-6 w-6 text-primary ${spinning ? "animate-spin" : ""}`} />
    </button>
  );
};

export default RefreshAppButton;
