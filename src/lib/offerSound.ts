/**
 * offerSound — sistema robusto de áudio para alertas de corrida.
 *
 * - AudioContext único e persistente (não é recriado a cada toque)
 * - resume() automático para destravar autoplay no Chrome/Safari
 * - Listener global em primeira interação para garantir contexto ativo
 * - Notification API nativa para acordar app em tab inativa
 */

let ctx: AudioContext | null = null;
let unlocked = false;
let persistentTimer: number | null = null;
let persistentNotification: Notification | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Destrava o áudio na primeira interação do usuário (necessário para autoplay) */
export function unlockAudioOnce() {
  if (unlocked) return;
  const handler = async () => {
    const c = getCtx();
    if (c && c.state === "suspended") {
      try { await c.resume(); } catch { /* ignore */ }
    }
    unlocked = true;
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
    window.removeEventListener("touchstart", handler);
  };
  window.addEventListener("pointerdown", handler, { once: true });
  window.addEventListener("keydown", handler, { once: true });
  window.addEventListener("touchstart", handler, { once: true });
}

/** Toca o jingle de nova corrida + vibração + notificação nativa */
export async function playOfferAlert(payload?: { title?: string; body?: string; persistent?: boolean; tag?: string }) {
  // Se for persistente, dispara um ciclo agora e agenda repetições a cada 3s.
  if (payload?.persistent) {
    stopOfferAlert();
    await fireAlertCycle(payload);
    persistentTimer = window.setInterval(() => {
      fireAlertCycle(payload);
    }, 3000);
    return;
  }
  await fireAlertCycle(payload);
}

/** Para o alerta persistente (loop de som/vibração/notificação). */
export function stopOfferAlert() {
  if (persistentTimer != null) {
    clearInterval(persistentTimer);
    persistentTimer = null;
  }
  if (navigator.vibrate) {
    try { navigator.vibrate(0); } catch { /* ignore */ }
  }
  if (persistentNotification) {
    try { persistentNotification.close(); } catch { /* ignore */ }
    persistentNotification = null;
  }
}

async function fireAlertCycle(payload?: { title?: string; body?: string; tag?: string }) {
  // 1) Áudio
  const c = getCtx();
  if (c) {
    try {
      if (c.state === "suspended") await c.resume();
      const beep = (freq: number, start: number, dur = 0.2) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, c.currentTime + start);
        gain.gain.setValueAtTime(0.0001, c.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.5, c.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
        osc.connect(gain).connect(c.destination);
        osc.start(c.currentTime + start);
        osc.stop(c.currentTime + start + dur);
      };
      beep(880, 0); beep(1320, 0.25); beep(1760, 0.5);
      beep(1320, 0.75); beep(880, 1.0);
    } catch (e) {
      console.warn("[offerSound] audio failed:", e);
    }
  }

  // 2) Vibração
  if (navigator.vibrate) {
    try { navigator.vibrate([300, 120, 300, 120, 600]); } catch { /* ignore */ }
  }

  // 3) Notificação nativa (acorda tab inativa)
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification(payload?.title || "Nova corrida! 🚗", {
        body: payload?.body || "Toque para ver os detalhes",
        icon: "/favicon.ico",
        tag: payload?.tag || "ride-offer",
        requireInteraction: !!persistentTimer, // persistente fica fixa até fechar
        silent: false,
      });
      // Foca na aba ao clicar
      n.onclick = () => { window.focus(); n.close(); };
      if (persistentTimer) {
        persistentNotification = n;
      } else {
        setTimeout(() => n.close(), 12000);
      }
    }
  } catch (e) {
    console.warn("[offerSound] notification failed:", e);
  }
}

/** Solicita permissão de notificação (chamar após interação do usuário) */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

/**
 * playPhaseSound — beep médio-alto distinto para cada fase da corrida.
 * Padrões (volume ~0.45):
 *  - accepted:  2 beeps ascendentes (motorista aceitou)
 *  - arriving:  3 beeps curtos (motorista chegando)
 *  - arrived:   2 beeps agudos (motorista chegou ao local)
 *  - started:   3 beeps ascendentes (corrida iniciada — embarcou)
 *  - completed: arpejo descendente (corrida finalizada)
 *  - cancelled: beep grave longo
 */
export async function playPhaseSound(
  phase: "accepted" | "arriving" | "arrived" | "started" | "completed" | "cancelled"
) {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") await c.resume();
    const beep = (freq: number, start: number, dur = 0.18, vol = 0.45) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, c.currentTime + start);
      gain.gain.setValueAtTime(0.0001, c.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(c.currentTime + start);
      osc.stop(c.currentTime + start + dur);
    };
    switch (phase) {
      case "accepted":  beep(660, 0); beep(990, 0.22, 0.25); break;
      case "arriving":  beep(880, 0); beep(880, 0.18); beep(1100, 0.36, 0.22); break;
      case "arrived":   beep(1100, 0); beep(1480, 0.2, 0.28); break;
      case "started":   beep(660, 0); beep(880, 0.18); beep(1320, 0.36, 0.25); break;
      case "completed": beep(1320, 0); beep(990, 0.18); beep(660, 0.36, 0.3); break;
      case "cancelled": beep(330, 0, 0.5, 0.4); break;
    }
    if (navigator.vibrate) {
      try { navigator.vibrate(phase === "cancelled" ? 400 : [120, 80, 120]); } catch { /* ignore */ }
    }
  } catch (e) {
    console.warn("[playPhaseSound] failed:", e);
  }
}
