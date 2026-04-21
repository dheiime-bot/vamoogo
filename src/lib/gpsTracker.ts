/**
 * gpsTracker — GPS singleton global
 *
 * Mantém UM watchPosition() ativo durante toda a vida do app (assim que a
 * permissão é concedida). Guarda a última leitura em memória e notifica
 * subscribers em tempo real. Isso elimina o atraso de "esquentar" o GPS toda
 * vez que o motorista clica em Ficar Online: quando ele liga, a posição já
 * está no cache e o upsert acontece em milissegundos.
 *
 * Estratégia anti-falha:
 *  - Inicia com baixa precisão (rápido) e em paralelo com alta precisão.
 *  - Reinicia automaticamente o watch em caso de erro (com backoff curto).
 *  - Reinicia ao voltar a ficar visível (visibilitychange) e ao reconectar.
 */

export interface GpsFix {
  lat: number;
  lng: number;
  heading: number | null;
  accuracy: number | null;
  ts: number;
}

type Listener = (fix: GpsFix) => void;

let lastFix: GpsFix | null = null;
let watchId: number | null = null;
let started = false;
let restartTimer: number | null = null;
const listeners = new Set<Listener>();

const emit = (fix: GpsFix) => {
  lastFix = fix;
  listeners.forEach((l) => {
    try {
      l(fix);
    } catch {
      /* listener errors não devem quebrar o stream */
    }
  });
};

const onPos = (pos: GeolocationPosition) => {
  emit({
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    heading: pos.coords.heading ?? null,
    accuracy: pos.coords.accuracy ?? null,
    ts: Date.now(),
  });
};

const startWatch = () => {
  if (!("geolocation" in navigator)) return;
  if (watchId !== null) return;
  try {
    watchId = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 1500,
      timeout: 15000,
    });
  } catch {
    /* navegador hostil — ignora */
  }
};

const stopWatch = () => {
  if (watchId !== null) {
    try {
      navigator.geolocation.clearWatch(watchId);
    } catch {
      /* ignora */
    }
    watchId = null;
  }
};

const restartWatch = () => {
  stopWatch();
  startWatch();
};

const scheduleRestart = (delayMs = 2000) => {
  if (restartTimer) return;
  restartTimer = window.setTimeout(() => {
    restartTimer = null;
    restartWatch();
  }, delayMs);
};

function onErr(err: GeolocationPositionError) {
  // Apenas loga; o watch normalmente continua entregando posições mesmo após
  // erros transitórios (POSITION_UNAVAILABLE / TIMEOUT). Em PERMISSION_DENIED
  // não adianta tentar de novo até o usuário liberar.
  if (err.code === err.PERMISSION_DENIED) return;
  scheduleRestart();
}

/**
 * Inicializa o tracker (idempotente). Deve ser chamado o quanto antes (no boot
 * do app). Faz o "aquecimento" do GPS em paralelo (baixa + alta precisão) e
 * abre o watchPosition contínuo. Reage a visibilitychange/online para reabrir
 * o stream se o navegador o tiver pausado.
 */
export const initGpsTracker = () => {
  if (started) return;
  started = true;
  if (!("geolocation" in navigator)) return;

  // Aquecimento paralelo (o que vier primeiro alimenta o cache).
  try {
    navigator.geolocation.getCurrentPosition(onPos, () => {}, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 60_000,
    });
    navigator.geolocation.getCurrentPosition(onPos, () => {}, {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 30_000,
    });
  } catch {
    /* ignora */
  }

  startWatch();

  // Re-arma o watch quando a aba volta ao foco / rede volta.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") restartWatch();
  });
  window.addEventListener("online", () => restartWatch());
  window.addEventListener("focus", () => {
    if (!lastFix || Date.now() - lastFix.ts > 30_000) restartWatch();
  });
};

/** Última posição conhecida (cache em memória). */
export const getLastFix = (): GpsFix | null => lastFix;

/**
 * Inscreve um listener para receber novas leituras. Já dispara imediatamente
 * com o cache atual (se houver). Devolve uma função para cancelar.
 */
export const subscribeGps = (cb: Listener): (() => void) => {
  listeners.add(cb);
  if (lastFix) {
    try {
      cb(lastFix);
    } catch {
      /* ignora */
    }
  }
  if (!started) initGpsTracker();
  return () => {
    listeners.delete(cb);
  };
};

/**
 * Pede uma leitura nova imediata (high accuracy). Útil quando o motorista
 * acabou de clicar em Ficar Online e queremos confirmar a posição rapidíssimo
 * mesmo que o cache já esteja válido.
 */
export const refreshGpsNow = () => {
  if (!("geolocation" in navigator)) return;
  try {
    navigator.geolocation.getCurrentPosition(onPos, () => {}, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    });
  } catch {
    /* ignora */
  }
};
