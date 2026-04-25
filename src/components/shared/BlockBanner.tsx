import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertTriangle, Headset, Lock, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Overlay FULLSCREEN bloqueante exibido quando o usuário está bloqueado.
 * - Bloqueia toda a tela: o único clique permitido é "Falar com o suporte".
 * - Quando o usuário já está na página de chats (suporte), o overlay é liberado
 *   para que ele consiga conversar.
 */
const BlockBanner = ({ role }: { role: "passenger" | "driver" }) => {
  const { profile, driverData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Coleta os bloqueios ativos
  const items: Array<{
    kind: "manual" | "auto";
    title: string;
    reason?: string | null;
    untilMs?: number | null;
  }> = [];

  if (role === "passenger") {
    if (profile?.status === "bloqueado") {
      items.push({ kind: "manual", title: "Sua conta está bloqueada", reason: profile?.blocked_reason });
    } else if (profile?.status === "suspenso") {
      items.push({ kind: "manual", title: "Sua conta está suspensa", reason: profile?.blocked_reason });
    }
    const until = profile?.cancellation_block_until ? new Date(profile.cancellation_block_until).getTime() : null;
    if (until && until > now) {
      items.push({
        kind: "auto",
        title: "Você está temporariamente impedido de pedir corridas",
        reason: "Limite de cancelamentos atingido. Aguarde o tempo abaixo para voltar a pedir corridas.",
        untilMs: until,
      });
    }
  } else {
    if (driverData?.online_blocked) {
      items.push({
        kind: "manual",
        title: "Você está impedido de ficar online",
        reason: driverData?.online_blocked_reason,
      });
    }
    const until = driverData?.cancellation_block_until ? new Date(driverData.cancellation_block_until).getTime() : null;
    if (until && until > now) {
      items.push({
        kind: "auto",
        title: "Você está temporariamente impedido de aceitar corridas",
        reason: "Limite de cancelamentos atingido. Aguarde o tempo abaixo para voltar a aceitar.",
        untilMs: until,
      });
    }
  }

  if (items.length === 0) return null;

  // Libera a tela quando o usuário está no chat de suporte
  const isOnChats =
    location.pathname.startsWith("/passageiro/chats") ||
    location.pathname.startsWith("/motorista/chats");
  if (isOnChats) return null;

  const formatRemaining = (target: number) => {
    let s = Math.max(0, Math.floor((target - now) / 1000));
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const goSupport = () => {
    navigate(role === "passenger" ? "/passageiro/chats?central=1" : "/motorista/chats?central=1");
  };

  // Mostra APENAS um motivo: manual tem prioridade sobre automático
  const manualItem = items.find((i) => i.kind === "manual");
  const autoItem = items.find((i) => i.kind === "auto");
  const primary = manualItem ?? autoItem!;
  const displayItems = [primary];
  const title = primary.title;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="block-title"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-destructive/50 bg-card p-5 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-4">
          <div className="h-14 w-14 rounded-full bg-destructive/15 flex items-center justify-center mb-3">
            <Lock className="h-7 w-7 text-destructive" />
          </div>
          <h2 id="block-title" className="text-lg font-bold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O acesso ao app está bloqueado. Fale com o suporte para mais informações.
          </p>
        </div>

        <div className="space-y-2">
          {displayItems.map((it, idx) => (
            <div key={idx} className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-destructive flex items-center gap-1">
                {it.kind === "manual" ? <Lock className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {it.kind === "manual" ? "Bloqueio manual" : "Bloqueio automático"}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{it.title}</p>
              {it.reason && (
                <p className="mt-0.5 text-xs text-foreground/80">
                  <span className="font-semibold">Motivo: </span>{it.reason}
                </p>
              )}
              {it.untilMs && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-card px-2.5 py-1 border border-destructive/30">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Tempo restante
                  </span>
                  <span className="font-mono text-sm font-bold text-destructive tabular-nums">
                    {formatRemaining(it.untilMs)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={goSupport}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
        >
          <Headset className="h-4 w-4" />
          Falar com o suporte
        </button>
      </div>
    </div>
  );
};

export default BlockBanner;