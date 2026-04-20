import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Headset, Lock, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Banner exibido quando o usuário (passageiro ou motorista) está bloqueado:
 * - Bloqueio MANUAL (admin): profile.status = 'bloqueado' / 'suspenso' OU drivers.online_blocked
 * - Bloqueio AUTOMÁTICO por cancelamentos: cancellation_block_until > now()
 *
 * Mostra motivo + contagem regressiva (quando há prazo) + botão para o chat de suporte.
 */
const BlockBanner = ({ role }: { role: "passenger" | "driver" }) => {
  const { profile, driverData } = useAuth();
  const navigate = useNavigate();
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
    navigate(role === "passenger" ? "/passenger/chats?central=1" : "/driver/chats?central=1");
  };

  return (
    <div className="px-4 pt-3 space-y-2">
      {items.map((it, idx) => (
        <div
          key={idx}
          className="rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-3 shadow-sm animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-destructive/20 flex items-center justify-center">
              {it.kind === "manual" ? (
                <Lock className="h-4 w-4 text-destructive" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-destructive" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {it.title}
              </p>
              {it.reason && (
                <p className="mt-0.5 text-xs text-foreground/80">
                  <span className="font-semibold">Motivo: </span>{it.reason}
                </p>
              )}
              {it.untilMs && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-card px-2.5 py-1 border border-destructive/30">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Tempo restante</span>
                  <span className="font-mono text-sm font-bold text-destructive tabular-nums">
                    {formatRemaining(it.untilMs)}
                  </span>
                </div>
              )}
              <button
                onClick={goSupport}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Headset className="h-3.5 w-3.5" />
                Falar com o suporte
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BlockBanner;