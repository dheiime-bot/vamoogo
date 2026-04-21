/**
 * GpsPermissionGate
 *
 * Bloqueia a tela do motorista enquanto a permissão de GPS não estiver
 * concedida. Mostra instruções claras e um botão para acionar o prompt
 * do navegador. Re-tenta automaticamente quando a aba volta ao foco
 * (caso o usuário libere a permissão nas configurações do navegador).
 */
import { useEffect, useState } from "react";
import { MapPin, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initGpsTracker, refreshGpsNow } from "@/lib/gpsTracker";

type PermState = "checking" | "prompt" | "granted" | "denied" | "unsupported";

const checkPermission = async (): Promise<PermState> => {
  if (!("geolocation" in navigator)) return "unsupported";
  try {
    // @ts-ignore - geolocation é válido em navigator.permissions
    const status = await navigator.permissions?.query({ name: "geolocation" });
    if (!status) return "prompt";
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "prompt";
  }
};

interface Props {
  children: React.ReactNode;
}

export default function GpsPermissionGate({ children }: Props) {
  const [perm, setPerm] = useState<PermState>("checking");
  const [requesting, setRequesting] = useState(false);

  const recheck = async () => {
    const next = await checkPermission();
    setPerm(next);
    return next;
  };

  // Verificação inicial + reage a mudanças.
  useEffect(() => {
    let cancelled = false;
    let permStatus: PermissionStatus | null = null;

    (async () => {
      const next = await recheck();
      if (cancelled) return;
      // Se já está concedido, garante o tracker rodando.
      if (next === "granted") initGpsTracker();
      try {
        // @ts-ignore
        permStatus = await navigator.permissions?.query({ name: "geolocation" });
        if (permStatus && "onchange" in permStatus) {
          permStatus.onchange = () => {
            const s = permStatus!.state as "granted" | "denied" | "prompt";
            setPerm(s);
            if (s === "granted") {
              initGpsTracker();
              refreshGpsNow();
            }
          };
        }
      } catch {
        /* sem Permissions API */
      }
    })();

    const onFocus = () => {
      void recheck();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      if (permStatus && "onchange" in permStatus) permStatus.onchange = null;
    };
  }, []);

  const requestPermission = () => {
    if (!("geolocation" in navigator)) {
      setPerm("unsupported");
      return;
    }
    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setRequesting(false);
        setPerm("granted");
        initGpsTracker();
        refreshGpsNow();
      },
      (err) => {
        setRequesting(false);
        if (err.code === err.PERMISSION_DENIED) {
          setPerm("denied");
        } else {
          // Posição indisponível / timeout — mas a permissão pode estar OK.
          // Re-checa via Permissions API.
          void recheck();
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30_000 },
    );
  };

  if (perm === "granted") return <>{children}</>;

  if (perm === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isDenied = perm === "denied";
  const isUnsupported = perm === "unsupported";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          {isDenied || isUnsupported ? (
            <AlertTriangle className="h-8 w-8 text-destructive" />
          ) : (
            <MapPin className="h-8 w-8 text-primary" />
          )}
        </div>

        <h1 className="text-xl font-bold mb-2">
          {isUnsupported
            ? "GPS não suportado"
            : isDenied
              ? "Ative o GPS para continuar"
              : "Permissão de GPS necessária"}
        </h1>

        <p className="text-sm text-muted-foreground mb-5">
          {isUnsupported
            ? "Seu navegador não suporta geolocalização. Use Chrome, Safari ou Firefox no celular para trabalhar como motorista."
            : isDenied
              ? "Você bloqueou o acesso à localização. Para receber corridas, é obrigatório liberar o GPS nas configurações do navegador."
              : "Para receber corridas, precisamos da sua localização em tempo real. Toque em Ativar GPS e permita o acesso quando o navegador perguntar."}
        </p>

        {isDenied && (
          <div className="mb-5 rounded-xl bg-muted/50 p-3 text-left text-xs space-y-2">
            <p className="font-semibold">Como liberar:</p>
            <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
              <li>Toque no cadeado/ícone ao lado do endereço do site.</li>
              <li>
                Em <span className="font-semibold">Permissões</span>, mude
                <span className="font-semibold"> Localização </span> para
                <span className="font-semibold"> Permitir</span>.
              </li>
              <li>Volte aqui e toque em <span className="font-semibold">Já liberei</span>.</li>
            </ol>
          </div>
        )}

        {!isUnsupported && (
          <div className="space-y-2">
            <Button
              onClick={requestPermission}
              disabled={requesting}
              className="w-full h-11"
              size="lg"
            >
              {requesting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              {isDenied ? "Já liberei, tentar novamente" : "Ativar GPS"}
            </Button>
            {isDenied && (
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full h-10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar página
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
