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
export async function playOfferAlert(payload?: { title?: string; body?: string }) {
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
        tag: "ride-offer",
        requireInteraction: false,
        silent: false,
      });
      // Foca na aba ao clicar
      n.onclick = () => { window.focus(); n.close(); };
      setTimeout(() => n.close(), 12000);
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
