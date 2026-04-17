/**
 * DriverHeartbeat
 * Indicador visual mostrando há quantos segundos a localização foi atualizada.
 * Vermelho se passou de 60s. Aparece apenas quando isOnline.
 */
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

interface Props {
  lastSyncAt: number | null;
  isOnline: boolean;
}

export default function DriverHeartbeat({ lastSyncAt, isOnline }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isOnline) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [isOnline]);

  if (!isOnline) return null;

  const secondsAgo = lastSyncAt ? Math.floor((Date.now() - lastSyncAt) / 1000) : null;
  const isStale = secondsAgo === null || secondsAgo > 60;
  const label =
    secondsAgo === null
      ? "Aguardando GPS…"
      : secondsAgo < 5
        ? "GPS ao vivo"
        : `GPS há ${secondsAgo}s`;

  return (
    <div
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-md backdrop-blur ${
        isStale
          ? "bg-destructive/90 text-destructive-foreground"
          : "bg-success/90 text-success-foreground"
      }`}
      title={lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : "sem sinal"}
      aria-live="polite"
      data-tick={tick}
    >
      <Radio className={`h-3 w-3 ${isStale ? "" : "animate-pulse"}`} />
      {label}
    </div>
  );
}
