import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BeforeInstallPromptEvent, storeInstallPrompt } from "./lib/pwaInstall";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (!isPreviewHost && !isInIframe && "serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`, { updateViaCache: "none" });
      await registration.update();
      if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      registration.addEventListener("updatefound", () => {
        const nextWorker = registration.installing;
        nextWorker?.addEventListener("statechange", () => {
          if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
            nextWorker.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          }
        });
      });
    } catch {
      // ignora erros do service worker
    }
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  storeInstallPrompt(event as BeforeInstallPromptEvent);
});

// 🔄 Limpeza única de caches (executa 1x por dispositivo, controlada por versão).
// Bump CACHE_PURGE_VERSION para forçar nova limpeza global no próximo load.
const CACHE_PURGE_VERSION = "2026-04-25-driver-card-1";
(async () => {
  try {
    if (localStorage.getItem("vamoo_cache_purge") !== CACHE_PURGE_VERSION) {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ((isPreviewHost || isInIframe) && "serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      localStorage.setItem("vamoo_cache_purge", CACHE_PURGE_VERSION);
    }
  } catch {
    // ignora erros de cache
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
